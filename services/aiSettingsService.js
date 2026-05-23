function createAISettingsService(database) {
    const db = database.client;

    const statements = {
        ensureGroup: db.prepare(`
            INSERT OR IGNORE INTO groups (group_id)
            VALUES (?)
        `),
        getGroup: db.prepare(`
            SELECT group_id, ai_enabled, settings_json, created_at, updated_at
            FROM groups
            WHERE group_id = ?
        `),
        updateGroupAI: db.prepare(`
            UPDATE groups
            SET ai_enabled = ?, updated_at = datetime('now')
            WHERE group_id = ?
        `),
        updateGroupSettings: db.prepare(`
            UPDATE groups
            SET settings_json = ?, updated_at = datetime('now')
            WHERE group_id = ?
        `),
        ensureUser: db.prepare(`
            INSERT OR IGNORE INTO users (user_id)
            VALUES (?)
        `),
        getUser: db.prepare(`
            SELECT user_id, ai_enabled, settings_json, created_at, updated_at
            FROM users
            WHERE user_id = ?
        `),
        updateUserAI: db.prepare(`
            UPDATE users
            SET ai_enabled = ?, updated_at = datetime('now')
            WHERE user_id = ?
        `),
        updateUserSettings: db.prepare(`
            UPDATE users
            SET settings_json = ?, updated_at = datetime('now')
            WHERE user_id = ?
        `),
    };

    return {
        getGroupSettings(groupId) {
            statements.ensureGroup.run(groupId);
            return mapGroupRow(statements.getGroup.get(groupId));
        },

        setGroupAI(groupId, enabled) {
            statements.ensureGroup.run(groupId);
            statements.updateGroupAI.run(enabled ? 1 : 0, groupId);
            return mapGroupRow(statements.getGroup.get(groupId));
        },

        setGroupSetting(groupId, key, value) {
            statements.ensureGroup.run(groupId);
            const current = mapGroupRow(statements.getGroup.get(groupId));
            const nextSettings = { ...current.settings, [key]: value };

            statements.updateGroupSettings.run(JSON.stringify(nextSettings), groupId);
            return mapGroupRow(statements.getGroup.get(groupId));
        },

        getUserSettings(userId) {
            statements.ensureUser.run(userId);
            return mapUserRow(statements.getUser.get(userId));
        },

        setUserAI(userId, enabled) {
            statements.ensureUser.run(userId);
            statements.updateUserAI.run(enabled ? 1 : 0, userId);
            return mapUserRow(statements.getUser.get(userId));
        },

        setUserSetting(userId, key, value) {
            statements.ensureUser.run(userId);
            const current = mapUserRow(statements.getUser.get(userId));
            const nextSettings = { ...current.settings, [key]: value };

            statements.updateUserSettings.run(JSON.stringify(nextSettings), userId);
            return mapUserRow(statements.getUser.get(userId));
        },
    };
}

function mapGroupRow(row) {
    return {
        groupId: row.group_id,
        aiEnabled: Boolean(row.ai_enabled),
        settings: parseSettings(row.settings_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapUserRow(row) {
    return {
        userId: row.user_id,
        aiEnabled: Boolean(row.ai_enabled),
        settings: parseSettings(row.settings_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function parseSettings(value) {
    try {
        return JSON.parse(value || '{}');
    } catch {
        return {};
    }
}

module.exports = {
    createAISettingsService,
};
