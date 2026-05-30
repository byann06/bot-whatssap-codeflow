const config = require('../config');
const { parseAICommand } = require('../parsers/aiParser');
const { createSqliteDatabase } = require('../infrastructure/database/sqliteDatabase');
const { createAISettingsService } = require('../services/aiSettingsService');
const { getAIMemoryService } = require('../services/aiMemoryService');

let databaseInstance = null;
let settingsService = null;

function getAISettingsService() {
    if (!settingsService) {
        databaseInstance = createSqliteDatabase(config.ai.databasePath);
        settingsService = createAISettingsService(databaseInstance);
    }

    return settingsService;
}

async function handleAICommand(sock, message, text) {
    const command = parseAICommand(text);
    if (!command) return false;

    const chatId = message.key.remoteJid || '';
    const senderId = message.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');

    if (command.action === 'memory_clear') {
        if (isGroup) {
            const isAdmin = isOwnerId(senderId) || await isGroupAdmin(sock, chatId, senderId);
            if (!isAdmin) {
                await reply(sock, message, 'Command `.ai memory clear` hanya bisa digunakan admin grup atau owner.');
                return true;
            }
        }

        getAIMemoryService({
            maxMessages: config.ai.memoryMaxMessages,
            maxChars: config.ai.memoryMaxChars,
            databasePath: config.ai.databasePath,
        }).clearHistory(chatId);
        await reply(sock, message, 'Memory Yanverse untuk chat ini sudah dibersihkan.');
        return true;
    }

    if (isGroup) {
        const isAdmin = isOwnerId(senderId) || await isGroupAdmin(sock, chatId, senderId);
        if (!isAdmin) {
            await reply(sock, message, 'Command `.ai on/off` hanya bisa digunakan admin grup atau owner.');
            return true;
        }

        getAISettingsService().setGroupAI(chatId, command.enabled);
        await reply(sock, message, `AI chat grup ${command.enabled ? 'aktif' : 'nonaktif'}.`);
        return true;
    }

    getAISettingsService().setUserAI(senderId, command.enabled);
    await reply(sock, message, `AI chat pribadi ${command.enabled ? 'aktif' : 'nonaktif'}.`);
    return true;
}

async function isGroupAdmin(sock, groupId, senderId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const normalizedSender = normalizeParticipantId(senderId);
        const participant = metadata.participants.find((item) => {
            const ids = [
                item.id,
                item.jid,
                item.lid,
                item.phoneNumber,
            ].filter(Boolean).map(normalizeParticipantId);

            return ids.includes(normalizedSender);
        });

        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Failed to check group admin for AI command:', error.message);
        return false;
    }
}

function isOwnerId(senderId) {
    const senderKeys = getComparableParticipantIds(senderId);
    const ownerKeys = [
        ...config.roles.adminLid,
        ...config.roles.adminPhone,
    ].flatMap(getComparableParticipantIds);

    return senderKeys.some((id) => ownerKeys.includes(id));
}

function getComparableParticipantIds(value) {
    const normalized = normalizeParticipantId(value);
    const bare = normalized.replace(/@(s\.whatsapp\.net|lid)$/i, '');
    return [normalized, bare].filter(Boolean);
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
    handleAICommand,
    getAISettingsService,
};
