const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');
const { getKnowledgeStats } = require('./knowledgeStatsService');

function getBotStatus() {
    return {
        ai: getAIStatus(),
        sqlite: getSQLiteStatus(),
        knowledge: getKnowledgeStatus(),
        googleSheets: getGoogleSheetsStatus(),
        runtime: getRuntimeStatus(),
    };
}

function getAIStatus() {
    const primary = config.ai.provider || 'gemini';
    const fallbackProviders = Array.isArray(config.ai.fallbackProviders) ? config.ai.fallbackProviders : [];
    const providers = [primary, ...fallbackProviders].filter(Boolean);
    const keyStatus = providers.map((provider) => ({
        provider,
        configured: hasAIProviderKey(provider),
    }));

    return {
        primary,
        fallbackProviders,
        hasAnyConfiguredKey: keyStatus.some((item) => item.configured),
        keyStatus,
    };
}

function hasAIProviderKey(provider) {
    const normalized = String(provider || '').trim().toLowerCase();
    if (normalized === 'gemini') return Boolean(config.ai.geminiApiKey);
    if (normalized === 'groq') return Boolean(config.ai.groqApiKey);
    if (normalized === 'openrouter') return Boolean(config.ai.openRouterApiKey);
    return false;
}

function getSQLiteStatus() {
    const databasePath = config.ai.databasePath;
    const resolvedPath = databasePath ? path.resolve(databasePath) : '';
    if (!resolvedPath) {
        return {
            accessible: false,
            aiMessagesTable: false,
            message: 'missing_path',
        };
    }

    if (!fs.existsSync(resolvedPath)) {
        return {
            accessible: false,
            aiMessagesTable: false,
            message: 'database_file_missing',
        };
    }

    let db;
    try {
        db = new Database(resolvedPath, { readonly: true, fileMustExist: true });
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_messages'").get();
        return {
            accessible: true,
            aiMessagesTable: Boolean(table),
            message: 'OK',
        };
    } catch (error) {
        return {
            accessible: false,
            aiMessagesTable: false,
            message: error.message || 'sqlite_error',
        };
    } finally {
        if (db) db.close();
    }
}

function getKnowledgeStatus() {
    try {
        return getKnowledgeStats({ rootDir: config.knowledgeDir });
    } catch (error) {
        return {
            markdownFiles: 0,
            sections: 0,
            commandFiles: 0,
            generalKnowledgeFiles: 0,
            categories: [],
            status: `ERROR: ${error.message}`,
        };
    }
}

function getGoogleSheetsStatus() {
    const sheets = config.googleSheets || {};
    const credentialsConfigured = Boolean(sheets.credentialsPath && fs.existsSync(path.resolve(sheets.credentialsPath)));
    const adminSpreadsheetConfigured = Boolean(sheets.adminSpreadsheetId || sheets.spreadsheetId);
    const inventorySpreadsheetConfigured = Boolean(sheets.inventorySpreadsheetId);

    return {
        mainCash: credentialsConfigured && adminSpreadsheetConfigured && Boolean(sheets.mainCashRange),
        memberCash: credentialsConfigured && adminSpreadsheetConfigured && Boolean(sheets.memberCashRange || sheets.memberCashRanges?.length),
        inventory: credentialsConfigured && inventorySpreadsheetConfigured && Boolean(sheets.inventoryRange || sheets.inventoryRanges?.length),
    };
}

function getRuntimeStatus() {
    const memory = process.memoryUsage();
    return {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        rssMb: bytesToMb(memory.rss),
        heapUsedMb: bytesToMb(memory.heapUsed),
        heapTotalMb: bytesToMb(memory.heapTotal),
    };
}

function formatBotStatusForWhatsApp(status = getBotStatus()) {
    const ai = status.ai || {};
    const sqlite = status.sqlite || {};
    const knowledge = status.knowledge || {};
    const sheets = status.googleSheets || {};
    const runtime = status.runtime || {};

    return [
        '🟢 Bot Status',
        '',
        'AI:',
        `Provider utama: ${ai.primary || '-'}`,
        `Fallback: ${formatList(ai.fallbackProviders)}`,
        `API key: ${ai.hasAnyConfiguredKey ? 'configured' : 'missing'}`,
        `Keys: ${formatAIKeyStatus(ai.keyStatus)}`,
        '',
        'SQLite:',
        `Database: ${sqlite.accessible ? 'OK' : 'ERROR'}`,
        `AI Memory Table: ${sqlite.aiMessagesTable ? 'OK' : 'missing'}`,
        '',
        'Knowledge:',
        `Files: ${knowledge.markdownFiles || 0}`,
        `Sections: ${knowledge.sections || 0}`,
        `Status: ${knowledge.status || 'UNKNOWN'}`,
        '',
        'Google Sheets:',
        `Kas Utama: ${formatConfigured(sheets.mainCash)}`,
        `Kas Anggota: ${formatConfigured(sheets.memberCash)}`,
        `Infokus: ${formatConfigured(sheets.inventory)}`,
        '',
        'Runtime:',
        `Uptime: ${formatUptime(runtime.uptimeSeconds || 0)}`,
        `Node: ${runtime.nodeVersion || process.version}`,
        `Memory: RSS ${runtime.rssMb || 0} MB | Heap ${runtime.heapUsedMb || 0}/${runtime.heapTotalMb || 0} MB`,
    ].join('\n');
}

function formatAIKeyStatus(keyStatus = []) {
    if (!keyStatus.length) return '-';
    return keyStatus
        .map((item) => `${item.provider}:${item.configured ? 'ok' : 'missing'}`)
        .join(', ');
}

function formatConfigured(value) {
    return value ? 'configured' : 'missing';
}

function formatList(items = []) {
    return Array.isArray(items) && items.length ? items.join(', ') : '-';
}

function formatUptime(seconds) {
    const total = Math.max(0, Number(seconds || 0));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (days) return `${days}d ${hours}h ${minutes}m`;
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function bytesToMb(value) {
    return Math.round((Number(value || 0) / 1024 / 1024) * 10) / 10;
}

module.exports = {
    getBotStatus,
    formatBotStatusForWhatsApp,
};