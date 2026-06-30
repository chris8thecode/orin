import { containsLink, extractId } from '../utils/helpers.js';

export async function handleAntiSpam(orin, message, groupMetadata) {
  const msg = message.message;

  const text =
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    '';

  if (!containsLink(text)) return false;

  const sender = message.key.participant || message.key.remoteJid;

  const admins = groupMetadata.participants
    .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
    .map((p) => p.id);

  if (admins.includes(sender)) return false;

  const botId = orin.user?.id;
  if (!admins.includes(botId)) return false;

  try {
    await orin.sendMessage(message.key.remoteJid, { delete: message.key });

    await orin.sendMessage(message.key.remoteJid, {
      text: `⚠️ @${sender.split('@')[0]}, links are not allowed in this group!`,
      mentions: [sender],
    });

    return true;
  } catch (err) {
    console.error('Failed to delete spam message:', err);
    return false;
  }
}
