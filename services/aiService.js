const { createAIProviderRouter } = require('./ai/aiProviderRouter');
const { createGeminiProvider } = require('./ai/providers/geminiProvider');
const { createGroqProvider } = require('./ai/providers/groqProvider');
const { createOpenRouterProvider } = require('./ai/providers/openrouterProvider');

const DEFAULT_SYSTEM_PROMPT = [
    'Nama kamu adalah AI Bot Code Flow.',
    'Kamu berjalan di WhatsApp bot komunitas Code Flow.',
    'Gunakan bahasa Indonesia sehari-hari.',
    'Jawaban harus singkat, jelas, dan cocok dibaca di WhatsApp.',
    'Jangan terlalu formal dan jangan terdengar seperti customer service.',
    'Jangan mengaku sebagai manusia. Kamu boleh bilang kamu AI/bot kalau relevan.',
    'Bantu anggota dan pengurus Code Flow tanpa mengganggu command bot utama.',
].join('\n');

function createAIService(options = {}) {
    const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const router = options.router || createAIProviderRouter({
        primaryProvider: options.primaryProvider || 'gemini',
        fallbackProviders: options.fallbackProviders || [],
        providers: [
            createGeminiProvider({
                apiKey: options.geminiApiKey || options.apiKey || '',
                model: options.geminiModel || options.model || 'gemini-2.5-flash',
            }),
            createGroqProvider({
                apiKey: options.groqApiKey || '',
                model: options.groqModel || 'llama-3.3-70b-versatile',
            }),
            createOpenRouterProvider({
                apiKey: options.openRouterApiKey || '',
                model: options.openRouterModel || 'openrouter/free',
            }),
        ],
    });

    return {
        isConfigured() {
            return router.isConfigured();
        },

        async generateReply({ text, senderId, chatId, history = [] }) {
            const result = await router.generateReply({
                systemPrompt,
                text,
                senderId,
                chatId,
                history,
            });

            return result.text?.trim() || 'Maaf, aku belum bisa menjawab itu.';
        },

        async generateReplyWithMeta({ text, senderId, chatId, history = [] }) {
            return router.generateReply({
                systemPrompt,
                text,
                senderId,
                chatId,
                history,
            });
        },
    };
}

module.exports = {
    createAIService,
    DEFAULT_SYSTEM_PROMPT,
};