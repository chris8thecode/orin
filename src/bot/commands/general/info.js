import { formatUptime } from '../../../utils/helpers.js';
import { config } from '../../../config.js';

const startTime = Date.now();

export const infoCommand = {
  name: 'info',
  aliases: ['info'],
  description: 'Show bot information',

  async execute(orin, message, args) {
    const uptime = formatUptime((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();

    const infoText = `
╔══════════════════════╗
║    ⚡ *ORIN INFO* ⚡   ║
╠══════════════════════╣

🤖 *Bot Name:* Orin
📌 *Version:* 1.0.0
⏱️ *Uptime:* ${uptime}
💾 *Memory:* ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
🖥️ *Platform:* ${process.platform}
📦 *Node:* ${process.version}

📞 *Admin Contact:*
${config.adminContact}

╚══════════════════════╝
        `.trim();

    await orin.sendMessage(message.key.remoteJid, { text: infoText });
  },
};

export const runtimeCommand = {
  name: 'runtime',
  aliases: ['uptime'],
  description: 'Show bot uptime',

  async execute(orin, message, args) {
    const uptime = formatUptime((Date.now() - startTime) / 1000);
    await orin.sendMessage(message.key.remoteJid, {
      text: `⏱️ *Bot Uptime:* ${uptime}`,
    });
  },
};
