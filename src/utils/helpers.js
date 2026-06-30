import {
  jidEncode,
  jidDecode,
  jidNormalizedUser,
  areJidsSameUser,
  isJidGroup,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidNewsletter,
  isJidBot,
  isJidMetaAI,
  isPnUser,
  isLidUser,
} from 'baileys';

export function formatNumber(input) {
  return (input || '').replace(/[^0-9]/g, '');
}

export function formatPhoneJid(number) {
  const cleaned = formatNumber(number);
  return jidEncode(cleaned, 's.whatsapp.net');
}

export function decodedJid(jid) {
  return jidDecode(jid);
}

export function extractId(jid) {
  const decoded = jidDecode(jid);
  return decoded?.user || '';
}

export function isSameJid(a, b) {
  return areJidsSameUser(a, b);
}

export function isGroupJid(jid) {
  return isJidGroup(jid);
}

export function normalizeJid(jid) {
  return jidNormalizedUser(jid);
}

export const JidGuards = {
  isGroup: isJidGroup,
  isBroadcast: isJidBroadcast,
  isStatusBroadcast: isJidStatusBroadcast,
  isNewsletter: isJidNewsletter,
  isBot: isJidBot,
  isMetaAI: isJidMetaAI,
  isPnUser: isPnUser,
  isLidUser: isLidUser,
  isHuman: (jid) => !isJidBot(jid) && !isJidMetaAI(jid),
};

export function containsLink(text = '') {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.[^\s]{2,})/gi;
  return urlRegex.test(text);
}

export function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Gets timestamp boundaries for common time periods.
 * Useful for time-range queries in database.
 * @returns {object} Object with startOfDay, startOfWeek, startOfMonth, startOfYear (in ms)
 */
export function getTimestamps() {
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const weekDate = new Date(now);
  weekDate.setDate(now.getDate() - weekDate.getDay());
  weekDate.setHours(0, 0, 0, 0);

  const startOfWeek = weekDate.getTime();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  return { startOfDay, startOfWeek, startOfMonth, startOfYear };
}
