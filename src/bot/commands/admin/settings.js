export const groupInfoCommand = {
  name: 'groupinfo',
  aliases: ['ginfo'],
  description: 'Show group information',
  groupOnly: true,

  async execute(orin, message, args, groupMetadata) {
    const jid = message.key.remoteJid;

    const admins = groupMetadata.participants.filter((p) => p.admin);
    const superAdmins = admins.filter((p) => p.admin === 'superadmin');
    const regularAdmins = admins.filter((p) => p.admin === 'admin');

    const infoText = `
╔══════════════════════╗
║   📊 *GROUP INFO*    ║
╠══════════════════════╣

📛 *Name:* ${groupMetadata.subject}
🆔 *ID:* ${jid}
👥 *Members:* ${groupMetadata.participants.length}
👑 *Super Admins:* ${superAdmins.length}
🛡️ *Admins:* ${regularAdmins.length}
📝 *Description:*
${groupMetadata.desc || 'No description'}

📅 *Created:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}

╚══════════════════════╝
        `.trim();

    await orin.sendMessage(jid, { text: infoText });
  },
};
