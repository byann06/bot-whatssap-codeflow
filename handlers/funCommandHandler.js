const fs = require('fs');
const config = require('../config');

const SIR_PAI_FILE = config.files.sirPai;
const SIR_PAI_COOLDOWN_MS = 60 * 1000;
const sirPaiCooldowns = new Map();

async function handleFunCommand(context = {}) {
    const command = String(context.command || '').trim().toLowerCase();

    if (command === 'sirpai') {
        await handleSirPaiCommand(context);
        return true;
    }

    if (command === 'upin ipin') {
        await handleUpinIpinCommand(context);
        return true;
    }

    if (command === 'min ukm di um apa aja ni?') {
        await handleUkmCommand(context);
        return true;
    }

    return false;
}

async function handleSirPaiCommand({ msg, client, contact, senderName, senderPhone, isGroup, from, logInteraction, replyToUser }) {
    if (!fs.existsSync(SIR_PAI_FILE)) {
        logInteraction('OUTGOING', `reply=sirpai_not_found | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'foto sir-pai belum ditemukan. Simpan file ke `assets/sir-pai.jpg` dulu ya.');
        return;
    }

    const sirPaiTargets = isGroup
        ? getSirPaiTargets(msg, client)
        : senderPhone ? [`${senderPhone}@s.whatsapp.net`] : [];

    if (isGroup && sirPaiTargets.length === 0) {
        logInteraction('OUTGOING', `reply=sirpai_no_target | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'tag teman yang mau kena sir-pai. Contoh: `@bot sirpai @teman`');
        return;
    }

    const cooldown = canUseSirPai(from, sirPaiTargets.length ? sirPaiTargets : [senderPhone || from]);
    if (!cooldown.allowed) {
        logInteraction('OUTGOING', `reply=sirpai_cooldown | to=${senderName} | wait=${cooldown.secondsLeft}`);
        await replyToUser(msg, contact, senderName, `sir-pai lagi istirahat. Coba lagi ${cooldown.secondsLeft} detik lagi.`);
        return;
    }

    logInteraction('OUTGOING', `reply=sirpai | to=${senderName} | targets=${sirPaiTargets.join(',') || senderPhone || from}`);
    await sendSirPai(msg, client, sirPaiTargets);
}

async function handleUpinIpinCommand({ msg, client }) {
    const ipinNumber = '6283166111757@s.whatsapp.net';

    await client.sock.sendMessage(msg.key.remoteJid, {
        text: `Halo saye upin dan ini adik saye ipin! 🌙\n@${ipinNumber.split('@')[0]}`,
        mentions: [ipinNumber],
    });
}

async function handleUkmCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=ukm | to=${senderName}`);
    await replyToUser(msg, contact, senderName,
        `UKM di UM? Ini dia:\n\n` +
        `MAPALA\n` +
        `MENWA\n` +
        `PENCAK SILAT\n` +
        `SANGGAR SENI\n` +
        `DKV\n` +
        `PRAMUKA\n` +
        `ROHIS`
    );
}

function getSirPaiTargets(msg, client) {
    const botNumber = client?.info?.wid?._serialized || '';
    const mentionedIds = (msg.mentionedIds || [])
        .map((jid) => String(jid || '').replace(/@c\.us$/i, '@s.whatsapp.net'))
        .filter(Boolean);

    if (/^@\d+\s+/i.test(String(msg.body || '').trim()) && mentionedIds.length > 1) {
        mentionedIds.shift();
    }

    return [...new Set(mentionedIds.filter((jid) => jid !== botNumber))];
}

function canUseSirPai(chatId, targetIds) {
    const now = Date.now();
    const key = `${chatId}:${targetIds.sort().join(',')}`;
    const lastUsedAt = sirPaiCooldowns.get(key) || 0;

    if (now - lastUsedAt < SIR_PAI_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((SIR_PAI_COOLDOWN_MS - (now - lastUsedAt)) / 1000);
        return { allowed: false, secondsLeft };
    }

    sirPaiCooldowns.set(key, now);
    return { allowed: true, secondsLeft: 0 };
}

async function sendSirPai(msg, client, targetIds) {
    const image = fs.readFileSync(SIR_PAI_FILE);
    const targetMentions = targetIds.map((jid) => `@${jid.split('@')[0]}`).join(' ');
    return client.sock.sendMessage(msg.from, {
        image,
        caption: `${targetMentions}\n\nSir Pai telah turun tangan. This it SirPai Not KingPaaiii.`.trim(),
        mentions: targetIds,
    }, {
        quoted: msg.key ? { key: msg.key, message: { conversation: msg.body || '' } } : undefined,
    });
}

module.exports = {
    handleFunCommand,
    getSirPaiTargets,
    canUseSirPai,
    sendSirPai,
};