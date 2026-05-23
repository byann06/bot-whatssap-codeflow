const { GoogleGenAI } = require('@google/genai');

function createGeminiProvider(options = {}) {
    const apiKey = options.apiKey || '';
    const model = options.model || 'gemini-2.5-flash';
    const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

    return {
        name: 'gemini',

        isConfigured() {
            return Boolean(client);
        },

        async generateReply({ systemPrompt, history = [], text, senderId, chatId }) {
            if (!client) {
                throw providerError('GEMINI_API_KEY belum diisi.', 'missing_api_key');
            }

            try {
                const response = await client.models.generateContent({
                    model,
                    contents: [
                        ...history.map(toGeminiContent),
                        {
                            role: 'user',
                            parts: [{ text: buildUserPrompt({ text, senderId, chatId }) }],
                        },
                    ],
                    config: {
                        systemInstruction: systemPrompt,
                    },
                });

                return response.text?.trim() || 'Maaf, aku belum bisa menjawab itu.';
            } catch (error) {
                throw normalizeGeminiError(error);
            }
        },
    };
}

function toGeminiContent(item) {
    return {
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
    };
}

function buildUserPrompt({ text, senderId, chatId }) {
    return [
        `Chat ID: ${chatId}`,
        `Sender ID: ${senderId}`,
        `Pesan: ${text}`,
    ].join('\n');
}

function normalizeGeminiError(error) {
    const message = error?.message || String(error);
    const status = error?.status;
    const lowerMessage = message.toLowerCase();

    if (status === 429 || lowerMessage.includes('resource_exhausted') || lowerMessage.includes('quota') || lowerMessage.includes('rate')) {
        return providerError('Quota/rate limit Gemini habis atau belum aktif untuk model ini.', 'rate_limit', error);
    }

    if (status === 400 || status === 401 || status === 403 || lowerMessage.includes('api key')) {
        return providerError('GEMINI_API_KEY tidak valid atau tidak punya akses.', 'api_error', error);
    }

    return providerError(message, 'api_error', error);
}

function providerError(message, code, cause = null) {
    const error = new Error(message);
    error.code = code;
    error.provider = 'gemini';
    if (cause) error.cause = cause;
    return error;
}

module.exports = {
    createGeminiProvider,
};
