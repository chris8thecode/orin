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

    CREATE TABLE IF NOT EXISTS stored_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        session_phone TEXT NOT NULL,
        remote_jid TEXT NOT NULL,
        participant TEXT,
        from_me INTEGER NOT NULL DEFAULT 0,
        text_content TEXT,
        media_type TEXT,
        media_key TEXT,
        direct_path TEXT,
        mime_type TEXT,
        file_name TEXT,
        timestamp INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        push_name TEXT,
        group_name TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_connections_active ON connections(is_active);
    CREATE INDEX IF NOT EXISTS idx_connections_connected_at ON connections(connected_at);
    CREATE INDEX IF NOT EXISTS idx_passkeys_passkey ON passkeys(passkey);
    CREATE INDEX IF NOT EXISTS idx_stored_messages_jid ON stored_messages(remote_jid, session_phone);
    CREATE INDEX IF NOT EXISTS idx_stored_messages_timestamp ON stored_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_stored_messages_id ON stored_messages(message_id);
`);

export default db;
