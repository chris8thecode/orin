import P from 'pino';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

export function createLogger(logFilePath = join(process.cwd(), 'logs', 'orin-logs.txt')) {
  const logger = P({
    level: 'trace',
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
          level: 'trace',
        },
        {
          target: 'pino/file',
          options: {
            destination: logFilePath,
            mkdir: true,
          },
          level: 'trace',
        },
      ],
    },
  });

  logger.level = 'trace';

  return logger;
}

export const logger = createLogger();
