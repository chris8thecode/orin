import { createRoutes, createWebSocketHandler, broadcastStats } from './routes.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

export function startServer() {
  let port = config.port || 3000;
  const maxPort = port + 100;

  function attemptStart(targetPort) {
    if (targetPort > maxPort) {
      logger.error('Could not find an available port after trying 100 ports');
      process.exit(1);
    }

    try {
      const server = Bun.serve({
        port: targetPort,
        fetch: createRoutes(publicDir),
        websocket: createWebSocketHandler(),
      });

      logger.info(`Orin Server running on http://localhost:${server.port}`);
      logger.info(`Dashboard: http://localhost:${server.port}/dashboard`);
      logger.info(`Admin: http://localhost:${server.port}/admin`);

      setInterval(() => broadcastStats(server), 2000);

      return server;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${targetPort} is already in use, trying next port...`);
        return attemptStart(targetPort + 1);
      }
      logger.error('Server error:', err);
      process.exit(1);
    }
  }

  return attemptStart(port);
}
