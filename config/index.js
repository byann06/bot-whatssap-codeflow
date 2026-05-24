require('dotenv').config();
const path = require('path');
const { YANVERSE_SYSTEM_PROMPT } = require('../services/ai/persona');

const rootDir = path.join(__dirname, '..');

function csvEnv(name) {
    return (process.env[name] || '').split(',').map((value) => value.trim()).filter(Boolean);
}

const dataDir = path.join(rootDir, 'data');
const assetsDir = path.join(rootDir, 'assets');
const knowledgeDir = path.join(rootDir, 'knowledge');

module.exports = {
    rootDir,
    dataDir,
    assetsDir,
    knowledgeDir,
    files: {
        members: path.join(dataDir, 'members.json'),
        attendance: path.join(dataDir, 'attendance.json'),
        documentation: path.join(dataDir, 'documentation.json'),
        maintenance: path.join(dataDir, 'maintenance.json'),
        sirPai: path.join(assetsDir, 'sir-pai.jpg'),
    },
    roles: {
        adminPhone: csvEnv('ADMIN_PHONE'),
        adminLid: csvEnv('ADMIN_LID'),
        hadirLid: csvEnv('HADIR_LID'),
        dokumentasiLid: csvEnv('DOKUMENTASI_LID'),
        komunikasiLid: csvEnv('KOMUNIKASI_LID'),
        pemateriLid: csvEnv('PEMATERI_LID'),
    },
    botNoticeGroupId: process.env.BOT_NOTICE_GROUP_ID || '120363427721474222@g.us',
    messageMaxAgeSeconds: Number(process.env.BOT_MAX_MESSAGE_AGE_SECONDS || 120),
    maintenance: {
        startGifUrl: process.env.MAINTENANCE_GIF_URL || 'https://media.giphy.com/media/KQoQzycVECd9xUNpeP/giphy.mp4',
        doneGifUrl: process.env.MAINTENANCE_DONE_GIF_URL || 'https://media.giphy.com/media/ymjrojYpcJSMpZ9wRA/giphy.mp4',
    },
    ai: {
        provider: (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
        fallbackProviders: (process.env.AI_FALLBACK_PROVIDERS || 'groq,openrouter')
            .split(',')
            .map((provider) => provider.trim().toLowerCase())
            .filter(Boolean),
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        groqApiKey: process.env.GROQ_API_KEY || '',
        groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
        openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
        groupTriggerWord: process.env.AI_GROUP_TRIGGER_WORD || 'yanverse,',
        systemPrompt: process.env.AI_SYSTEM_PROMPT || YANVERSE_SYSTEM_PROMPT,
        replyCooldownMs: Number(process.env.AI_REPLY_COOLDOWN_MS || 5000),
        memoryMaxMessages: Number(process.env.AI_MEMORY_MAX_MESSAGES || 10),
        memoryMaxChars: Number(process.env.AI_MEMORY_MAX_CHARS || 1000),
        databasePath: process.env.DATABASE_PATH || path.join(dataDir, 'bot.sqlite'),
        knowledgeDir,
        knowledgeMaxContextChars: Number(process.env.AI_KNOWLEDGE_MAX_CONTEXT_CHARS || 3500),
        knowledgeMaxSections: Number(process.env.AI_KNOWLEDGE_MAX_SECTIONS || 5),
    },
    attendanceReminderMinutes: Number(process.env.ABSEN_REMINDER_MINUTES || 30),
    attendanceKeys: {
        sessions: '__sessions',
        activeByChat: '__activeByChat',
    },
    allowedRoles: ['Anggota', 'Pengurus'],
    allowedManagementRoles: ['Pembina', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Divisi Medig', 'Divisi Perlog', '-'],
};
