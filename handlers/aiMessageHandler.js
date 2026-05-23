const config = require('../config');
const { createAIService } = require('../services/aiService');
const { createAIMemoryService } = require('../services/aiMemoryService');
const { getAISettingsService } = require('./aiCommandHandler');

const LEGACY_COMMANDS = [
    'menu',
    'link',
    'logo',
    'drive auth',
    'sirpai',
    'info',
    'daftar',
    'pemateri',
    'jadwalku',
    'add',
    'hadir',
    'daftar hadir',
    'codeflowchallenge',
    'aspek penilaian',
    'upin ipin',
    'cek lid',
    'min ukm di um apa aja ni?',
    'folder list',
    'jadwal absen',
    'buat jadwal',
    'liat jadwal',
    'hapus jadwal',
    'ubah jadwal',
    'jam absen',
    'close absen',
    'buka absen',
    'tutup absen',
    'hapus hadir',
    'izin',
    'daftar izin',
    'reset',
    'ya',
    'upload foto',
    'upload video',
];

const lastReplyByChat = new Map();
const aiService = createAIService({
    primaryProvider: config.ai.provider,
    fallbackProviders: config.ai.fallbackProviders,
    geminiApiKey: config.ai.geminiApiKey,
    geminiModel: config.ai.geminiModel,
    groqApiKey: config.ai.groqApiKey,
    groqModel: config.ai.groqModel,
    openRouterApiKey: config.ai.openRouterApiKey,
    openRouterModel: config.ai.openRouterModel,
});
const memoryService = createAIMemoryService({
    maxMessages: config.ai.memoryMaxMessages,
    maxChars: config.ai.memoryMaxChars,
});

async function handleAIMessage(sock, message) {
    if (message?.key?.fromMe) return false;

    const text = getPlainTextMessage(message);
    if (!text || shouldSkipText(text)) return false;

    const chatId = message.key.remoteJid || '';
    const senderId = message.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');
    const settingsService = getAISettingsService();
    const settings = isGroup
        ? settingsService.getGroupSettings(chatId)
        : settingsService.getUserSettings(senderId);

    if (!settings.aiEnabled) return false;
    if (isCoolingDown(chatId)) return false;

    lastReplyByChat.set(chatId, Date.now());

    try {
        await sendPresence(sock, chatId, 'composing');
        const history = memoryService.getHistory(chatId);
        const reply = await aiService.generateReply({
            text,
            senderId,
            chatId,
            history,
        });

        memoryService.addMessage(chatId, 'user', text);
        memoryService.addMessage(chatId, 'assistant', reply);

        await sock.sendMessage(chatId, { text: reply }, { quoted: message });
        return true;
    } catch (error) {
        console.error('AI auto reply failed:', error.message);
        await sock.sendMessage(chatId, {
            text: `AI belum siap dipakai. ${error.message || 'Cek konfigurasi Gemini API.'}`,
        }, { quoted: message });
        return true;
    } finally {
        await sendPresence(sock, chatId, 'paused');
    }
}

function getPlainTextMessage(message) {
    const content = unwrapMessageContent(message.message);
    if (!content) return '';

    if (typeof content.conversation === 'string') {
        return content.conversation.trim();
    }

    if (typeof content.extendedTextMessage?.text === 'string') {
        return content.extendedTextMessage.text.trim();
    }

    return '';
}

function unwrapMessageContent(content) {
    if (!content) return null;
    if (content.ephemeralMessage?.message) return unwrapMessageContent(content.ephemeralMessage.message);
    if (content.viewOnceMessage?.message) return unwrapMessageContent(content.viewOnceMessage.message);
    if (content.viewOnceMessageV2?.message) return unwrapMessageContent(content.viewOnceMessageV2.message);
    if (content.documentWithCaptionMessage?.message) return unwrapMessageContent(content.documentWithCaptionMessage.message);
    return content;
}

function shouldSkipText(text) {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) return true;
    if (normalized.startsWith('.')) return true;

    return LEGACY_COMMANDS.some((command) =>
        normalized === command ||
        normalized.startsWith(`${command} `) ||
        normalized.startsWith(`${command},`) ||
        normalized.startsWith(`${command}|`),
    );
}

function isCoolingDown(chatId) {
    const cooldownMs = Number(config.ai.replyCooldownMs || 5000);
    const lastReplyAt = lastReplyByChat.get(chatId) || 0;
    return Date.now() - lastReplyAt < cooldownMs;
}

async function sendPresence(sock, chatId, presence) {
    if (typeof sock.sendPresenceUpdate !== 'function') return;
    try {
        await sock.sendPresenceUpdate(presence, chatId);
    } catch {
        // Presence is nice to have. Message flow should not fail if WhatsApp rejects it.
    }
}

module.exports = {
    handleAIMessage,
    getPlainTextMessage,
    shouldSkipText,
};
