function createGroqProvider(options = {}) {
    const apiKey = options.apiKey || '';
    const model = options.model || 'llama-3.3-70b-versatile';

    return {
        name: 'groq',

        isConfigured() {
            return Boolean(apiKey);
        },

        async generateReply({ systemPrompt, history = [], text, senderId, chatId }) {
            if (!apiKey) {
                throw providerError('GROQ_API_KEY belum diisi.', 'missing_api_key');
            }

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: buildOpenAICompatibleMessages({ systemPrompt, history, text, senderId, chatId }),
                    temperature: 0.7,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw normalizeHttpError(response, data, 'groq');
            }

            return data.choices?.[0]?.message?.content?.trim() || 'Maaf, aku belum bisa menjawab itu.';
        },
    };
}

function buildOpenAICompatibleMessages({ systemPrompt, history, text, senderId, chatId }) {
    return [
        { role: 'system', content: systemPrompt },
        ...history.map((item) => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content,
        })),
        {
            role: 'user',
            content: [
                `Chat ID: ${chatId}`,
                `Sender ID: ${senderId}`,
                `Pesan: ${text}`,
            ].join('\n'),
        },
    ];
}

function normalizeHttpError(response, data, provider) {
    const message = data?.error?.message || data?.message || `${provider} API error ${response.status}`;
    const code = response.status === 429 ? 'rate_limit' : 'api_error';
    return providerError(message, code, null, provider);
}

function providerError(message, code, cause = null, provider = 'groq') {
    const error = new Error(message);
    error.code = code;
    error.provider = provider;
    if (cause) error.cause = cause;
    return error;
}

module.exports = {
    createGroqProvider,
    buildOpenAICompatibleMessages,
};
