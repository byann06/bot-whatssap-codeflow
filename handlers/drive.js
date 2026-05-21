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

async function setActiveFolder(chatId, name) {
    const folderName = normalizeFolderName(name);
    if (!folderName) throw new Error('folder_name_required');

    const { parentFolderId } = getConfig();
    if (!parentFolderId) throw new Error('parent_folder_required');

    const drive = getDrive();

    // Cari folder langsung dari Drive
    const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
    });

    const folders = response.data.files || [];
    if (folders.length === 0) throw new Error('folder_not_found');

    const folder = folders[0];
    const folderData = {
        id: folder.id,
        name: folder.name,
        link: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
    };

    // Simpan ke documentation.json sebagai cache
    const state = loadDocsState();
    const key = getFolderKey(folderName);
    state.folders[key] = folderData;
    state.activeByChat[chatId] = key;
    saveDocsState(state);

    return folderData;
}

function getActiveFolder(chatId) {
    const state = loadDocsState();
    const key = state.activeByChat[chatId];
    return key ? state.folders[key] || null : null;
}

async function shareFolderToDiscord(name, uploadedBy) {
    const { parentFolderId, bridgeUrl, bridgeSecret } = getConfig();
    if (!parentFolderId) throw new Error('parent_folder_required');

    const drive = getDrive();

    // Cari folder langsung dari Drive
    const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
    });

    const folders = response.data.files || [];
    if (folders.length === 0) throw new Error('folder_not_found');

    const folder = folders[0];
    const link = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;

    const result = await fetch(`${bridgeUrl}/documentation/share`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(bridgeSecret ? { 'x-bridge-secret': bridgeSecret } : {}),
        },
        body: JSON.stringify({
            folderName: folder.name,
            driveLink: link,
            uploadedBy: uploadedBy || 'Admin CFC',
            note: `Folder dari Google Drive`,
        }),
    });

    const resultJson = await result.json().catch(() => ({}));
    if (!result.ok || resultJson.ok === false) {
        const error = new Error(resultJson.error || `bridge_${result.status}`);
        error.result = resultJson;
        throw error;
    }

    return { folder: { name: folder.name, link }, result: resultJson };
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



async function listFoldersFromDrive() {
    const { parentFolderId } = getConfig();
    if (!parentFolderId) throw new Error('parent_folder_required');

    const drive = getDrive();

    // Ambil semua folder
    const folderResponse = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        orderBy: 'name',
    });

    const folders = folderResponse.data.files || [];

    // Hitung isi tiap folder
    const result = await Promise.all(folders.map(async (folder) => {
        const itemsResponse = await drive.files.list({
            q: `'${folder.id}' in parents and trashed = false`,
            fields: 'files(mimeType)',
        });

        const items = itemsResponse.data.files || [];
        const photos = items.filter(f => f.mimeType.startsWith('image/')).length;
        const videos = items.filter(f => f.mimeType.startsWith('video/')).length;
        const total = items.length;

        return {
            id: folder.id,
            name: folder.name,
            webViewLink: folder.webViewLink,
            photos,
            videos,
            total,
        };
    }));

    return result;
}

async function removeFolder(name) {
    const folderName = normalizeFolderName(name);
    if (!folderName) throw new Error('folder_name_required');

    const { parentFolderId } = getConfig();
    if (!parentFolderId) throw new Error('parent_folder_required');

    const drive = getDrive();

    // Cari folder di Drive berdasarkan nama
    const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
        fields: 'files(id, name)',
    });

    const folders = response.data.files || [];
    if (folders.length === 0) throw new Error('folder_not_found');

    // Hapus folder dari Drive (move to trash)
    await drive.files.delete({
        fileId: folders[0].id,
    });

    // Hapus juga dari documentation.json kalau ada
    const state = loadDocsState();
    const key = getFolderKey(folderName);
    if (state.folders[key]) {
        delete state.folders[key];
        // Reset active folder kalau folder yang dihapus adalah folder aktif
        for (const chatId of Object.keys(state.activeByChat)) {
            if (state.activeByChat[chatId] === key) {
                delete state.activeByChat[chatId];
            }
        }
        saveDocsState(state);
    }

    return { name: folders[0].name };
}

// Format ekstensi yang didukung
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'bmp', 'tiff'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'];

function getMediaType(mimetype, fileName) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    const mime = String(mimetype || '').toLowerCase();

    if (mime.startsWith('image/') || PHOTO_EXTENSIONS.includes(ext)) return 'foto';
    if (mime.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext)) return 'video';
    return null;
}

function slugifyFolderName(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
}

async function getOrCreateSubfolder(drive, parentId, subfolderName) {
    // Cek apakah subfolder sudah ada
    const response = await drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${subfolderName}' and trashed = false`,
        fields: 'files(id, name)',
    });

    if (response.data.files.length > 0) {
        return response.data.files[0];
    }

    // Buat subfolder baru
    const created = await drive.files.create({
        requestBody: {
            name: subfolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id, name',
    });

    return created.data;
}

async function uploadMediaBatch(chatId, mediaList) {
    const folder = getActiveFolder(chatId);
    if (!folder) throw new Error('active_folder_required');

    const drive = getDrive();
    const slug = slugifyFolderName(folder.name);

    // Buat subfolder Foto dan Video
    const fotoFolder = await getOrCreateSubfolder(drive, folder.id, 'Foto');
    const videoFolder = await getOrCreateSubfolder(drive, folder.id, 'Video');

    const results = { foto: [], video: [], gagal: [] };

    // Hitung index per tipe
    const counters = { foto: 0, video: 0 };

    for (const media of mediaList) {
        const type = getMediaType(media.mimetype, media.fileName);
        if (!type) {
            results.gagal.push(media.fileName || 'unknown');
            continue;
        }

        counters[type]++;
        const ext = String(media.fileName || '').split('.').pop().toLowerCase() ||
            (type === 'foto' ? 'jpg' : 'mp4');
        const newName = `${slug}_${counters[type]}.${ext}`;
        const targetFolderId = type === 'foto' ? fotoFolder.id : videoFolder.id;

        try {
            const { Readable } = require('stream');
            const response = await drive.files.create({
                requestBody: {
                    name: newName,
                    parents: [targetFolderId],
                },
                media: {
                    mimeType: media.mimetype || 'application/octet-stream',
                    body: Readable.from(media.buffer),
                },
                fields: 'id, name, webViewLink',
            });

            results[type].push(response.data.name);
        } catch (err) {
            results.gagal.push(media.fileName || newName);
        }
    }

    return { folder, results };
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
    loadDocsState,
    listFoldersFromDrive,
    removeFolder,
    getMediaType,
    uploadMediaBatch,
};