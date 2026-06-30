import { extractId, isSameJid, formatPhoneJid } from '../../../utils/helpers.js';

export const kickCommand = {
  name: 'kick',
  aliases: ['remove'],
  description: 'Kick a member from group',
  adminOnly: true,
  groupOnly: true,

  async execute(orin, message, args, groupMetadata) {
    const jid = message.key.remoteJid;
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const senderJid = message.key.participant || message.key.remoteJid;
    const isAdmin = groupMetadata.participants.some((p) => isSameJid(p.id, senderJid) && p.admin);

    if (!isAdmin) {
      return orin.sendMessage(jid, {
        text: '❌ Only admins can use this command!',
      });
    }

    const targets = [...mentioned];
    if (args.length > 0 && targets.length === 0) {
      const phoneJid = formatPhoneJid(args[0]);
      if (phoneJid) targets.push(phoneJid);
    }

    if (targets.length === 0) {
      return orin.sendMessage(jid, {
        text: '❌ Please mention someone or provide a phone number to kick!',
      });
    }

    try {
      await orin.groupParticipantsUpdate(jid, targets, 'remove');
      await orin.sendMessage(jid, {
        text: `✅ Kicked ${targets.length} member(s) successfully!`,
      });
    } catch (error) {
      await orin.sendMessage(jid, { text: '❌ Failed to kick member(s)!' });
    }
  },
};
