import { extractId } from '../../../utils/helpers.js';

export const muteCommand = {
  name: 'mute',
  aliases: ['close'],
  description: 'Mute group (admins only can chat)',
  adminOnly: true,
  groupOnly: true,

  async execute(orin, message, args, groupMetadata) {
    const jid = message.key.remoteJid;
    const senderJid = message.key.participant || message.key.remoteJid;
    const senderNumber = extractId(senderJid);

    const admins = groupMetadata.participants.filter((p) => p.admin).map((p) => extractId(p.id));

    if (!admins.includes(senderNumber)) {
      return orin.sendMessage(jid, {
        text: '❌ Only admins can use this command!',
      });
    }

    try {
      await orin.groupSettingUpdate(jid, 'announcement');
      await orin.sendMessage(jid, {
        text: '🔇 Group has been muted! Only admins can send messages.',
      });
    } catch (error) {
      await orin.sendMessage(jid, { text: '❌ Failed to mute group!' });
    }
  },
};

export const unmuteCommand = {
  name: 'unmute',
  aliases: ['open'],
  description: 'Unmute group',
  adminOnly: true,
  groupOnly: true,

  async execute(orin, message, args, groupMetadata) {
    const jid = message.key.remoteJid;
    const senderJid = message.key.participant || message.key.remoteJid;
    const senderNumber = extractId(senderJid);

    const admins = groupMetadata.participants.filter((p) => p.admin).map((p) => extractId(p.id));

    if (!admins.includes(senderNumber)) {
      return orin.sendMessage(jid, {
        text: '❌ Only admins can use this command!',
      });
    }

    try {
      await orin.groupSettingUpdate(jid, 'not_announcement');
      await orin.sendMessage(jid, {
        text: '🔊 Group has been unmuted! Everyone can send messages.',
      });
    } catch (error) {
      await orin.sendMessage(jid, { text: '❌ Failed to unmute group!' });
    }
  },
};
