const pemateriData = require('../data/pemateri');
const {
    formatPemateriSchedule,
    formatMeetingForUser,
    buildPemateriReminderText,
} = require('../services/menuFormatterService');
const {
    normalizePhone,
    normalizeLid,
    findMemberByName,
    getMemberChatId,
} = require('../services/memberIdentityService');

async function handlePemateriCommand(context = {}) {
    if (context.adminCommands) {
        await handleAdminPemateriCommands(context);
        return true;
    }

    const command = String(context.command || '').trim().toLowerCase();

    if (command === 'pemateri') {
        await handlePemateriListCommand(context);
        return true;
    }

    if (command === 'jadwalku') {
        await handleMyScheduleCommand(context);
        return true;
    }

    return false;
}

async function handlePemateriListCommand({ msg, contact, senderName, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=pemateri | to=${senderName}`);
    await replyToUser(msg, contact, senderName, `berikut susunan pemateri kegiatan rutin:\n\n${formatPemateriSchedule(pemateriData.refreshScheduleReference())}`);
}

async function handleMyScheduleCommand({ msg, contact, senderName, senderIdentity, findPrimaryMemberByIdentity, logInteraction, replyToUser }) {
    pemateriData.refreshScheduleReference();
    const memberProfile = findPrimaryMemberByIdentity(senderIdentity, { allowNameFallback: true });
    const lookupName = memberProfile?.name || senderName;
    const schedule = pemateriData.findSpeakerSchedule(lookupName);

    if (!schedule) {
        logInteraction('OUTGOING', `reply=jadwalku_not_found | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'jadwal pemateri kamu belum terdaftar. Nanti tinggal isi data nama kamu di file jadwal pemateri.');
        return;
    }

    logInteraction('OUTGOING', `reply=jadwalku | to=${senderName} | week=${schedule.week} | order=${schedule.order}`);
    await replyToUser(msg, contact, senderName, formatMeetingForUser(schedule, lookupName));
}

async function handleAdminPemateriCommands(context) {
    const {
        msg,
        client,
        contact,
        senderName,
        senderIdentity,
        adminCommands,
        hasLidRole,
        komunikasiLid,
        pemateriLid,
        logInteraction,
        replyToUser,
    } = context;

    if (!hasLidRole(senderIdentity, komunikasiLid, pemateriLid)) {
        logInteraction('OUTGOING', `reply=admin_only_command_blocked | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'command ini khusus admin tidak bisa digunakan.');
        return;
    }

    const quotedMessage = msg.hasQuotedMsg ? await msg.getQuotedMessage().catch(() => null) : null;
    const explicitWeeks = adminCommands
        .map((action) => action.week)
        .filter((week) => Number.isInteger(week) && week > 0);
    const inheritedWeek = explicitWeeks.length > 0 ? explicitWeeks[0] : null;
    const scheduleCache = new Map();

    for (const action of adminCommands) {
        if (['remove', 'move', 'add_schedule'].includes(action.type) && !hasLidRole(senderIdentity, pemateriLid)) {
            await replyToUser(msg, contact, senderName, 'command ini khusus admin pemateri.');
            return;
        }

        if (['mention', 'forward', 'remind'].includes(action.type) && !hasLidRole(senderIdentity, komunikasiLid)) {
            await replyToUser(msg, contact, senderName, 'command ini khusus admin komunikasi.');
            return;
        }

        if (action.type === 'remove') {
            const removed = pemateriData.removeSpeakerByName(action.name);
            if (!removed) {
                await replyToUser(msg, contact, senderName, `nama *${action.name}* tidak ditemukan di jadwal pemateri.`);
                return;
            }

            logInteraction('OUTGOING', `reply=admin_remove_pemateri | to=${senderName} | name=${removed.removedSpeaker.name} | week=${removed.week} | line=${removed.line}`);
            await replyToUser(msg, contact, senderName, `nama *${removed.removedSpeaker.name}* berhasil dihapus dari Pertemuan ${removed.week} line ${removed.line}.`);
            return;
        }

        const targetWeek = action.needsInheritedWeek ? inheritedWeek : action.week;
        if (!Number.isInteger(targetWeek) || targetWeek <= 0) {
            logInteraction('OUTGOING', `reply=admin_pemateri_missing_week | to=${senderName}`);
            await replyToUser(msg, contact, senderName, 'command admin belum lengkap. Gunakan `pemateri 2`, `kirim to pertemuan 2`, atau `pemateri 2, kirim pesan`.');
            return;
        }

        if (!scheduleCache.has(targetWeek)) {
            scheduleCache.set(targetWeek, pemateriData.findScheduleByWeek(targetWeek) || null);
        }

        const schedule = scheduleCache.get(targetWeek);
        if (!schedule) {
            logInteraction('OUTGOING', `reply=admin_pemateri_not_found | to=${senderName} | week=${targetWeek}`);
            await replyToUser(msg, contact, senderName, `data pemateri untuk Pertemuan ${targetWeek} belum tersedia.`);
            return;
        }

        const adminReply = buildAdminPemateriReply(schedule);

        if (action.type === 'move') {
            const moved = pemateriData.moveSpeakerByName(action.name, action.week, action.line);
            if (!moved) {
                await replyToUser(msg, contact, senderName, `nama *${action.name}* tidak ditemukan di jadwal pemateri.`);
                return;
            }

            if (moved.error === 'invalid_target') {
                await replyToUser(msg, contact, senderName, 'tujuan perpindahan tidak valid. Contoh: `change "Abyan Ihza Pradipta" to pertemuan 6 line 1`.');
                return;
            }

            const swapNote = moved.swappedSpeaker ? ` Slot tujuan berisi *${moved.swappedSpeaker.name}* sehingga posisinya ditukar.` : '';
            logInteraction('OUTGOING', `reply=admin_move_pemateri | to=${senderName} | name=${moved.movedSpeaker.name} | from_week=${moved.fromWeek} | from_line=${moved.fromLine} | to_week=${moved.toWeek} | to_line=${moved.toLine}`);
            await replyToUser(msg, contact, senderName, `nama *${moved.movedSpeaker.name}* berhasil dipindahkan ke Pertemuan ${moved.toWeek} line ${moved.toLine}.${swapNote}`);
            return;
        }

        if (action.type === 'add_schedule') {
            const added = pemateriData.addSpeakerToSchedule(action.name, action.week, action.line);
            if (added?.error === 'already_exists') {
                await replyToUser(msg, contact, senderName, `nama *${action.name}* sudah ada di jadwal. Gunakan command \`change\` kalau mau memindahkan.`);
                return;
            }

            if (added?.error === 'slot_filled') {
                await replyToUser(msg, contact, senderName, `Pertemuan ${action.week} line ${action.line} sudah terisi *${added.speaker.name || '-'}*.`);
                return;
            }

            if (added?.error === 'invalid_target' || !added) {
                await replyToUser(msg, contact, senderName, 'tujuan penambahan tidak valid. Contoh: `add "Jamal" to pertemuan 10 line 3`.');
                return;
            }

            logInteraction('OUTGOING', `reply=admin_add_pemateri | to=${senderName} | name=${added.addedSpeaker.name} | week=${added.week} | line=${added.line}`);
            await replyToUser(msg, contact, senderName, `nama *${added.addedSpeaker.name}* berhasil ditambahkan ke Pertemuan ${added.week} line ${added.line}.`);
            return;
        }

        if (action.type === 'remind') {
            if (adminReply.recipients.length === 0) {
                await replyToUser(msg, contact, senderName, `belum ada pemateri yang bisa diingatkan untuk Pertemuan ${schedule.week}. Pastikan data anggota mereka sudah terdaftar.`);
                return;
            }

            for (const recipient of adminReply.recipients) {
                await client.sock.sendMessage(recipient.chatId, {
                    text: buildPemateriReminderText(recipient.name, schedule.week),
                });
                logInteraction('OUTGOING', `reply=admin_remind_pemateri | to=${recipient.name} | phone=${recipient.phone} | week=${schedule.week}`);
            }

            await msg.reply(`pengingat sudah dikirim. silahkan ${adminReply.mentions.map((mentionId) => `@${mentionId.split('@')[0]}`).join(' ')} cek pesan!`, undefined, {
                mentions: adminReply.mentions,
            });
            return;
        }

        if (action.type === 'mention') {
            logInteraction('OUTGOING', `reply=admin_pemateri | to=${senderName} | week=${schedule.week}`);
            if (quotedMessage) {
                await quotedMessage.reply(adminReply.text, undefined, {
                    mentions: adminReply.mentions,
                });
            } else {
                await msg.reply(adminReply.text, undefined, {
                    mentions: adminReply.mentions,
                });
            }
            continue;
        }

        if (!quotedMessage) {
            logInteraction('OUTGOING', `reply=admin_forward_requires_quote | to=${senderName} | week=${schedule.week}`);
            await replyToUser(msg, contact, senderName, `untuk mengirim pesan ke pemateri Pertemuan ${schedule.week}, reply dulu pesan atau file yang mau diteruskan.`);
            return;
        }

        for (const recipient of adminReply.recipients) {
            await quotedMessage.forward(recipient.chatId);
            logInteraction('OUTGOING', `forward=admin_pemateri_material | to=${recipient.name} | phone=${recipient.phone} | week=${schedule.week}`);
        }

        logInteraction('OUTGOING', `reply=admin_forward_success | to=${senderName} | week=${schedule.week} | total=${adminReply.recipients.length}`);
        await msg.reply(`pesan berhasil diteruskan . silahkan ${adminReply.mentions.map((mentionId) => `@${mentionId.split('@')[0]}`).join(' ')} cek pesan!`, undefined, {
            mentions: adminReply.mentions,
        });
    }
}

function buildAdminPemateriReply(schedule) {
    const mentions = [];
    const recipients = [];
    const lines = schedule.speakers.map((speaker, index) => {
        const member = findMemberByName(speaker.name);
        const chatId = getMemberChatId(member);
        if (chatId) {
            mentions.push(chatId);
            recipients.push({
                name: member.name,
                phone: normalizePhone(member.phone),
                lid: normalizeLid(member.lid),
                chatId,
            });
            return `${index + 1}. ${getMentionLabel(chatId)}`;
        }

        return `${index + 1}. ${speaker.name || '-'}`;
    });

    return {
        text: `Pemateri Pertemuan ${schedule.week}:\n${lines.join('\n')}`,
        mentions,
        recipients,
    };
}

function getMentionLabel(chatId) {
    return `@${String(chatId || '').split('@')[0]}`;
}

module.exports = {
    handlePemateriCommand,
};
