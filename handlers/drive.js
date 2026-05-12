const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { google } = require('googleapis');

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_FILE = path.join(PROJECT_ROOT, 'data', 'documentation.json');

function loadEnvFile() {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const index = trimmed.indexOf('=');
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) process.env[key] = value;
    }
}

loadEnvFile();

function resolveProjectPath(value, fallback) {
    const selected = value || fallback;
    return path.isAbsolute(selected) ? selected : path.join(PROJECT_ROOT, selected);
}

function getConfig() {
    return {
        credentialsPath: resolveProjectPath(process.env.GOOGLE_DRIVE_CREDENTIALS_PATH, 'credentials/google-drive-credentials.json'),
        tokenPath: resolveProjectPath(process.env.GOOGLE_DRIVE_TOKEN_PATH, 'credentials/google-drive-token.json'),
        parentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '',
        bridgeUrl: (process.env.BRIDGE_INTERNAL_URL || '').replace(/\/$/, ''),
        bridgeSecret: process.env.BRIDGE_INTERNAL_SECRET || '',
    };
}

function loadDocsState() {
    if (!fs.existsSync(DOCS_FILE)) {
        return { folders: {}, activeByChat: {} };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
        return {
            folders: parsed && typeof parsed.folders === 'object' ? parsed.folders : {},
            activeByChat: parsed && typeof parsed.activeByChat === 'object' ? parsed.activeByChat : {},
        };
    } catch {
        return { folders: {}, activeByChat: {} };
    }
}

function saveDocsState(state) {
    fs.writeFileSync(DOCS_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function normalizeFolderName(name) {
    return String(name || '').trim().replace(/^"|"$/g, '');
}

function getFolderKey(name) {
    return normalizeFolderName(name).toLowerCase();
}

function parseQuotedName(raw) {
    const match = String(raw || '').match(/"([^"]+)"/);
    return match ? normalizeFolderName(match[1]) : '';
}

function loadCredentials() {
    const { credentialsPath } = getConfig();
    if (!fs.existsSync(credentialsPath)) {
        throw new Error('credentials_not_found');
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const data = credentials.installed || credentials.web;
    if (!data?.client_id || !data?.client_secret) {
        throw new Error('invalid_credentials');
    }

    return data;
}

function createOAuthClient() {
    const credentials = loadCredentials();
    const redirectUri = credentials.redirect_uris?.[0] || 'http://localhost';
    return new google.auth.OAuth2(credentials.client_id, credentials.client_secret, redirectUri);
}

function getAuthClient() {
    const { tokenPath } = getConfig();
    const auth = createOAuthClient();
    if (!fs.existsSync(tokenPath)) {
        throw new Error('drive_not_authorized');
    }

    auth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
    return auth;
}

function getAuthUrl() {
    const auth = createOAuthClient();
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/drive'],
    });
}

async function saveTokenFromCode(code) {
    const auth = createOAuthClient();
    const { tokens } = await auth.getToken(String(code || '').trim());
    const { tokenPath } = getConfig();
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2) + '\n', 'utf8');
    return true;
}

function getDrive() {
    return google.drive({ version: 'v3', auth: getAuthClient() });
}

function buildFolderLink(folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
}

async function createFolder(name, createdBy) {
    const folderName = normalizeFolderName(name);
    if (!folderName) throw new Error('folder_name_required');

    const { parentFolderId } = getConfig();
    if (!parentFolderId) throw new Error('parent_folder_required');

    const state = loadDocsState();
    const key = getFolderKey(folderName);
    if (state.folders[key]) return { ...state.folders[key], exists: true };

    const drive = getDrive();
    const response = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
        fields: 'id,name,webViewLink',
    });

    const folder = {
        id: response.data.id,
        name: response.data.name || folderName,
        link: response.data.webViewLink || buildFolderLink(response.data.id),
        createdBy: createdBy || '-',
        createdAt: new Date().toISOString(),
        files: [],
    };

    state.folders[key] = folder;
    saveDocsState(state);
    return { ...folder, exists: false };
}

function setActiveFolder(chatId, name) {
    const folderName = normalizeFolderName(name);
    const state = loadDocsState();
    const key = getFolderKey(folderName);
    if (!state.folders[key]) throw new Error('folder_not_found');
    state.activeByChat[chatId] = key;
    saveDocsState(state);
    return state.folders[key];
}

function getActiveFolder(chatId) {
    const state = loadDocsState();
    const key = state.activeByChat[chatId];
    return key ? state.folders[key] || null : null;
}

function getFolder(name) {
    const state = loadDocsState();
    return state.folders[getFolderKey(name)] || null;
}

async function uploadBufferToActiveFolder(chatId, file) {
    const folder = getActiveFolder(chatId);
    if (!folder) throw new Error('active_folder_required');

    const drive = getDrive();
    const response = await drive.files.create({
        requestBody: {
            name: file.fileName || `document-${Date.now()}`,
            parents: [folder.id],
        },
        media: {
            mimeType: file.mimetype || 'application/octet-stream',
            body: Readable.from(file.buffer),
        },
        fields: 'id,name,webViewLink,size,mimeType',
    });

    const uploaded = {
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink,
        mimeType: response.data.mimeType,
        uploadedAt: new Date().toISOString(),
    };

    const state = loadDocsState();
    const key = getFolderKey(folder.name);
    if (!state.folders[key]) state.folders[key] = folder;
    if (!Array.isArray(state.folders[key].files)) state.folders[key].files = [];
    state.folders[key].files.push(uploaded);
    saveDocsState(state);

    return { folder: state.folders[key], file: uploaded };
}

async function shareFolderToDiscord(name, uploadedBy) {
    const folder = getFolder(name);
    if (!folder) throw new Error('folder_not_found');

    const { bridgeUrl, bridgeSecret } = getConfig();
    const response = await fetch(`${bridgeUrl}/documentation/share`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(bridgeSecret ? { 'x-bridge-secret': bridgeSecret } : {}),
        },
        body: JSON.stringify({
            folderName: folder.name,
            driveLink: folder.link || buildFolderLink(folder.id),
            uploadedBy: uploadedBy || 'Admin CFC',
            note: `Total file tersimpan: ${Array.isArray(folder.files) ? folder.files.length : 0}`,
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
        const error = new Error(result.error || `bridge_${response.status}`);
        error.result = result;
        throw error;
    }

    return { folder, result };
}

module.exports = {
    parseQuotedName,
    getAuthUrl,
    saveTokenFromCode,
    createFolder,
    setActiveFolder,
    getActiveFolder,
    uploadBufferToActiveFolder,
    shareFolderToDiscord,
};
