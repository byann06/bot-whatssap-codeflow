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
    `);
}

module.exports = {
    createSqliteDatabase,
};
