import {
  validateAndUsePasskey,
  createPasskey as dbCreatePasskey,
  getConnectionStats,
  getAllPasskeys,
  getValidPasskeys,
} from '../database/queries.js';
import { createBotSession, disconnectSession, getActiveSessions } from '../bot/connection.js';
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
    message(ws, message) {
      logger.debug(`WebSocket message: ${message}`);
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

export function notifyNewConnection(server, phoneNumber) {
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

export function createRoutes(publicDir) {
  return async (req, server) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/ws') {
      if (server.upgrade(req)) {
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
              notifyNewConnection(server, connectedNumber);
              broadcastStats(server);
            },
            (reason) => {
              const pending = pendingConnections.get(sessionId);
              if (pending) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(reason));
              }
            },
          );
        });

        pendingConnections.delete(sessionId);

        return Response.json({
          success: true,
          pairingCode,
          sessionId,
          message: 'Enter this code in WhatsApp > Check For Pairing Code Notification',
        });
      } catch (error) {
        pendingConnections.delete(sessionId);
        return Response.json({ error: error.message }, { status: 500 });
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

    const filePath = `${publicDir}${pathname}`;
    try {
      return new Response(Bun.file(filePath));
    } catch {
      return Response.json({ error: 'Not Found' }, { status: 404 });
    }
  };
}
