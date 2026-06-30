import { Database } from 'bun:sqlite';

const dbPath = `${import.meta.dir}/../../orin.db`;
const db = new Database(dbPath);

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT UNIQUE NOT NULL,
        connected_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        session_folder TEXT
    );

    CREATE TABLE IF NOT EXISTS passkeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passkey TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_by TEXT,
        used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        connections_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_type TEXT,
        timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_connections_active ON connections(is_active);
    CREATE INDEX IF NOT EXISTS idx_connections_connected_at ON connections(connected_at);
    CREATE INDEX IF NOT EXISTS idx_passkeys_passkey ON passkeys(passkey);
`);

export default db;
