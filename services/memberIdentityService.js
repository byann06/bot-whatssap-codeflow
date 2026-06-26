const { loadMembers } = require('../repositories/members');

function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
        return '';
    }

    if (digits.startsWith('0')) {
        return `62${digits.slice(1)}`;
    }

    if (digits.startsWith('8')) {
        return `62${digits}`;
    }

    return digits;
}

function normalizeLid(value) {
    const jid = String(value || '').trim();
    return jid.endsWith('@lid') ? jid : '';
}

function normalizeNameKey(value) {
    return String(value || '').trim().toLowerCase();
}

function getSenderPhone(contact, msg) {
    const candidates = [
        msg.author,
        msg?.key?.participant,
        contact?.id?._serialized,
        msg.from,
        msg?.key?.remoteJid,
    ];

    for (const candidate of candidates) {
        const sourceId = String(candidate || '').trim();
        if (!sourceId || sourceId.endsWith('@lid') || sourceId.endsWith('@g.us') || sourceId.endsWith('@newsletter')) {
            continue;
        }

        const phone = normalizePhone(sourceId.split('@')[0]);
        if (phone) {
            return phone;
        }
    }

    return '';
}

function getSenderLid(contact, msg) {
    const candidates = [
        msg.author,
        msg.from,
        msg?.key?.participant,
        msg?.key?.remoteJid,
        contact?.id?._serialized,
    ];

    for (const candidate of candidates) {
        const lid = normalizeLid(candidate);
        if (lid) {
            return lid;
        }
    }

    return '';
}

function buildSenderIdentity(contact, msg, senderName) {
    return {
        phone: getSenderPhone(contact, msg),
        lid: getSenderLid(contact, msg),
        names: [...new Set([
            senderName,
            contact?.pushname,
            contact?.name,
            msg.pushName,
        ].map(normalizeNameKey).filter(Boolean))],
    };
}

function findMembersByPhone(phone) {
    const normalizedPhone = normalizePhone(phone);
    return loadMembers().filter((member) => normalizePhone(member.phone) === normalizedPhone);
}

function findMemberEntriesByIdentity(identity, options = {}) {
    const members = loadMembers();
    const matches = new Map();
    const phone = normalizePhone(identity?.phone);
    const lid = normalizeLid(identity?.lid);
    const names = Array.isArray(identity?.names) ? identity.names : [];

    members.forEach((member, index) => {
        if (phone && normalizePhone(member.phone) === phone) {
            matches.set(index, { member, index });
            return;
        }

        if (lid && normalizeLid(member.lid) === lid) {
            matches.set(index, { member, index });
            return;
        }

        if (options.allowNameFallback && names.includes(normalizeNameKey(member.name))) {
            matches.set(index, { member, index });
        }
    });

    return [...matches.values()];
}

function findMemberByName(name) {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) {
        return null;
    }

    return loadMembers().find((member) => String(member.name || '').trim().toLowerCase() === normalizedName) || null;
}

function getMemberChatId(member) {
    const lid = normalizeLid(member?.lid);
    if (lid) {
        return lid;
    }

    const phone = normalizePhone(member?.phone);
    return phone ? `${phone}@s.whatsapp.net` : '';
}

module.exports = {
    normalizePhone,
    normalizeLid,
    normalizeNameKey,
    getSenderPhone,
    getSenderLid,
    buildSenderIdentity,
    findMembersByPhone,
    findMemberEntriesByIdentity,
    findMemberByName,
    getMemberChatId,
};