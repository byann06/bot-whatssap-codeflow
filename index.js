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
const { handleMessage } = require('./handlers/menu');
const fs = require('fs');

const USE_PAIRING_CODE = process.argv.includes('pairing');
const PAIRING_NUMBER = process.env.PAIRING_NUMBER?.replace(/\D/g, '') || '';
const AUTH_DIR = path.join(__dirname, '.baileys_auth');
let cachedVersion;
const client = {
    sock: null,
    info: {
        wid: {
            _serialized: '',
        },
    },
};




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

            try {
                const wrappedMessage = wrapMessage(sock, message);
                await handleMessage(wrappedMessage, client);
            } catch (error) {
                console.error('Error handleMessage:', error);
            }
        }
    });
}

startBot().catch((error) => {
    console.error('Failed to start bot:', error);
});


