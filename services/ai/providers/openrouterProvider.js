const { buildOpenAICompatibleMessages } = require('./groqProvider');

function createOpenRouterProvider(options = {}) {
    const apiKey = options.apiKey || '';
    const model = options.model || 'openrouter/free';

    return {
        name: 'openrouter',

        isConfigured() {
            return Boolean(apiKey);
        },

        async generateReply({ systemPrompt, history = [], text, senderId, chatId }) {
            if (!apiKey) {
                throw providerError('OPENROUTER_API_KEY belum diisi.', 'missing_api_key');
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://codeflow.local',
                    'X-Title': 'Code Flow WhatsApp Bot',
                },
                body: JSON.stringify({
                    model,
                    messages: buildOpenAICompatibleMessages({ systemPrompt, history, text, senderId, chatId }),
                    temperature: 0.7,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw normalizeHttpError(response, data);
            }

            return data.choices?.[0]?.message?.content?.trim() || 'Maaf, aku belum bisa menjawab itu.';
        },
    };
}

function normalizeHttpError(response, data) {
    const message = data?.error?.message || data?.message || `OpenRouter API error ${response.status}`;
    const code = response.status === 429 ? 'rate_limit' : 'api_error';
    return providerError(message, code);
}

function providerError(message, code, cause = null) {
    const error = new Error(message);
    error.code = code;
    error.provider = 'openrouter';
    if (cause) error.cause = cause;
    return error;
}

module.exports = {
    createOpenRouterProvider,
};
