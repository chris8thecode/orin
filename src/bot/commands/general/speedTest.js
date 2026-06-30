import { performance } from 'perf_hooks';

export const speedtestCommand = {
  name: 'speedtest',
  aliases: ['speed'],
  description: 'Run a speed test',

  async execute(orin, message, args) {
    const jid = message.key.remoteJid;

    await orin.sendMessage(jid, { text: '⚡ Running speed test...' });

    const sendStart = performance.now();
    const testMsg = await orin.sendMessage(jid, {
      text: '📤 Testing send speed...',
    });
    const sendTime = (performance.now() - sendStart).toFixed(2);

    const memUsage = process.memoryUsage();
    const memUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const memTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

    const results = `
⚡ *ORIN SPEED TEST* ⚡

📤 *Send Speed:* ${sendTime}ms
💾 *Memory Used:* ${memUsed}MB / ${memTotal}MB
🖥️ *Platform:* ${process.platform}
📦 *Node Version:* ${process.version}

✅ Test completed!
        `.trim();

    await orin.sendMessage(jid, { text: results });
  },
};
