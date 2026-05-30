const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function createSqliteDatabase(databasePath) {
    if (databasePath === ':memory:') {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initSchema(db);

        return {
            path: ':memory:',
            client: db,
            close() {
                db.close();
            },
        };
    }

    const resolvedPath = path.resolve(databasePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    const db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initSchema(db);

    return {
        path: resolvedPath,
        client: db,
        close() {
            db.close();
        },
    };
}

function initSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS groups (
            group_id TEXT PRIMARY KEY,
            ai_enabled INTEGER NOT NULL DEFAULT 0,
            settings_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            ai_enabled INTEGER NOT NULL DEFAULT 0,
            settings_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ai_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            sender_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_id
            ON ai_messages(chat_id);

        CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at
            ON ai_messages(created_at);
    `);
}

module.exports = {
    createSqliteDatabase,
};
