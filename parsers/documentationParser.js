function parseDocumentationCommand(rawBody) {
    const text = String(rawBody || '').trim();

    if (/^drive\s+auth$/i.test(text)) {
        return { type: 'drive_auth' };
    }

    const driveCodeMatch = text.match(/^drive\s+code\s+(.+)$/i);
    if (driveCodeMatch) {
        return { type: 'drive_code', code: driveCodeMatch[1].trim() };
    }

    const createMatch = text.match(/^create\s+folder\s+"([^"]+)"$/i);
    if (createMatch) {
        return { type: 'create_folder', name: createMatch[1].trim() };
    }

    const activeMatch = text.match(/^folder\s+aktif\s+"([^"]+)"$/i);
    if (activeMatch) {
        return { type: 'set_active_folder', name: activeMatch[1].trim() };
    }

    const shareMatch = text.match(/^share\s+"?(.+?)"?\s+to\s+discord$/i);
    if (shareMatch) {
        return { type: 'share_folder', name: shareMatch[1].trim() };
    }
    if (/^folder\s+list$/i.test(text)) {
        return { type: 'list_folders' };
    }

    const removeFolderMatch = text.match(/^remove\s+folder\s+"([^"]+)"$/i);
    if (removeFolderMatch) {
        return { type: 'remove_folder', name: removeFolderMatch[1].trim() };
    }

    return null;
}

function isDocumentationUploadCommand(rawBody) {
    return /^upload\s+(dokumentasi|docs?)$/i.test(String(rawBody || '').trim());
}

module.exports = {
    parseDocumentationCommand,
    isDocumentationUploadCommand,
};