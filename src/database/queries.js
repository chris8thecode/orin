import db from './index.js';
import { getTimestamps } from '../utils/helpers.js';

export function addConnection(phoneNumber, sessionFolder) {
  const now = Date.now();
  const stmt = db.prepare(`
        INSERT INTO connections (phone_number, connected_at, last_seen, is_active, session_folder)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(phone_number) DO UPDATE SET
            last_seen = ?,
            is_active = 1,
            session_folder = ?
    `);
  return stmt.run(phoneNumber, now, now, sessionFolder, now, sessionFolder);
}

export function updateConnectionStatus(phoneNumber, isActive) {
  const stmt = db.prepare(`
        UPDATE connections SET is_active = ?, last_seen = ? WHERE phone_number = ?
    `);
  return stmt.run(isActive ? 1 : 0, Date.now(), phoneNumber);
}

export function getActiveConnections() {
  const stmt = db.prepare('SELECT * FROM connections WHERE is_active = 1');
  return stmt.all();
}

export function getConnectionStats() {
  const { startOfDay, startOfWeek, startOfMonth, startOfYear } = getTimestamps();
  const now = Date.now();

  const activeNow = db
    .prepare('SELECT COUNT(*) as count FROM connections WHERE is_active = 1')
    .get();
  const today = db
    .prepare('SELECT COUNT(*) as count FROM connections WHERE connected_at >= ?')
    .get(startOfDay);
  const thisWeek = db
    .prepare('SELECT COUNT(*) as count FROM connections WHERE connected_at >= ?')
    .get(startOfWeek);
  const thisMonth = db
    .prepare('SELECT COUNT(*) as count FROM connections WHERE connected_at >= ?')
    .get(startOfMonth);
  const thisYear = db
    .prepare('SELECT COUNT(*) as count FROM connections WHERE connected_at >= ?')
    .get(startOfYear);
  const total = db.prepare('SELECT COUNT(*) as count FROM connections').get();

  return {
    activeNow: activeNow.count,
    today: today.count,
    thisWeek: thisWeek.count,
    thisMonth: thisMonth.count,
    thisYear: thisYear.count,
    total: total.count,
  };
}

export function createPasskey(passkey, expiresAt) {
  const stmt = db.prepare(`
        INSERT INTO passkeys (passkey, created_at, expires_at)
        VALUES (?, ?, ?)
    `);
  return stmt.run(passkey, Date.now(), expiresAt);
}

export function validateAndUsePasskey(passkey, phoneNumber) {
  const now = Date.now();
  const stmt = db.prepare(`
        SELECT * FROM passkeys 
        WHERE passkey = ? AND expires_at > ? AND used_by IS NULL
    `);
  const key = stmt.get(passkey, now);

  if (key) {
    const updateStmt = db.prepare(`
            UPDATE passkeys SET used_by = ?, used_at = ? WHERE id = ?
        `);
    updateStmt.run(phoneNumber, now, key.id);
    return true;
  }
  return false;
}

export function getValidPasskeys() {
  const stmt = db.prepare('SELECT passkey FROM passkeys WHERE expires_at > ? AND used_by IS NULL');
  return new Set(stmt.all(Date.now()).map((p) => p.passkey));
}

export function getAllPasskeys() {
  const stmt = db.prepare('SELECT * FROM passkeys ORDER BY created_at DESC LIMIT 100');
  return stmt.all();
}

export function incrementDailyConnections() {
  const today = new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
        INSERT INTO stats (date, connections_count)
        VALUES (?, 1)
        ON CONFLICT(date) DO UPDATE SET
            connections_count = connections_count + 1
    `);
  return stmt.run(today);
}

export function storeMessage(msg) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO stored_messages
      (message_id, session_phone, remote_jid, participant, from_me, text_content,
       media_type, media_key, direct_path, mime_type, file_name, timestamp, push_name, group_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    msg.messageId,
    msg.sessionPhone,
    msg.remoteJid,
    msg.participant ?? null,
    msg.fromMe ? 1 : 0,
    msg.textContent ?? null,
    msg.mediaType ?? null,
    msg.mediaKey ?? null,
    msg.directPath ?? null,
    msg.mimeType ?? null,
    msg.fileName ?? null,
    msg.timestamp,
    msg.pushName ?? null,
    msg.groupName ?? null,
  );
}

export function markMessageDeleted(messageId) {
  const stmt = db.prepare(`UPDATE stored_messages SET is_deleted = 1 WHERE message_id = ?`);
  return stmt.run(messageId);
}

export function getStoredMessage(messageId) {
  const stmt = db.prepare(`SELECT * FROM stored_messages WHERE message_id = ?`);
  return stmt.get(messageId);
}

export function getRecentMessages(sessionPhone, remoteJid, limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM stored_messages
    WHERE session_phone = ? AND remote_jid = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(sessionPhone, remoteJid, limit);
}

export function getRecentChats(sessionPhone, limit = 30) {
  const stmt = db.prepare(`
    SELECT
      remote_jid,
      MAX(timestamp) as last_timestamp,
      (SELECT text_content FROM stored_messages m2
       WHERE m2.remote_jid = m1.remote_jid AND m2.session_phone = m1.session_phone
       ORDER BY m2.timestamp DESC LIMIT 1) as last_text,
      (SELECT push_name FROM stored_messages m2
       WHERE m2.remote_jid = m1.remote_jid AND m2.session_phone = m1.session_phone
       AND push_name IS NOT NULL AND remote_jid NOT LIKE '%@g.us'
       ORDER BY m2.timestamp DESC LIMIT 1) as push_name,
      (SELECT group_name FROM stored_messages m2
       WHERE m2.remote_jid = m1.remote_jid AND m2.session_phone = m1.session_phone
       AND group_name IS NOT NULL
       ORDER BY m2.timestamp DESC LIMIT 1) as group_name
    FROM stored_messages m1
    WHERE session_phone = ?
    GROUP BY remote_jid
    ORDER BY last_timestamp DESC
    LIMIT ?
  `);
  return stmt.all(sessionPhone, limit);
}
