const config = require('../config');
const { loadJsonFile } = require('../lib/jsonFile');

const DEFAULT_MAINTENANCE = {
    enabled: true,
    version: '',
    summary: [],
};

function loadMaintenanceInfo() {
    try {
        const rawInfo = loadJsonFile(config.files.maintenance, DEFAULT_MAINTENANCE, isMaintenanceObject);
        return normalizeMaintenanceInfo(rawInfo);
    } catch (error) {
        console.warn(`[maintenance] failed to load maintenance info: ${error.message}; using default message.`);
        return normalizeMaintenanceInfo(DEFAULT_MAINTENANCE);
    }
}

function isMaintenanceObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function buildMaintenanceStartText() {
    return [
        '🟡 BOT MAINTENANCE',
        '',
        'Bot sedang maintenance sebentar.',
        'Beberapa command mungkin tidak merespon sementara.',
    ].join('\n');
}

function buildMaintenanceDoneText() {
    const info = loadMaintenanceInfo();
    const lines = [
        "🟢 WE'RE BACK, BABY!",
        '',
        'Maintenance selesai.',
    ];

    if (info.version) {
        lines.push('', `Versi: ${info.version}`);
    }

    if (info.summary.length > 0) {
        lines.push('', 'Ringkasan:', ...info.summary.map((item) => `>> ${item}`));
    }

    return lines.join('\n');
}

function normalizeMaintenanceInfo(value) {
    if (value.summary !== undefined && !Array.isArray(value.summary)) {
        console.warn('[maintenance] invalid summary format in maintenance.json; expected array, using empty summary.');
    }

    return {
        enabled: value.enabled !== false,
        version: String(value.version || '').trim(),
        summary: Array.isArray(value.summary)
            ? value.summary.map((item) => String(item || '').trim()).filter(Boolean)
            : [],
    };
}

module.exports = {
    loadMaintenanceInfo,
    buildMaintenanceStartText,
    buildMaintenanceDoneText,
};
