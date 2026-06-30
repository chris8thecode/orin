export const pingCommand = {
  name: 'ping',
  aliases: ['p'],
  description: 'Check bot latency',

  async execute(orin, message, args) {
    await orin.sendMessage(message.key.remoteJid, {
      text: 'pong',
    });
  },
};
