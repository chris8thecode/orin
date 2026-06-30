import { getEnv } from './utils/env.js';

export const config = {
  prefix: getEnv('PREFIX', '/'),
  ownerNumber: getEnv('OWNER_NUMBER', ''),
  adminContact: getEnv('ADMIN_CONTACT', '+27639614303'),
  port: parseInt(getEnv('PORT', '3000')),
  passkeySecret: getEnv('PASSKEY_SECRET'),
};
