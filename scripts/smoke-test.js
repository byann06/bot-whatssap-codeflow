#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';

let passed = 0;
let warned = 0;
let failed = 0;

function pass(message) {
    passed += 1;
    console.log(`[PASS] ${message}`);
}

function warn(message) {
    warned += 1;
    console.warn(`[WARN] ${message}`);
}

function fail(message, error) {
    failed += 1;
    const detail = error && error.message ? `: ${error.message}` : '';
    console.error(`[FAIL] ${message}${detail}`);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function test(name, fn) {
    try {
        fn();
        pass(name);
    } catch (error) {
        fail(name, error);
    }
}

function requireFresh(relativePath) {
    return require(path.join(rootDir, relativePath));
}

function configured(value) {
    return value ? 'configured' : 'missing';
}

console.log('Yanverse smoke test started');
console.log('External AI and Google Sheets APIs are not called.');
console.log('');

let config;

test('config loads safely', () => {
    config = requireFresh('config');
    assert(config.rootDir && fs.existsSync(config.rootDir), 'rootDir is missing');
    assert(config.ai && config.ai.provider, 'AI provider config is missing');
    assert(config.knowledgeDir && fs.existsSync(config.knowledgeDir), 'knowledgeDir is missing');
});

test('core modules can be required', () => {
    const modules = [
        'services/aiService',
        'services/aiMemoryService',
        'services/aiSettingsService',
        'services/knowledgeService',
        'services/knowledgeStatsService',
        'services/googleSheetsService',
        'services/adminContextService',
        'services/botStatusService',
        'services/maintenanceService',
        'services/ai/aiProviderRouter',
        'services/ai/persona',
        'services/ai/providers/geminiProvider',
        'services/ai/providers/groqProvider',
        'services/ai/providers/openrouterProvider',
        'handlers/aiCommandHandler',
        'handlers/aiMessageHandler',
        'handlers/knowledgeCommandHandler',
        'handlers/adminSheetsCommandHandler',
        'handlers/botStatusCommandHandler',
        'handlers/helpCommandHandler',
        'parsers/aiParser',
        'infrastructure/database/sqliteDatabase',
    ];

    for (const modulePath of modules) {
        requireFresh(modulePath);
    }
});

test('knowledge stats works', () => {
    const { getKnowledgeStats } = requireFresh('services/knowledgeStatsService');
    const stats = getKnowledgeStats({ rootDir: config.knowledgeDir });
    assert(stats.markdownFiles > 0, 'no markdown knowledge files found');
    assert(stats.sections > 0, 'no knowledge sections found');
    assert(stats.status === 'OK', `knowledge status is ${stats.status}`);
    console.log(`[INFO] knowledge files=${stats.markdownFiles} sections=${stats.sections} status=${stats.status}`);
});

test('knowledge search helper works', () => {
    const { searchKnowledgeSections } = requireFresh('services/knowledgeService');
    assert(typeof searchKnowledgeSections === 'function', 'searchKnowledgeSections is not exported');
    const results = searchKnowledgeSections(config.knowledgeDir, 'medig', { limit: 3 });
    assert(Array.isArray(results), 'knowledge search result is not an array');
    if (!results.length) warn('knowledge search for "medig" returned no result');
    console.log(`[INFO] knowledge search medig results=${results.length}`);
});

test('SQLite schema initializes in memory', () => {
    const { createSqliteDatabase } = requireFresh('infrastructure/database/sqliteDatabase');
    const database = createSqliteDatabase(':memory:');
    try {
        const table = database.client
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_messages'")
            .get();
        assert(Boolean(table), 'ai_messages table was not created');
    } finally {
        database.close();
    }
});

test('maintenance config is readable or safely optional', () => {
    const { loadMaintenanceInfo } = requireFresh('services/maintenanceService');
    const maintenancePath = config.files && config.files.maintenance;

    if (maintenancePath && fs.existsSync(maintenancePath)) {
        const raw = fs.readFileSync(maintenancePath, 'utf8');
        JSON.parse(raw);
    } else {
        warn('data/maintenance.json not found; default maintenance message will be used');
    }

    const info = loadMaintenanceInfo();
    assert(info && typeof info === 'object', 'maintenance info is not an object');
    assert(Array.isArray(info.summary), 'maintenance summary is not an array');
});

test('bot status service works without network call', () => {
    const { getBotStatus } = requireFresh('services/botStatusService');
    const status = getBotStatus();
    assert(status.ai, 'AI status missing');
    assert(status.sqlite, 'SQLite status missing');
    assert(status.knowledge, 'knowledge status missing');
    assert(status.googleSheets, 'Google Sheets status missing');
    assert(status.runtime, 'runtime status missing');
    console.log(`[INFO] AI provider=${status.ai.primary} key=${configured(status.ai.hasAnyConfiguredKey)}`);
    console.log(`[INFO] SQLite accessible=${status.sqlite.accessible ? 'yes' : 'no'} ai_messages=${status.sqlite.aiMessagesTable ? 'yes' : 'no'}`);
});

test('Google Sheets config check only', () => {
    const sheets = config.googleSheets || {};
    const credentialsConfigured = Boolean(sheets.credentialsPath && fs.existsSync(path.resolve(sheets.credentialsPath)));
    const adminSpreadsheetConfigured = Boolean(sheets.adminSpreadsheetId || sheets.spreadsheetId);
    const inventorySpreadsheetConfigured = Boolean(sheets.inventorySpreadsheetId);

    console.log(`[INFO] Sheets credentials=${configured(credentialsConfigured)}`);
    console.log(`[INFO] Sheets kas=${configured(credentialsConfigured && adminSpreadsheetConfigured)}`);
    console.log(`[INFO] Sheets infokus=${configured(credentialsConfigured && inventorySpreadsheetConfigured)}`);

    assert(Object.prototype.hasOwnProperty.call(sheets, 'mainCashRange'), 'mainCashRange config missing');
    assert(Array.isArray(sheets.memberCashRanges), 'memberCashRanges should be an array');
    assert(Array.isArray(sheets.inventoryRanges), 'inventoryRanges should be an array');
});

console.log('');
console.log(`Smoke test summary: passed=${passed} warnings=${warned} failed=${failed}`);

if (failed > 0) {
    process.exitCode = 1;
}