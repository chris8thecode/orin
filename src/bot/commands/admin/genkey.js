import { generatePasskey } from '../../../utils/crypto.js';
import { config } from '../../../config.js';
import { createPasskey as dbCreatePasskey } from '../../../database/queries.js';
import { isSameJid } from '../../../utils/helpers.js';

export const genkeyCommand = {
  name: 'genkey',
  description: 'Generate a new passkey (Owner only)',
  ownerOnly: true,

  async execute(orin, message, args) {
    const sender = message.key.participant || message.key.remoteJid;
    const isOwner = isSameJid(sender, config.ownerNumber);

    if (!isOwner) {
      return orin.sendMessage(message.key.remoteJid, {
        text: '❌ This command is restricted to the bot owner!',
      });
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const passkey = generatePasskey(config.passkeySecret);

    dbCreatePasskey(passkey, expiresAt);

    await orin.sendMessage(message.key.remoteJid, {
      text: `✅ *New Passkey Generated*\n\nKey: \`${passkey}\`\nExpires: 24 hours\n\nUse this key on the dashboard to connect a new bot.`,
    });
  },
};
