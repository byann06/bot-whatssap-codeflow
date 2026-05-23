function createAIProviderRouter(options = {}) {
    const providers = new Map((options.providers || []).map((provider) => [provider.name, provider]));
    const providerOrder = buildProviderOrder(options.primaryProvider, options.fallbackProviders);
    const logger = options.logger || console;

    return {
        isConfigured() {
            return providerOrder.some((name) => providers.get(name)?.isConfigured());
        },

        getProviderOrder() {
            return [...providerOrder];
        },

        async generateReply(payload) {
            const failures = [];

            for (let index = 0; index < providerOrder.length; index += 1) {
                const providerName = providerOrder[index];
                const provider = providers.get(providerName);
                if (!provider) {
                    failures.push(`${providerName}: provider tidak tersedia`);
                    logFallback(logger, providerName, getNextProviderName(providerOrder, index));
                    continue;
                }

                if (!provider.isConfigured()) {
                    failures.push(`${providerName}: API key belum diisi`);
                    logFallback(logger, provider.name, getNextProviderName(providerOrder, index));
                    continue;
                }

                try {
                    const text = await provider.generateReply(payload);
                    logger.log(`[AI] provider=${provider.name}`);
                    return {
                        text,
                        provider: provider.name,
                    };
                } catch (error) {
                    failures.push(`${provider.name}: ${error.message || String(error)}`);
                    if (!isFallbackError(error)) {
                        break;
                    }

                    logFallback(logger, provider.name, getNextProviderName(providerOrder, index));
                }
            }

            const error = new Error(`Semua provider AI gagal. ${failures.join(' | ')}`);
            error.code = 'all_providers_failed';
            error.failures = failures;
            throw error;
        },
    };
}

function buildProviderOrder(primaryProvider = 'gemini', fallbackProviders = []) {
    const seen = new Set();
    return [primaryProvider, ...fallbackProviders]
        .map((name) => String(name || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((name) => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        });
}

function getNextProviderName(providerOrder, currentIndex) {
    return providerOrder[currentIndex + 1] || '';
}

function logFallback(logger, failedProvider, nextProvider) {
    if (!nextProvider) return;
    logger.log(`[AI] ${failedProvider} gagal, fallback ke ${nextProvider}`);
}

function isFallbackError(error) {
    const code = error?.code || '';
    return ['missing_api_key', 'rate_limit', 'api_error'].includes(code) || !code;
}

module.exports = {
    createAIProviderRouter,
    buildProviderOrder,
    isFallbackError,
};