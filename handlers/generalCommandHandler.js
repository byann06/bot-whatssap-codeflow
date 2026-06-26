const fs = require('fs');
const path = require('path');
const {
    MENU_TEXT,
    LINK_KOMUNITAS,
    CODEFLOW_CHALLENGE_TEXT,
    ASPEK_PENILAIAN_TEXT,
} = require('../constants/menuTexts');

const LOGO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

class MessageMedia {
    static fromFilePath(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
        };

        return {
            data: fs.readFileSync(filePath),
            mimetype: mimeTypes[ext] || 'application/octet-stream',
            filename: path.basename(filePath),
        };
    }
}

async function handleGeneralCommand(context = {}) {
    const command = String(context.command || '').trim().toLowerCase();

    if (command === 'menu') {
        await handleMenuCommand(context);
        return true;
    }

    if (command === 'link') {
        await handleLinkCommand(context);
        return true;
    }

    if (command === 'logo') {
        await handleLogoCommand(context);
        return true;
    }

    if (command === 'codeflowchallenge') {
        await handleChallengeCommand(context);
        return true;
    }

    if (command === 'aspek penilaian') {
        await handleAssessmentCommand(context);
        return true;
    }

    return false;
}

async function handleMenuCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=menu | to=${senderName}`);
    await replyToUser(msg, contact, senderName, MENU_TEXT);
}

async function handleLinkCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=link | to=${senderName}`);
    await replyToUser(msg, contact, senderName, `berikut link komunitas CFC:\n\n${LINK_KOMUNITAS}`);
}

async function handleChallengeCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=codeflowchallenge | to=${senderName}`);
    await replyToUser(msg, contact, senderName, CODEFLOW_CHALLENGE_TEXT);
}

async function handleAssessmentCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=aspek_penilaian | to=${senderName}`);
    await replyToUser(msg, contact, senderName, ASPEK_PENILAIAN_TEXT);
}

async function handleLogoCommand({ msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets }) {
    const logoPaths = getLogoPaths();

    if (logoPaths.length === 0) {
        logInteraction('OUTGOING', `reply=logo_not_found | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'logo CFC belum tersedia. Simpan file logo ke folder assets dengan ekstensi .jpg, .jpeg, atau .png.');
        return;
    }

    for (const logoPath of logoPaths) {
        const media = MessageMedia.fromFilePath(logoPath);
        logInteraction('OUTGOING', `reply=logo_document | to=${senderName} | file=${path.basename(logoPath)}`);
        await msg.reply(media, undefined, {
            caption: `${getMentionHandle(contact, senderName)} 🖼️ ${path.basename(logoPath)}`,
            sendMediaAsDocument: true,
            filename: path.basename(logoPath),
            mentions: getMentionTargets(contact),
        });
    }
}

function getLogoPaths() {
    const assetsDir = path.join(__dirname, '..', 'assets', 'logo');
    if (!fs.existsSync(assetsDir)) {
        return [];
    }

    return fs.readdirSync(assetsDir)
        .filter((fileName) => {
            const normalizedExtension = path.extname(fileName).toLowerCase();
            return LOGO_EXTENSIONS.includes(normalizedExtension);
        })
        .sort((firstFile, secondFile) => firstFile.localeCompare(secondFile))
        .map((fileName) => path.join(assetsDir, fileName));
}

module.exports = {
    handleGeneralCommand,
};
