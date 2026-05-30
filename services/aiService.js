const { createAIProviderRouter } = require('./ai/aiProviderRouter');
const { createGeminiProvider } = require('./ai/providers/geminiProvider');
const { createGroqProvider } = require('./ai/providers/groqProvider');
const { createOpenRouterProvider } = require('./ai/providers/openrouterProvider');
const { YANVERSE_SYSTEM_PROMPT } = require('./ai/persona');
const { createKnowledgeService } = require('./knowledgeService');

const DEFAULT_SYSTEM_PROMPT = YANVERSE_SYSTEM_PROMPT;

function buildSystemPromptWithKnowledge(systemPrompt, knowledgeContext, adminContext = '') {
    const blocks = [systemPrompt];

    if (knowledgeContext) {
        blocks.push(
            'Gunakan knowledge lokal berikut hanya jika relevan dengan pertanyaan user. Jika tidak relevan, abaikan.',
            knowledgeContext,
        );
    }

    if (adminContext) {
        blocks.push(
            'Gunakan data administrasi read-only berikut hanya untuk menjawab pertanyaan admin/pengurus yang relevan. Jangan klaim bisa mengedit, menghapus, menulis, atau mengubah Google Sheets.',
            adminContext,
        );
    }

    return blocks.join('\n\n');
}

function createAIService(options = {}) {
    const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const knowledgeService = options.knowledgeService || createKnowledgeService({
        rootDir: options.knowledgeDir,
        maxContextChars: options.knowledgeMaxContextChars,
        maxSections: options.knowledgeMaxSections,
    });
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

        async generateReply({ text, senderId, chatId, history = [], adminContext = '' }) {
            const knowledgeContext = knowledgeService.getRelevantContext(text);
            const result = await router.generateReply({
                systemPrompt: buildSystemPromptWithKnowledge(systemPrompt, knowledgeContext, adminContext),
                text,
                senderId,
                chatId,
                history,
            });

            return result.text?.trim() || 'Maaf, aku belum bisa menjawab itu.';
        },

        async generateReplyWithMeta({ text, senderId, chatId, history = [], adminContext = '' }) {
            const knowledgeContext = knowledgeService.getRelevantContext(text);
            return router.generateReply({
                systemPrompt: buildSystemPromptWithKnowledge(systemPrompt, knowledgeContext, adminContext),
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
    buildSystemPromptWithKnowledge,
};
