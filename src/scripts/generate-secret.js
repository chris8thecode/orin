import { randomBytes } from 'crypto';
import { logger } from '../logger.js';

function generateSecret() {
  return randomBytes(32).toString('hex');
}

logger.info('Generated PASSKEY_SECRET:');
logger.info(generateSecret());
