import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  isJidStatusBroadcast,
  getContentType,
  downloadContentFromMessage,
} from 'baileys';
import P from 'pino';
import { join } from 'path';
import NodeCache from '@cacheable/node-cache';
import {
  addConnection,
  updateConnectionStatus,
  incrementDailyConnections,
  getActiveConnections,
  storeMessage,
  markMessageDeleted,
  getStoredMessage,
  getRecentChats,
  getRecentMessages,
} from '../database/queries.js';
import {
  handleMessage,
  setupGroupCacheListeners,
  getGroupName,
  setGroupCache,
} from './messageHandler.js';
import { logger } from '../logger.js';
import { updateEnvFile } from '../utils/env.js';
import { config } from '../config.js';
import { extractId } from '../utils/helpers.js';
import { broadcastStats, broadcastChatEvent } from '../server/websocket.js';

const baileysLogger = logger.child({ component: 'baileys' });
baileysLogger.level = 'trace';

const msgRetryCounterCache = new NodeCache();
const userDevicesCache = new NodeCache();
const mediaCache = new NodeCache();

const activeSessions = new Map();

export function getActiveSessions() {
  return activeSessions;
}

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    null
  );
}

function extractMediaInfo(message) {
  const type = getContentType(message);
  if (!type || type === 'conversation' || type === 'extendedTextMessage') return null;

  const media = message[type];
  if (!media) return null;

  const mediaTypes = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'stickerMessage',
  ];

  if (!mediaTypes.includes(type)) return null;

  return {
    mediaType: type.replace('Message', ''),
    mediaKey: media.mediaKey ? Buffer.from(media.mediaKey).toString('base64') : null,
    directPath: media.directPath ?? null,
    mimeType: media.mimetype ?? null,
    fileName: media.fileName ?? null,
  };
}

function buildMessagePayload(msg, sessionPhone) {
  const remoteJid = msg.key.remoteJid;
  const participant = msg.key.participant ?? null;
  const fromMe = msg.key.fromMe ?? false;
  const messageId = msg.key.id;
  const timestamp =
    typeof msg.messageTimestamp === 'object'
      ? Number(msg.messageTimestamp)
      : (msg.messageTimestamp ?? Date.now() / 1000);

  const text = extractText(msg.message);
  const media = extractMediaInfo(msg.message);

  const isGroup = remoteJid?.endsWith('@g.us') ?? false;
  const groupName = isGroup ? getGroupName(remoteJid) : null;

  return {
    messageId,
    sessionPhone,
    remoteJid,
    participant,
    fromMe,
    textContent: text,
    timestamp: timestamp * 1000,
    pushName: msg.pushName ?? null,
    groupName,
    ...(media ?? {}),
  };
}

export async function createBotSession(
  phoneNumber,
  sessionId,
  onPairingCode = () => {},
  onConnected = () => {},
  onDisconnected = () => {},
  existingFolder = null,
  server = null,
) {
  const sessionFolder = existingFolder || join(process.cwd(), 'sessions', sessionId);

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  logger.info(`Version: ${version.join('.')} (Latest: ${isLatest}), using Latest WA version`);

  const orin = makeWASocket({
    version,
    browser: Browsers.windows('Chrome'),
    connectTimeoutMs: 45000,
    keepAliveIntervalMs: 25000,
    logger: baileysLogger,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 200,
    maxMsgRetryCount: 3,
    emitOwnEvents: true,
    fireInitQueries: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    transactionOpts: {
      maxCommitRetries: 10,
      delayBetweenTriesMs: 100,
    },
    markOnlineOnConnect: true,
    syncFullHistory: true,
    pushName: 'Orin',
    patchMessageBeforeSending: (msg) => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: (jid) => isJidStatusBroadcast(jid),
    linkPreviewImageThumbnailWidth: 192,
    generateHighQualityLinkPreview: true,
    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    appStateMacVerification: {
      patch: false,
      snapshot: false,
    },
    countryCode: 'ZA',
    msgRetryCounterCache,
    userDevicesCache,
    mediaCache,
    getMessage: async (key) => {
      const stored = getStoredMessage(key.id);
      if (stored?.text_content) {
        return { conversation: stored.text_content };
      }
      return undefined;
    },
  });

  if (!orin.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await orin.requestPairingCode(phoneNumber);
        onPairingCode(code);
      } catch (error) {
        logger.error({ error }, 'Pairing code error');
        onDisconnected('Failed to generate pairing code');
      }
    }, 3000);
  }

  orin.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(() => {
          createBotSession(
            phoneNumber,
            sessionId,
            onPairingCode,
            onConnected,
            onDisconnected,
            null,
            server,
          );
        }, 5000);
      } else {
        activeSessions.delete(sessionId);
        updateConnectionStatus(phoneNumber, false);
        onDisconnected('Logged out');
        broadcastStats(server);
      }
    } else if (connection === 'open') {
      const connectedNumber = extractId(orin.user?.id);

      if (!config.ownerNumber) {
        updateEnvFile('OWNER_NUMBER', connectedNumber);
      }

      activeSessions.set(sessionId, { orin, phoneNumber: connectedNumber });
      addConnection(connectedNumber, sessionFolder);
      incrementDailyConnections();
      setupGroupCacheListeners(orin);
      onConnected(connectedNumber);
      broadcastStats(server);

      if (server) {
        const chats = getRecentChats(connectedNumber);
        broadcastChatEvent(server, connectedNumber, { type: 'chats', data: chats });
      }
    }
  });

  orin.ev.on('creds.update', saveCreds);

  orin.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;

      const sessionPhone = extractId(orin.user?.id);
      const payload = buildMessagePayload(msg, sessionPhone);
      storeMessage(payload);

      if (server) {
        broadcastChatEvent(server, sessionPhone, {
          type: 'message',
          data: {
            ...payload,
            isDeleted: false,
          },
        });
      }

      if (type !== 'notify') continue;
      await handleMessage(orin, msg);
    }
  });

  orin.ev.on('messages.update', (updates) => {
    const sessionPhone = extractId(orin.user?.id);

    for (const update of updates) {
      if (update.update?.messageStubType || update.update?.status === 6) {
        markMessageDeleted(update.key.id);

        if (server) {
          broadcastChatEvent(server, sessionPhone, {
            type: 'message_deleted',
            data: { messageId: update.key.id, remoteJid: update.key.remoteJid },
          });
        }
      }
    }
  });

  orin.ev.on('message-receipt.update', (receipts) => {
    const sessionPhone = extractId(orin.user?.id);
    if (!server) return;

    for (const receipt of receipts) {
      broadcastChatEvent(server, sessionPhone, {
        type: 'receipt',
        data: {
          messageId: receipt.key.id,
          remoteJid: receipt.key.remoteJid,
          status: receipt.update.status,
        },
      });
    }
  });

  orin.ev.on('presence.update', ({ id, presences }) => {
    const sessionPhone = extractId(orin.user?.id);
    if (!server) return;

    broadcastChatEvent(server, sessionPhone, {
      type: 'presence',
      data: { jid: id, presences },
    });
  });

  return orin;
}

export function disconnectSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.orin.logout();
    activeSessions.delete(sessionId);
  }
}

export async function sendMessageFromUI(sessionPhone, remoteJid, text) {
  for (const [, session] of activeSessions) {
    if (session.phoneNumber === sessionPhone) {
      await session.orin.sendMessage(remoteJid, { text });
      return true;
    }
  }
  return false;
}

export async function fetchMediaFromUI(sessionPhone, messageId) {
  const stored = getStoredMessage(messageId);
  if (!stored || !stored.media_type || !stored.media_key || !stored.direct_path) return null;

  for (const [, session] of activeSessions) {
    if (session.phoneNumber === sessionPhone) {
      const stream = await downloadContentFromMessage(
        {
          mediaKey: Buffer.from(stored.media_key, 'base64'),
          directPath: stored.direct_path,
          url: null,
        },
        stored.media_type,
      );
      return stream;
    }
  }
  return null;
}

export async function resumeSessions(server = null) {
  const activeConnections = getActiveConnections();
  logger.info(`Resuming ${activeConnections.length} session(s)...`);

  for (const conn of activeConnections) {
    const sessionId = `resume_${conn.phone_number}_${Date.now()}`;
    try {
      await createBotSession(
        conn.phone_number,
        sessionId,
        () => {},
        (num) => logger.info(`Session resumed for ${num}`),
        (err) => logger.warn(`Session failed for ${conn.phone_number}: ${err}`),
        conn.session_folder,
        server,
      );
    } catch (error) {
      logger.error({ error, phoneNumber: conn.phone_number }, 'Failed to resume session');
    }
  }
}
