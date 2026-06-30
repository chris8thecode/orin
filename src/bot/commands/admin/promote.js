import { extractId, isSameJid, formatPhoneJid } from '../../../utils/helpers.js';

export const promoteCommand = {
  name: 'promote',
  aliases: ['admin'],
  description: 'Promote member to admin',
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
        text: '❌ Please mention someone or provide a phone number to promote!',
      });
    }

    try {
      await orin.groupParticipantsUpdate(jid, targets, 'promote');
      await orin.sendMessage(jid, {
        text: `✅ Promoted ${targets.length} member(s) to admin!`,
      });
    } catch (error) {
      await orin.sendMessage(jid, { text: '❌ Failed to promote member(s)!' });
    }
  },
};

export const demoteCommand = {
  name: 'demote',
  aliases: ['unadmin'],
  description: 'Demote admin to member',
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
        text: '❌ Please mention someone or provide a phone number to demote!',
      });
    }

    try {
      await orin.groupParticipantsUpdate(jid, targets, 'demote');
      await orin.sendMessage(jid, {
        text: `✅ Demoted ${targets.length} admin(s) to member!`,
      });
    } catch (error) {
      await orin.sendMessage(jid, { text: '❌ Failed to demote admin(s)!' });
    }
  },
};
