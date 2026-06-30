import { config } from '../../../config.js';
import { getAllCommands } from '../index.js';

export const menuCommand = {
  name: 'menu',
  aliases: ['menu'],
  description: 'Show bot menu',

  async execute(orin, message, args) {
    const prefix = config.prefix;
    const commands = getAllCommands();

    const generalCmds = commands
      .filter((cmd) => !cmd.adminOnly)
      .map((cmd) => `║  ${prefix}${cmd.name} - ${cmd.description}`)
      .join('\n');

    const adminCmds = commands
      .filter((cmd) => cmd.adminOnly && !cmd.ownerOnly)
      .map((cmd) => `║  ${prefix}${cmd.name} - ${cmd.description}`)
      .join('\n');

    const ownerCmds = commands
      .filter((cmd) => cmd.ownerOnly)
      .map((cmd) => `║  ${prefix}${cmd.name} - ${cmd.description}`)
      .join('\n');

    const menuText = `
╔══════════════════════╗
║    ⚡ *ORIN* ⚡    ║
╠══════════════════════╣
║                      ║
║  *📌 GENERAL*        ║
${generalCmds}
║                      ║
║  *👥 GROUP ADMIN*    ║
${adminCmds}
║                      ║
║  *👑 OWNER*          ║
${ownerCmds}
║                      ║
║  *ℹ️ INFO*           ║
║  Contact: ${config.adminContact}
║                      ║
╚══════════════════════╝
        `.trim();

    await orin.sendMessage(message.key.remoteJid, { text: menuText });
  },
};
