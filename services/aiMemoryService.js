const { createSqliteDatabase } = require('../infrastructure/database/sqliteDatabase');

let defaultMemoryService = null;

function getAIMemoryService(options = {}) {
    if (!defaultMemoryService) {
        defaultMemoryService = createAIMemoryService(options);
    }

    return defaultMemoryService;
}

function createAIMemoryService(options = {}) {
    const maxMessages = Math.max(1, Number(options.maxMessages || 10));
    const maxChars = Math.max(1, Number(options.maxChars || 1000));
    const fallbackConversations = new Map();
    const database = createMemoryDatabase(options);
    const statements = database ? createStatements(database.client) : null;

    return {
        getHistory(chatId) {
            if (statements) {
                try {
                    const rows = statements.getHistory.all(chatId, maxMessages).reverse();
                    return limitHistoryChars(rows.map(toHistoryItem), maxChars);
                } catch (error) {
                    console.error('[AI_MEMORY] getHistory failed, using fallback:', error.message);
                }
            }

            return limitHistoryChars([...(fallbackConversations.get(chatId) || [])], maxChars);
        },

        addMessage(chatId, senderId, role, content) {
            const message = normalizeMessageArgs(senderId, role, content);
            const safeContent = trimContent(message.content, maxChars);
            if (!chatId || !message.role || !safeContent) return this.getHistory(chatId);

            if (statements) {
                try {
                    statements.addMessage.run({
                        chat_id: chatId,
                        sender_id: message.senderId || '',
                        role: message.role,
                        content: safeContent,
                        created_at: new Date().toISOString(),
                    });
                    this.trimHistory(chatId);
                    return this.getHistory(chatId);
                } catch (error) {
                    console.error('[AI_MEMORY] addMessage failed, using fallback:', error.message);
                }
            }

            addFallbackMessage(fallbackConversations, chatId, {
                senderId: message.senderId || '',
                role: message.role,
                content: safeContent,
            }, maxMessages, maxChars);
            return this.getHistory(chatId);
        },

        clearHistory(chatId) {
            if (statements) {
                try {
                    statements.clearHistory.run(chatId);
                } catch (error) {
                    console.error('[AI_MEMORY] clearHistory failed:', error.message);
                }
            }

            fallbackConversations.delete(chatId);
        },

        clear(chatId) {
            this.clearHistory(chatId);
        },

        trimHistory(chatId) {
            if (statements) {
                try {
                    statements.trimHistory.run(chatId, chatId, maxMessages);
                } catch (error) {
                    console.error('[AI_MEMORY] trimHistory failed:', error.message);
                }
            }

            const fallbackHistory = fallbackConversations.get(chatId);
            if (fallbackHistory) {
                fallbackConversations.set(chatId, limitHistoryChars(fallbackHistory.slice(-maxMessages), maxChars));
            }
        },
    };
}

function createMemoryDatabase(options) {
    if (options.persistent === false) return null;

    try {
        if (options.database?.client) return options.database;
        if (options.databasePath) return createSqliteDatabase(options.databasePath);
    } catch (error) {
        console.error('[AI_MEMORY] SQLite init failed, using fallback memory:', error.message);
    }

    return null;
}

function createStatements(db) {
    return {
        getHistory: db.prepare(`
            SELECT sender_id, role, content, created_at
            FROM ai_messages
            WHERE chat_id = ?
            ORDER BY id DESC
            LIMIT ?
        `),
        addMessage: db.prepare(`
            INSERT INTO ai_messages (chat_id, sender_id, role, content, created_at)
            VALUES (@chat_id, @sender_id, @role, @content, @created_at)
        `),
        clearHistory: db.prepare('DELETE FROM ai_messages WHERE chat_id = ?'),
        trimHistory: db.prepare(`
            DELETE FROM ai_messages
            WHERE chat_id = ?
              AND id NOT IN (
                  SELECT id
                  FROM ai_messages
                  WHERE chat_id = ?
                  ORDER BY id DESC
                  LIMIT ?
              )
        `),
    };
}

function normalizeMessageArgs(senderId, role, content) {
    if (content === undefined) {
        return {
            senderId: '',
            role: normalizeRole(senderId),
            content: role,
        };
    }

    return {
        senderId: String(senderId || '').trim(),
        role: normalizeRole(role),
        content,
    };
}

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return ['user', 'assistant', 'system'].includes(normalized) ? normalized : 'user';
}

function toHistoryItem(row) {
    return {
        role: normalizeRole(row.role),
        content: trimContent(row.content, Number.MAX_SAFE_INTEGER),
    };
}

function addFallbackMessage(conversations, chatId, message, maxMessages, maxChars) {
    const history = conversations.get(chatId) || [];
    const nextHistory = limitHistoryChars([...history, message].slice(-maxMessages), maxChars);
    conversations.set(chatId, nextHistory);
}

function limitHistoryChars(history, maxChars) {
    const result = [];
    let totalChars = 0;

    for (const item of [...history].reverse()) {
        const content = trimContent(item.content, maxChars);
        if (!content) continue;

        const nextTotal = totalChars + content.length;
        if (result.length && nextTotal > maxChars) break;

        result.unshift({
            role: normalizeRole(item.role),
            content,
        });
        totalChars = nextTotal;
    }

    return result;
}

function trimContent(content, maxChars) {
    const text = String(content || '').trim();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
}

module.exports = {
    createAIMemoryService,
    getAIMemoryService,
};