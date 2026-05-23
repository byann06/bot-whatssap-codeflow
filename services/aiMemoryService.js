function createAIMemoryService(options = {}) {
    const maxMessages = Number(options.maxMessages || 10);
    const maxChars = Number(options.maxChars || 1000);
    const conversations = new Map();

    return {
        getHistory(chatId) {
            return [...(conversations.get(chatId) || [])];
        },

        addMessage(chatId, role, content) {
            const history = conversations.get(chatId) || [];
            const nextHistory = [
                ...history,
                {
                    role,
                    content: trimContent(content, maxChars),
                },
            ].slice(-maxMessages);

            conversations.set(chatId, nextHistory);
            return [...nextHistory];
        },

        clear(chatId) {
            conversations.delete(chatId);
        },
    };
}

function trimContent(content, maxChars) {
    const text = String(content || '').trim();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
}

module.exports = {
    createAIMemoryService,
};
