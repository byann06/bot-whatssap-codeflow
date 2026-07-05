const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    jidNormalizedUser,
    useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { handleMessage, restoreAttendanceAutoCloseTimers } = require('./handlers/menu');
const { handleAICommand } = require('./handlers/aiCommandHandler');
const { handleKnowledgeCommand } = require('./handlers/knowledgeCommandHandler');
const { handleAdminSheetsCommand } = require('./handlers/adminSheetsCommandHandler');
const { handleBotStatusCommand } = require('./handlers/botStatusCommandHandler');
const { handleHelpCommand } = require('./handlers/helpCommandHandler');
const { handleAIMessage } = require('./handlers/aiMessageHandler');
const fs = require('fs');
const config = require('./config');
const { sendGroupNotice } = require('./services/notification');
const { buildMaintenanceStartText, buildMaintenanceDoneText } = require('./services/maintenanceService');

const USE_PAIRING_CODE = process.argv.includes('pairing');
const BRIDGE_NUMBER = (process.env.BRIDGE_PAIRING_NUMBER || '').replace(/\D/g, '') + '@s.whatsapp.net';
const PAIRING_NUMBER = process.env.PAIRING_NUMBER?.replace(/\D/g, '') || '';
const AUTH_DIR = path.join(__dirname, '.baileys_auth');
let startupNoticeSent = false;
let shutdownNoticeSent = false;
let skippedOldMessageLogCount = 0;

async function notifyMaintenanceStart(reason = 'MAINTENCE') {
    if (!config.maintenance.noticeEnabled) return;
    if (shutdownNoticeSent || !client.sock) return;
    shutdownNoticeSent = true;
    try {
        await sendGroupNotice(client.sock, buildMaintenanceStartText(), { gifUrl: config.maintenance.startGifUrl });
    } catch (error) {
        console.error('Failed to send maintenance notice:', error.message);
    }
}

async function shutdownBot(signal) {
    await notifyMaintenanceStart('maintenance/perbaikan');
    process.exit(signal === 'SIGINT' ? 0 : 1);
}
let cachedVersion;
const client = {
    sock: null,
    info: {
        wid: {
            _serialized: '',
        },
    },
};




function getMessageTimestampMs(message) {
    const timestamp = message?.messageTimestamp;
    if (!timestamp) return 0;

    let timestampValue = 0;
    if (typeof timestamp === 'number') {
        timestampValue = timestamp;
    } else if (typeof timestamp === 'bigint') {
        timestampValue = Number(timestamp);
    } else if (typeof timestamp.toNumber === 'function') {
        timestampValue = timestamp.toNumber();
    } else {
        timestampValue = Number(timestamp);
    }

    if (!Number.isFinite(timestampValue) || timestampValue <= 0) return 0;
    return timestampValue > 1e12 ? timestampValue : timestampValue * 1000;
}

function isOldMessage(message) {
    const maxAgeSeconds = Number(config.messageMaxAgeSeconds || 0);
    if (!maxAgeSeconds || maxAgeSeconds < 0) return false;

    const timestampMs = getMessageTimestampMs(message);
    if (!timestampMs) return false;

    return Date.now() - timestampMs > maxAgeSeconds * 1000;
}

function logOldMessageSkip(message) {
    if (skippedOldMessageLogCount >= 5) return;
    skippedOldMessageLogCount += 1;

    const timestampMs = getMessageTimestampMs(message);
    const ageSeconds = timestampMs ? Math.round((Date.now() - timestampMs) / 1000) : '?';
    console.log('[SKIP] old message ignored | chat=' + message.key.remoteJid + ' | age=' + ageSeconds + 's');
}

function normalizeJid(value) {
    if (!value) {
        return '';
    }

    return String(value).replace(/@c\.us$/i, '@s.whatsapp.net');
}

function unwrapMessageContent(message) {
    if (!message) {
        return undefined;
    }

    if (message.ephemeralMessage?.message) {
        return unwrapMessageContent(message.ephemeralMessage.message);
    }

    if (message.viewOnceMessage?.message) {
        return unwrapMessageContent(message.viewOnceMessage.message);
    }

    if (message.viewOnceMessageV2?.message) {
        return unwrapMessageContent(message.viewOnceMessageV2.message);
    }

    if (message.viewOnceMessageV2Extension?.message) {
        return unwrapMessageContent(message.viewOnceMessageV2Extension.message);
    }

    if (message.documentWithCaptionMessage?.message) {
        return unwrapMessageContent(message.documentWithCaptionMessage.message);
    }

    return message;
}

function getMessageNode(message) {
    const content = unwrapMessageContent(message);
    if (!content) {
        return undefined;
    }

    const contentType = Object.keys(content)[0];
    return contentType ? content[contentType] : undefined;
}

function getMessageBody(message) {
    const content = unwrapMessageContent(message);
    if (!content) {
        return '';
    }

    if (typeof content.conversation === 'string') {
        return content.conversation;
    }

    if (content.extendedTextMessage?.text) {
        return content.extendedTextMessage.text;
    }

    if (content.imageMessage?.caption) {
        return content.imageMessage.caption;
    }

    if (content.videoMessage?.caption) {
        return content.videoMessage.caption;
    }

    if (content.documentMessage?.caption) {
        return content.documentMessage.caption;
    }

    if (content.buttonsResponseMessage?.selectedButtonId) {
        return content.buttonsResponseMessage.selectedButtonId;
    }

    if (content.listResponseMessage?.singleSelectReply?.selectedRowId) {
        return content.listResponseMessage.singleSelectReply.selectedRowId;
    }

    if (content.templateButtonReplyMessage?.selectedId) {
        return content.templateButtonReplyMessage.selectedId;
    }

    return '';
}

function getContextInfo(message) {
    const node = getMessageNode(message);
    return node?.contextInfo || {};
}

function getMediaInfo(message) {
    const content = unwrapMessageContent(message);
    if (!content) {
        return null;
    }

    const type = Object.keys(content)[0];
    const node = type ? content[type] : null;
    if (!node) {
        return null;
    }

    if (type === 'documentMessage') {
        return {
            type,
            fileName: node.fileName || 'document',
            mimetype: node.mimetype || 'application/octet-stream',
        };
    }

    if (type === 'imageMessage') {
        return {
            type,
            fileName: 'image.jpg',
            mimetype: node.mimetype || 'image/jpeg',
        };
    }

    if (type === 'videoMessage') {
        return {
            type,
            fileName: node.fileName || 'video.mp4',
            mimetype: node.mimetype || 'video/mp4',
        };
    }

    return null;
}

function normalizeMentionJids(mentions = []) {
    return mentions
        .map((mention) => {
            if (!mention) {
                return '';
            }

            if (typeof mention === 'string') {
                return normalizeJid(mention);
            }

            return normalizeJid(mention?.id?._serialized || mention?.jid || '');
        })
        .filter(Boolean);
}

function buildQuotedMessage(parentMessage) {
    const contextInfo = getContextInfo(parentMessage.message);
    if (!contextInfo?.quotedMessage) {
        return null;
    }

    return {
        key: {
            remoteJid: parentMessage.key.remoteJid,
            fromMe: false,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant || parentMessage.key.participant || parentMessage.key.remoteJid,
        },
        message: contextInfo.quotedMessage,
        pushName: undefined,
    };
}

function wrapMessage(sock, baileysMessage) {
    const remoteJid = baileysMessage.key.remoteJid || '';
    const participantJid = baileysMessage.key.participant || remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderJid = normalizeJid(isGroup ? participantJid : remoteJid);
    const body = getMessageBody(baileysMessage.message);
    const contextInfo = getContextInfo(baileysMessage.message);
    const quotedMessage = buildQuotedMessage(baileysMessage);
    const mediaInfo = getMediaInfo(baileysMessage.message);

    return {
        key: baileysMessage.key,
        from: remoteJid,
        author: participantJid,
        body,
        mentionedIds: (contextInfo?.mentionedJid || []).map(normalizeJid),
        hasQuotedMsg: Boolean(quotedMessage),
        mediaInfo,
        async downloadMedia() {
            if (!mediaInfo) {
                return null;
            }

            const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {});
            return {
                ...mediaInfo,
                buffer,
            };
        },
        async getContact() {
            return {
                pushname: baileysMessage.pushName || '',
                name: baileysMessage.pushName || '',
                id: {
                    _serialized: senderJid,
                },
            };
        },
        async getChat() {
            return {
                isGroup,
            };
        },
        async getQuotedMessage() {
            if (!quotedMessage) {
                throw new Error('No quoted message');
            }

            return wrapMessage(sock, quotedMessage);
        },
        async reply(payload, _unused, options = {}) {
            const mentions = normalizeMentionJids(options.mentions);

            if (payload && typeof payload === 'object' && Buffer.isBuffer(payload.data)) {
                return sock.sendMessage(remoteJid, {
                    document: payload.data,
                    mimetype: payload.mimetype,
                    fileName: options.filename || payload.filename,
                    caption: options.caption,
                    mentions,
                }, {
                    quoted: baileysMessage,
                });
            }

            return sock.sendMessage(remoteJid, {
                text: String(payload || ''),
                mentions,
            }, {
                quoted: baileysMessage,
            });
        },
        async forward(chatId) {
            return sock.sendMessage(normalizeJid(chatId), {
                forward: baileysMessage,
            });
        },
    };
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    if (!cachedVersion) {
        const { version } = await fetchLatestBaileysVersion();
        cachedVersion = version;
        console.log('Using WhatsApp version:', cachedVersion.join('.'));
    }

    const sock = makeWASocket({
        auth: state,
        version: cachedVersion,
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        browser: ['CodeFlow Bot', 'Chrome', '1.0.0'],
    });

    client.sock = sock;


    let pairingRequested = false;

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            if (USE_PAIRING_CODE && PAIRING_NUMBER && !pairingRequested) {
                pairingRequested = true;
                try {
                    const code = await sock.requestPairingCode(PAIRING_NUMBER);
                    console.log(`\n🔑 Pairing Code: ${code}`);
                    console.log('Buka WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon\n');
                } catch (err) {
                    console.error('Gagal dapat pairing code:', err.message);
                }
            } else {
                console.log('Scan QR ini dengan WhatsApp kamu:');
                qrcode.generate(qr, { small: true });
            }
        }

        if (connection === 'open') {
            client.info.wid._serialized = normalizeJid(jidNormalizedUser(sock.user?.id || ''));
            console.log('✅ Bot siap!');
            restoreAttendanceAutoCloseTimers(client);
            if (config.maintenance.noticeEnabled && !startupNoticeSent) {
                startupNoticeSent = true;
                try {
                    await sendGroupNotice(sock, buildMaintenanceDoneText(), { gifUrl: config.maintenance.doneGifUrl });
                } catch (error) {
                    console.error('Failed to send maintenance done notice:', error.message);
                }
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('Bot putus:', statusCode || 'unknown');

            if (shouldReconnect) {
                console.log('🔄 Reconnecting...');
                await startBot();
            } else {
                // ← Auto hapus auth folder kalau 401
                console.log('❌ Sesi expired, menghapus auth dan restart otomatis...');
                fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                await startBot();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const message of messages) {
            if (!message?.message || !message?.key?.remoteJid || message.key.fromMe) continue;
            if (message.key.remoteJid === 'status@broadcast') continue;
            if (isOldMessage(message)) {
                logOldMessageSkip(message);
                continue;
            }

            // Deteksi balasan "Kami beda 5 minit jeee" dari BRIDGE
            const senderParticipant = message.key.participant || message.key.remoteJid;
            const msgText = getMessageBody(message.message);
            if (
                BRIDGE_NUMBER &&
                senderParticipant.startsWith(BRIDGE_NUMBER.split('@')[0]) &&
                msgText === 'Kami beda 5 minit jeee 😤'
            ) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Betul betul betul! 😄',
                }, { quoted: message });
                continue;
            }

            try {
                const helpCommandHandled = await handleHelpCommand(sock, message, msgText);
                if (helpCommandHandled) continue;

                const botStatusCommandHandled = await handleBotStatusCommand(sock, message, msgText);
                if (botStatusCommandHandled) continue;

                const adminSheetsCommandHandled = await handleAdminSheetsCommand(sock, message, msgText);
                if (adminSheetsCommandHandled) continue;

                const knowledgeCommandHandled = await handleKnowledgeCommand(sock, message, msgText);
                if (knowledgeCommandHandled) continue;

                const aiCommandHandled = await handleAICommand(sock, message, msgText);
                if (aiCommandHandled) continue;

                const wrappedMessage = wrapMessage(sock, message);
                await handleMessage(wrappedMessage, client);
                await handleAIMessage(sock, message);
            } catch (error) {
                console.error('Error handleMessage:', error);
            }
        }
    });
}

process.once('SIGINT', () => {
    shutdownBot('SIGINT');
});

process.once('SIGTERM', () => {
    shutdownBot('SIGTERM');
});

startBot().catch((error) => {
    console.error('Failed to start bot:', error);
});
