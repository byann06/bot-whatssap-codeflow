#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';

const failures = [];
const warnings = [];
const lines = [];
let config;

function section(title) {
    lines.push('', `${title}:`);
}

function item(label, value) {
    lines.push(`- ${label}: ${value}`);
}

function ok(label, detail = 'OK') {
    item(label, detail);
}

function warn(label, detail) {
    warnings.push(`${label}: ${detail}`);
    item(label, `WARN (${detail})`);
}

function fail(label, detail) {
    failures.push(`${label}: ${detail}`);
    item(label, `FAILED (${detail})`);
}

function isPresent(value) {
    return Boolean(String(value || '').trim());
}

function configured(value) {
    return isPresent(value) ? 'configured' : 'missing';
}

function exists(relativePath) {
    return fs.existsSync(path.join(rootDir, relativePath));
}

function safeRequire(relativePath) {
    return require(path.join(rootDir, relativePath));
}

function getEnv(name) {
    return process.env[name] || '';
}

function checkEnvironment() {
    section('Environment');

    if (exists('.env')) ok('.env');
    else fail('.env', 'missing');

    try {
        config = safeRequire('config');
        ok('Config', 'loaded');
    } catch (error) {
        fail('Config', error.message || 'failed to load');
        return;
    }

    const databasePath = getEnv('DATABASE_PATH') || config.ai?.databasePath;
    if (isPresent(databasePath)) ok('DATABASE_PATH', 'configured');
    else fail('DATABASE_PATH', 'missing');

    const provider = getEnv('AI_PROVIDER') || config.ai?.provider;
    if (isPresent(provider)) ok('AI Provider', String(provider).trim().toLowerCase());
    else fail('AI Provider', 'missing');

    const hasAnyAIKey = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY']
        .some((name) => isPresent(getEnv(name)));
    if (hasAnyAIKey) ok('AI Key', 'OK');
    else fail('AI Key', 'missing all provider keys');

    const trigger = getEnv('AI_GROUP_TRIGGER_WORD') || config.ai?.groupTriggerWord;
    if (isPresent(trigger)) ok('AI_GROUP_TRIGGER_WORD', 'configured');
    else fail('AI_GROUP_TRIGGER_WORD', 'missing');
}

function checkRuntimeFolders() {
    section('Runtime Folders');

    if (exists('data')) ok('data/');
    else fail('data/', 'missing');

    if (exists('credentials')) ok('credentials/');
    else warn('credentials/', 'missing; Google integrations may fail');

    if (exists('knowledge')) ok('knowledge/');
    else fail('knowledge/', 'missing');
}

function checkSQLite() {
    section('SQLite');

    if (!config || !config.ai || !config.ai.databasePath) {
        fail('Database', 'DATABASE_PATH unavailable');
        return;
    }

    let database;
    try {
        const { createSqliteDatabase } = safeRequire('infrastructure/database/sqliteDatabase');
        database = createSqliteDatabase(config.ai.databasePath);
        ok('Database', 'OK');

        for (const tableName of ['groups', 'users', 'ai_messages']) {
            const row = database.client
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
                .get(tableName);

            if (row) ok(tableName, 'OK');
            else fail(tableName, 'missing table');
        }
    } catch (error) {
        fail('Database', error.message || 'failed to initialize');
    } finally {
        if (database) database.close();
    }
}

function checkKnowledge() {
    section('Knowledge');

    try {
        const { getKnowledgeStats } = safeRequire('services/knowledgeStatsService');
        const stats = getKnowledgeStats({ rootDir: config?.knowledgeDir || path.join(rootDir, 'knowledge') });

        item('Files', stats.markdownFiles || 0);
        item('Sections', stats.sections || 0);
        item('Status', stats.status || 'UNKNOWN');

        if (stats.status === 'OK') ok('Knowledge Health', 'OK');
        else fail('Knowledge Health', stats.status || 'UNKNOWN');
    } catch (error) {
        fail('Knowledge', error.message || 'failed to read knowledge stats');
    }
}

function checkGoogleSheetsConfig() {
    section('Google Sheets');

    const credentialsPath = getEnv('GOOGLE_SHEETS_CREDENTIALS_PATH');
    const adminSpreadsheetId = getEnv('GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID');
    const mainCashRange = getEnv('GOOGLE_SHEETS_MAIN_CASH_RANGE');
    const inventorySpreadsheetId = getEnv('GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID');

    item('Credentials Path', configured(credentialsPath));
    item('Admin Spreadsheet', configured(adminSpreadsheetId));
    item('Main Cash Range', configured(mainCashRange));
    item('Inventory Spreadsheet', configured(inventorySpreadsheetId));

    if (!isPresent(credentialsPath)) warn('GOOGLE_SHEETS_CREDENTIALS_PATH', 'missing');
    if (!isPresent(adminSpreadsheetId)) warn('GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID', 'missing');
    if (!isPresent(mainCashRange)) warn('GOOGLE_SHEETS_MAIN_CASH_RANGE', 'missing; config default may be used');
    if (!isPresent(inventorySpreadsheetId)) warn('GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID', 'missing; infokus may be unavailable');
}

function checkSecurity() {
    section('Security');

    const envExamplePath = path.join(rootDir, '.env.example');
    if (!fs.existsSync(envExamplePath)) {
        fail('.env.example', 'missing');
    } else {
        const hits = scanEnvExample(envExamplePath);
        if (hits.length) fail('.env.example secret scan', `possible secret pattern: ${hits.join(', ')}`);
        else ok('.env.example secret scan', 'OK');
    }

    const gitignorePath = path.join(rootDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        warn('.gitignore', 'missing');
        return;
    }

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (hasGitignorePattern(gitignore, 'credentials/')) ok('credentials/ ignored', 'OK');
    else warn('credentials/ ignored', 'missing in .gitignore');

    if (hasGitignorePattern(gitignore, 'data/')) ok('data/ ignored', 'OK');
    else warn('data/ ignored', 'missing in .gitignore');
}

function hasGitignorePattern(content, expected) {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .includes(expected);
}

function scanEnvExample(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const checks = [
        { name: 'private_key', pattern: /BEGIN [A-Z ]*PRIVATE KEY|private[_-]?key\s*[:=]/i },
        { name: 'google_api_key', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
        { name: 'openai_or_openrouter_key', pattern: /sk-(?:or-)?[A-Za-z0-9_-]{20,}/i },
        { name: 'groq_key', pattern: /gsk_[A-Za-z0-9_-]{20,}/i },
        { name: 'long_bridge_secret', pattern: /BRIDGE_INTERNAL_SECRET\s*=\s*(?!$|isi_|your_|changeme|placeholder)[A-Za-z0-9_-]{16,}/i },
    ];

    return checks
        .filter((check) => check.pattern.test(content))
        .map((check) => check.name);
}

function printSummary() {
    lines.push('', 'Warnings:');
    if (warnings.length) {
        for (const warning of warnings) lines.push(`- ${warning}`);
    } else {
        lines.push('- none');
    }

    lines.push('', 'Failures:');
    if (failures.length) {
        for (const failure of failures) lines.push(`- ${failure}`);
    } else {
        lines.push('- none');
    }

    const finalStatus = failures.length
        ? 'FAILED'
        : warnings.length
            ? 'READY_WITH_WARNINGS'
            : 'READY';

    lines.push('', 'Status:', finalStatus);

    console.log(lines.join('\n'));

    if (failures.length) {
        process.exitCode = 1;
    }
}

lines.push('Yanverse Preflight Check');
lines.push('No external AI provider or Google Sheets API calls are made.');

checkEnvironment();
checkRuntimeFolders();
checkSQLite();
checkKnowledge();
checkGoogleSheetsConfig();
checkSecurity();
printSummary();