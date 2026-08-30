import { Cache } from '../utils/cache.js';
import { config } from '../config.js';
import { isGroupJid, isSameJid } from '../utils/helpers.js';
import { getCommand } from './commands/index.js';
import { handleAntiSpam } from './antiSpam.js';

const groupCache = new Cache({ stdTTL: 5 * 60, useClones: false });

function getText(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  );
}

async function safeExecute(command, orin, message, args, metadata) {
  try {
    await command.execute(orin, message, args, metadata);
  } catch (err) {
    console.error(`Command failed:`, err);
  }
}

export async function handleMessage(orin, message) {
  try {
    const sender = message.key.participant || message.key.remoteJid;
    const isOwner = isSameJid(sender, config.ownerNumber);
    if (!message.message || (message.key.fromMe && !isOwner)) return;

    const jid = message.key.remoteJid;
    const text = getText(message);

    if (isGroupJid(jid)) {
      if (!message.key.participant) return;

      let groupMetadata = groupCache.get(jid);
      if (!groupMetadata) {
        groupMetadata = await orin.groupMetadata(jid);
        groupCache.set(jid, groupMetadata);
      }

      const wasSpam = await handleAntiSpam(orin, message, groupMetadata);
      if (wasSpam) return;

      if (!text.startsWith(config.prefix)) return;

      const args = text.slice(config.prefix.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();
      const command = getCommand(commandName);

      if (command && command.groupOnly !== false) {
        if (command.ownerOnly && !isSameJid(sender, config.ownerNumber)) {
          return orin.sendMessage(jid, { text: '❌ Owner only command!' });
        }
        await safeExecute(command, orin, message, args, groupMetadata);
      }
    } else {
      if (!text.startsWith(config.prefix)) return;

      const args = text.slice(config.prefix.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();
      const command = getCommand(commandName);

      if (command && !command.groupOnly) {
        if (command.ownerOnly && !isSameJid(sender, config.ownerNumber)) {
          return orin.sendMessage(jid, { text: '❌ Owner only command!' });
        }
        await safeExecute(command, orin, message, args, null);
      }
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
}

export function getGroupName(jid) {
  const cached = groupCache.get(jid);
  return cached?.subject ?? null;
}

export function setGroupCache(jid, metadata) {
  groupCache.set(jid, metadata);
}

export function setupGroupCacheListeners(orin) {
  orin.ev.on('groups.update', async ([event]) => {
    try {
      const metadata = await orin.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch (e) {
      console.error('Failed to update group cache:', e);
    }
  });

  orin.ev.on('group-participants.update', async (event) => {
    try {
      const metadata = await orin.groupMetadata(event.id);
      groupCache.set(event.id, metadata);
    } catch (e) {
      console.error('Failed to update group cache:', e);
    }
  });
}
