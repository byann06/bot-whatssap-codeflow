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
    systemPrompt: config.ai.systemPrompt,
    knowledgeDir: config.ai.knowledgeDir,
    knowledgeMaxContextChars: config.ai.knowledgeMaxContextChars,
    knowledgeMaxSections: config.ai.knowledgeMaxSections,
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
    const promptText = isGroup ? extractGroupPrompt(text) : text;
    if (isGroup && !promptText) {
        console.log('[AI] skip group message: trigger tidak ditemukan');
        return false;
    }
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
            text: promptText,
            senderId,
            chatId,
            history,
        });

        memoryService.addMessage(chatId, 'user', promptText);
        memoryService.addMessage(chatId, 'assistant', reply);

        await sendAIReply(sock, chatId, reply, message, promptText);
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

function extractGroupPrompt(text) {
    const trigger = String(config.ai.groupTriggerWord || 'yanverse,').trim();
    if (!trigger) return text;

    const trimmedText = String(text || '').trim();
    if (!trimmedText.toLowerCase().startsWith(trigger.toLowerCase())) {
        return '';
    }

    return trimmedText.slice(trigger.length).trim();
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

function splitCodeResponse(text) {
    const rawText = String(text || '').trim();
    const parts = [];
    const codeBlockPattern = /```([a-zA-Z0-9#+._-]*)?\s*\r?\n([\s\S]*?)```/g;
    let cursor = 0;
    let match;

    while ((match = codeBlockPattern.exec(rawText)) !== null) {
        const before = rawText.slice(cursor, match.index).trim();
        if (before) {
            parts.push({ type: 'text', text: before });
        }

        const language = normalizeCodeLanguage(match[1] || 'text');
        const code = String(match[2] || '').trim();
        if (code) {
            parts.push({
                type: 'code',
                text: '> ' + formatLanguageLabel(language) + '\n```\n' + code + '\n```',
            });
        }

        cursor = codeBlockPattern.lastIndex;
    }

    const after = rawText.slice(cursor).trim();
    if (after) {
        parts.push({ type: 'text', text: after });
    }

    return parts.length ? parts : [{ type: 'text', text: rawText }];
}
function normalizeCodeLanguage(language) {
    const normalized = String(language || 'text').trim().toLowerCase();
    const aliases = {
        js: 'javascript',
        py: 'python',
        ts: 'typescript',
        sh: 'bash',
        shell: 'bash',
        'c++': 'cpp',
    };

    return aliases[normalized] || normalized.replace(/[^a-z0-9#+._-]/g, '') || 'text';
}
function formatLanguageLabel(language) {
    const normalized = String(language || 'text').trim().toLowerCase();
    const labels = {
        javascript: 'JavaScript',
        typescript: 'TypeScript',
        python: 'Python',
        html: 'HTML',
        css: 'CSS',
        json: 'JSON',
        bash: 'Bash',
        sql: 'SQL',
        java: 'Java',
        php: 'PHP',
        cpp: 'C++',
        c: 'C',
        go: 'Go',
        rust: 'Rust',
        text: 'Code',
    };

    return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
function isSourceCodeOnlyRequest(text) {
    const normalized = String(text || '').toLowerCase();
    return (
        normalized.includes('cuma source code') ||
        normalized.includes('source code aja') ||
        normalized.includes('source code saja') ||
        normalized.includes('cuma kode') ||
        normalized.includes('kode aja') ||
        normalized.includes('kode saja') ||
        normalized.includes('code only') ||
        normalized.includes('only code')
    );
}

async function sendAIReply(sock, chatId, text, quotedMessage, promptText = '') {
    let parts = splitCodeResponse(text).filter((part) => part.text);

    if (isSourceCodeOnlyRequest(promptText)) {
        const codeParts = parts.filter((part) => part.type === 'code');
        if (codeParts.length) {
            parts = codeParts;
        }
    }

    for (let index = 0; index < parts.length; index += 1) {
        const options = index === 0 ? { quoted: quotedMessage } : {};
        await sock.sendMessage(chatId, { text: parts[index].text }, options);
    }
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
    extractGroupPrompt,
    splitCodeResponse,
    normalizeCodeLanguage,
    formatLanguageLabel,
    isSourceCodeOnlyRequest,
};
