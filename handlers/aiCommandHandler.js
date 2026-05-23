const config = require('../config');
const { parseAICommand } = require('../parsers/aiParser');
const { createSqliteDatabase } = require('../infrastructure/database/sqliteDatabase');
const { createAISettingsService } = require('../services/aiSettingsService');

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

    if (isGroup) {
        const isAdmin = await isGroupAdmin(sock, chatId, senderId);
        if (!isAdmin) {
            await reply(sock, message, 'Command `.ai on/off` hanya bisa digunakan admin grup.');
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
