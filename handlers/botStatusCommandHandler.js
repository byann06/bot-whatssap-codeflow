const config = require('../config');
const { getBotStatus, formatBotStatusForWhatsApp } = require('../services/botStatusService');

function parseBotStatusCommand(text) {
    const normalized = String(text || '').trim();
    return /^\.bot\s+status$/i.test(normalized);
}

async function handleBotStatusCommand(sock, message, text) {
    if (!parseBotStatusCommand(text)) return false;

    const chatId = message.key.remoteJid || '';
    const senderId = message.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');
    const isOwner = isOwnerId(senderId);

    if (isGroup) {
        const isAdmin = isOwner || await isGroupAdmin(sock, chatId, senderId);
        if (!isAdmin) {
            await reply(sock, message, 'Command `.bot status` hanya bisa digunakan admin grup atau owner.');
            return true;
        }
    } else if (!isOwner) {
        await reply(sock, message, 'Command `.bot status` hanya bisa digunakan owner.');
        return true;
    }

    await reply(sock, message, formatBotStatusForWhatsApp(getBotStatus()));
    return true;
}

async function isGroupAdmin(sock, groupId, senderId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const senderKeys = getComparableParticipantIds(senderId);
        const participant = metadata.participants.find((item) => {
            const ids = [item.id, item.jid, item.lid, item.phoneNumber]
                .filter(Boolean)
                .flatMap(getComparableParticipantIds);
            return ids.some((id) => senderKeys.includes(id));
        });

        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Failed to check group admin for bot status command:', error.message);
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
    handleBotStatusCommand,
    parseBotStatusCommand,
    formatBotStatusForWhatsApp,
};