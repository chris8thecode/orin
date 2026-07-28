import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from 'baileys';
import P from 'pino';
import { join } from 'path';
import NodeCache from '@cacheable/node-cache';
import {
  addConnection,
  updateConnectionStatus,
  incrementDailyConnections,
  getActiveConnections,
} from '../database/queries.js';
import { handleMessage, setupGroupCacheListeners } from './messageHandler.js';
import { logger } from '../logger.js';
import { updateEnvFile } from '../utils/env.js';
import { config } from '../config.js';
import { extractId } from '../utils/helpers.js';
import { broadcastStats } from '../server/websocket.js';

const baileysLogger = logger.child({ component: 'baileys' });
baileysLogger.level = 'trace';

const msgRetryCounterCache = new NodeCache();
const userDevicesCache = new NodeCache();
const mediaCache = new NodeCache();

const activeSessions = new Map();

export function getActiveSessions() {
  return activeSessions;
}

/**
 * Creates and initializes a new WhatsApp bot session.
 *
 * @param {string} phoneNumber
 * @param {string} sessionId
 * @param {function(string): void} [onPairingCode]
 * @param {function(string): void} [onConnected]
 * @param {function(string): void} [onDisconnected]
 * @param {string|null} [existingFolder]
 * @returns {Promise<any>}
 */
export async function createBotSession(
  phoneNumber,
  sessionId,
  onPairingCode = () => {},
  onConnected = () => {},
  onDisconnected = () => {},
  existingFolder = null,
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
    getMessage: async () => undefined,
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

      /*
       * If the disconnect was NOT caused by an explicit logout (e.g., connection timed out or dropped),
       * we schedule an automatic reconnection. Explicit logouts should not auto-reconnect to prevent
       * infinite looping with invalid credentials.
       */
      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(() => {
          createBotSession(phoneNumber, sessionId, onPairingCode, onConnected, onDisconnected);
        }, 5000);
      } else {
        activeSessions.delete(sessionId);
        updateConnectionStatus(phoneNumber, false);
        onDisconnected('Logged out');
        broadcastStats();
      }
    } else if (connection === 'open') {
      const connectedNumber = extractId(orin.user?.id);

      /*
       * Business Rule: The very first phone number that successfully connects to the bot
       * is automatically promoted to the owner, bypassing the need for manual configuration.
       */
      if (!config.ownerNumber) {
        updateEnvFile('OWNER_NUMBER', connectedNumber);
      }

      activeSessions.set(sessionId, { orin, phoneNumber: connectedNumber });
      addConnection(connectedNumber, sessionFolder);
      incrementDailyConnections();
      setupGroupCacheListeners(orin);
      onConnected(connectedNumber);
      broadcastStats();
    }
  });

  orin.ev.on('creds.update', saveCreds);

  orin.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      await handleMessage(orin, message);
    }
  });

  return orin;
}

export function disconnectSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.orin.logout();
    activeSessions.delete(sessionId);
    broadcastStats();
  }
}

export async function resumeSessions() {
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
      );
    } catch (error) {
      logger.error({ error, phoneNumber: conn.phone_number }, 'Failed to resume session');
    }
  }
}
