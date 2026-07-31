import {
  validateAndUsePasskey,
  createPasskey as dbCreatePasskey,
  getConnectionStats,
  getAllPasskeys,
  getValidPasskeys,
  getRecentChats,
  getRecentMessages,
} from '../database/queries.js';
import {
  createBotSession,
  disconnectSession,
  getActiveSessions,
  sendMessageFromUI,
  fetchMediaFromUI,
} from '../bot/connection.js';
import { createPasskeyWithExpiry, validatePasskey } from '../utils/crypto.js';
import { config } from '../config.js';
import { formatNumber } from '../utils/helpers.js';
import { logger } from '../logger.js';

const pendingConnections = new Map();

export function createWebSocketHandler() {
  return {
    open(ws) {
      ws.subscribe('dashboard-stats');
      sendStatsToClient(ws);
      logger.info('Dashboard WebSocket client connected');
    },
    close(ws) {
      logger.info('Dashboard WebSocket client disconnected');
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribe_chat' && msg.sessionPhone) {
          ws.subscribe(`chat:${msg.sessionPhone}`);
        }
        if (msg.type === 'unsubscribe_chat' && msg.sessionPhone) {
          ws.unsubscribe(`chat:${msg.sessionPhone}`);
        }
      } catch {
        logger.debug('Unparseable WS message');
      }
    },
  };
}

function sendStatsToClient(ws) {
  const stats = getConnectionStats();
  const activeConnections = Array.from(getActiveSessions().values()).map((s) => ({
    phoneNumber: s.phoneNumber,
    connectedAt: Date.now(),
  }));

  ws.send(
    JSON.stringify({
      type: 'stats',
      data: { ...stats, activeConnections },
    }),
  );
}

export function broadcastStats(server) {
  if (!server) return;
  const stats = getConnectionStats();
  const activeSessions = getActiveSessions();
  const activeConnections = Array.from(activeSessions.values()).map((s) => ({
    phoneNumber: s.phoneNumber,
  }));

  const message = JSON.stringify({
    type: 'stats',
    data: { ...stats, activeConnections },
  });

  server.publish('dashboard-stats', message);
}

export function broadcastChatEvent(server, sessionPhone, payload) {
  if (!server) return;
  server.publish(`chat:${sessionPhone}`, JSON.stringify(payload));
}

export function notifyNewConnection(server, phoneNumber) {
  if (!server) return;
  const message = JSON.stringify({
    type: 'newConnection',
    data: { phoneNumber },
  });

  server.publish('dashboard-stats', message);
}

async function parseJSON(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function createRoutes(publicDir, server) {
  return async (req, serverInstance) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/ws') {
      if (serverInstance.upgrade(req)) {
        return;
      }
      return Response.json({ error: 'WebSocket upgrade failed' }, { status: 400 });
    }

    if (pathname === '/api/validate-passkey' && req.method === 'POST') {
      const body = await parseJSON(req);
      if (!body?.passkey || body.passkey.length !== 30) {
        return Response.json({ error: 'Invalid passkey format' }, { status: 400 });
      }

      const isValid = validatePasskey(body.passkey, config.passkeySecret, getValidPasskeys());
      return Response.json({ valid: isValid });
    }

    if (pathname === '/api/connect' && req.method === 'POST') {
      const body = await parseJSON(req);
      if (!body?.phoneNumber || !body?.passkey) {
        return Response.json({ error: 'Phone number and passkey required' }, { status: 400 });
      }

      const cleanNumber = formatNumber(body.phoneNumber);
      if (cleanNumber.length < 10) {
        return Response.json({ error: 'Invalid phone number' }, { status: 400 });
      }

      const isValid = validateAndUsePasskey(body.passkey.toUpperCase(), cleanNumber);
      if (!isValid) {
        return Response.json({ error: 'Invalid or expired passkey' }, { status: 401 });
      }

      const sessionId = `session_${cleanNumber}_${Date.now()}`;

      try {
        const pairingCode = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for pairing code'));
          }, 30000);

          pendingConnections.set(sessionId, { resolve, reject, timeout });

          createBotSession(
            cleanNumber,
            sessionId,
            (code) => {
              const pending = pendingConnections.get(sessionId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.resolve(code);
              }
            },
            (connectedNumber) => {
              notifyNewConnection(serverInstance, connectedNumber);
              broadcastStats(serverInstance);
            },
            (reason) => {
              const pending = pendingConnections.get(sessionId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(reason));
              }
            },
            null,
            serverInstance,
          );
        });

        pendingConnections.delete(sessionId);

        return Response.json({
          success: true,
          pairingCode,
          sessionId,
          message: 'Enter this code in WhatsApp',
        });
      } catch (error) {
        pendingConnections.delete(sessionId);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    if (pathname === '/api/chats' && req.method === 'GET') {
      const sessionPhone = url.searchParams.get('session');
      if (!sessionPhone) {
        return Response.json({ error: 'session param required' }, { status: 400 });
      }
      const chats = getRecentChats(sessionPhone);
      return Response.json({ chats });
    }

    if (pathname === '/api/messages' && req.method === 'GET') {
      const sessionPhone = url.searchParams.get('session');
      const jid = url.searchParams.get('jid');
      if (!sessionPhone || !jid) {
        return Response.json({ error: 'session and jid params required' }, { status: 400 });
      }
      const messages = getRecentMessages(sessionPhone, jid);
      return Response.json({ messages });
    }

    if (pathname === '/api/send' && req.method === 'POST') {
      const body = await parseJSON(req);
      if (!body?.sessionPhone || !body?.remoteJid || !body?.text) {
        return Response.json({ error: 'sessionPhone, remoteJid, text required' }, { status: 400 });
      }
      const sent = await sendMessageFromUI(body.sessionPhone, body.remoteJid, body.text);
      if (!sent) {
        return Response.json({ error: 'Session not found or not connected' }, { status: 404 });
      }
      return Response.json({ success: true });
    }

    if (pathname === '/api/media' && req.method === 'GET') {
      const sessionPhone = url.searchParams.get('session');
      const messageId = url.searchParams.get('id');
      if (!sessionPhone || !messageId) {
        return Response.json({ error: 'session and id params required' }, { status: 400 });
      }

      try {
        const stream = await fetchMediaFromUI(sessionPhone, messageId);
        if (!stream) {
          return Response.json({ error: 'Media not found' }, { status: 404 });
        }
        return new Response(stream, {
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      } catch {
        return Response.json({ error: 'Media fetch failed' }, { status: 500 });
      }
    }

    if (pathname === '/api/admin/generate-passkey' && req.method === 'POST') {
      const body = await parseJSON(req);
      if (body?.adminSecret !== config.passkeySecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { passkey, expiresAt } = createPasskeyWithExpiry(config.passkeySecret);
      dbCreatePasskey(passkey, expiresAt);

      return Response.json({
        passkey,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = getConnectionStats();
      const activeSessions = Array.from(getActiveSessions().entries()).map(([sessionId, s]) => ({
        phoneNumber: s.phoneNumber,
        sessionId: sessionId,
      }));

      return Response.json({
        ...stats,
        activeConnections: activeSessions,
      });
    }

    if (pathname === '/api/sessions/logout' && req.method === 'POST') {
      const body = await parseJSON(req);
      if (body?.adminSecret !== config.passkeySecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!body?.sessionId) {
        return Response.json({ error: 'Session ID required' }, { status: 400 });
      }

      disconnectSession(body.sessionId);
      return Response.json({ success: true, message: 'Session disconnected' });
    }

    if (pathname === '/api/admin/passkeys' && req.method === 'GET') {
      const adminSecret = url.searchParams.get('adminSecret');
      if (adminSecret !== config.passkeySecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const passkeys = getAllPasskeys();
      return Response.json({ passkeys });
    }

    if (pathname === '/api/debug/secret-check' && req.method === 'GET') {
      return Response.json({
        secretLoaded: !!config.passkeySecret,
        secretLength: config.passkeySecret.length,
        secretPreview: config.passkeySecret.substring(0, 4) + '***',
      });
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    if (pathname === '/' || pathname === '/index.html') {
      return new Response(Bun.file(`${publicDir}/index.html`));
    }

    if (pathname === '/dashboard') {
      return new Response(Bun.file(`${publicDir}/dashboard.html`));
    }

    if (pathname === '/admin') {
      return new Response(Bun.file(`${publicDir}/admin.html`));
    }

    if (pathname === '/chat') {
      return new Response(Bun.file(`${publicDir}/chat.html`));
    }

    const filePath = `${publicDir}${pathname}`;
    try {
      return new Response(Bun.file(filePath));
    } catch {
      return Response.json({ error: 'Not Found' }, { status: 404 });
    }
  };
}
