function parseAICommand(text) {
    const normalized = String(text || '').trim();
    if (/^\.ai\s+memory\s+clear$/i.test(normalized)) {
        return { action: 'memory_clear' };
    }

    const match = normalized.match(/^\.ai\s+(on|off)$/i);
    if (!match) return null;

    return {
        action: match[1].toLowerCase(),
        enabled: match[1].toLowerCase() === 'on',
    };
}

module.exports = {
    parseAICommand,
};