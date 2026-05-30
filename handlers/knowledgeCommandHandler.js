const config = require('../config');
const { getKnowledgeStats } = require('../services/knowledgeStatsService');
const { searchKnowledgeSections } = require('../services/knowledgeService');

function parseKnowledgeCommand(text) {
    const normalized = String(text || '').trim();
    if (/^\.knowledge\s+stats$/i.test(normalized)) {
        return { type: 'stats' };
    }

    const searchMatch = normalized.match(/^\.knowledge\s+search(?:\s+(.+))?$/i);
    if (searchMatch) {
        return { type: 'search', keyword: (searchMatch[1] || '').trim() };
    }

    return null;
}

function parseKnowledgeStatsCommand(text) {
    const command = parseKnowledgeCommand(text);
    return command?.type === 'stats';
}

async function handleKnowledgeCommand(sock, message, text) {
    const command = parseKnowledgeCommand(text);
    if (!command) return false;

    const chatId = message.key.remoteJid || '';
    const senderId = message.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');
    const isOwner = isOwnerId(senderId);

    if (isGroup) {
        const isAdmin = isOwner || await isGroupAdmin(sock, chatId, senderId);
        if (!isAdmin) {
            await reply(sock, message, 'Command `.knowledge stats/search` hanya bisa digunakan admin grup atau owner.');
            return true;
        }
    } else if (!isOwner) {
        await reply(sock, message, 'Command `.knowledge stats/search` hanya bisa digunakan owner.');
        return true;
    }

    if (command.type === 'stats') {
        const stats = getKnowledgeStats({ rootDir: config.knowledgeDir });
        await reply(sock, message, formatStatsForWhatsApp(stats));
        return true;
    }

    if (command.type === 'search') {
        if (!command.keyword) {
            await reply(sock, message, 'Cara pakai: `.knowledge search <keyword>`\nContoh: `.knowledge search medig`');
            return true;
        }

        const results = searchKnowledgeSections(config.knowledgeDir, command.keyword, { limit: 5 });
        await reply(sock, message, formatSearchResultsForWhatsApp(command.keyword, results));
        return true;
    }

    return false;
}

function formatStatsForWhatsApp(stats) {
    return [
        '📚 Knowledge Stats',
        '',
        `Knowledge Files: ${stats.markdownFiles}`,
        `Sections: ${stats.sections}`,
        `Command Files: ${stats.commandFiles}`,
        `General Files: ${stats.generalKnowledgeFiles}`,
        '',
        `Status: ${stats.status}`,
        '',
        'Categories:',
        ...stats.categories.map((category) => `- ${category}`),
    ].join('\n');
}

function formatSearchResultsForWhatsApp(keyword, results) {
    if (!results.length) {
        return `🔎 Knowledge Search: ${keyword}\n\nTidak ada knowledge yang cocok.`;
    }

    const lines = [`🔎 Knowledge Search: ${keyword}`];
    results.forEach((result, index) => {
        lines.push(
            '',
            `${index + 1}. ${result.source}`,
            `Section: ${result.title || '-'}`,
            `Snippet: ${result.snippet || '-'}`,
        );
    });

    return lines.join('\n');
}

async function isGroupAdmin(sock, groupId, senderId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const normalizedSender = normalizeParticipantId(senderId);
        const participant = metadata.participants.find((item) => {
            const ids = [item.id, item.jid, item.lid, item.phoneNumber]
                .filter(Boolean)
                .map(normalizeParticipantId);
            return ids.includes(normalizedSender);
        });

        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Failed to check group admin for knowledge command:', error.message);
        return false;
    }
}

function isOwnerId(senderId) {
    const normalizedSender = normalizeParticipantId(senderId);
    return config.roles.adminLid
        .map(normalizeParticipantId)
        .includes(normalizedSender);
}

function normalizeParticipantId(value) {
    return String(value || '')
        .replace(/:\d+(?=@)/, '')
        .trim();
}

async function reply(sock, message, text) {
    return sock.sendMessage(
        message.key.remoteJid,
        { text },
        { quoted: message },
    );
}

module.exports = {
    handleKnowledgeCommand,
    parseKnowledgeCommand,
    parseKnowledgeStatsCommand,
    formatStatsForWhatsApp,
    formatSearchResultsForWhatsApp,
    isOwnerId,
};