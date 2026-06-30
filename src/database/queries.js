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
