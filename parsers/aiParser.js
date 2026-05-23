function parseAICommand(text) {
    const match = String(text || '').trim().match(/^\.ai\s+(on|off)$/i);
    if (!match) return null;

    return {
        action: match[1].toLowerCase(),
        enabled: match[1].toLowerCase() === 'on',
    };
}

module.exports = {
    parseAICommand,
};
