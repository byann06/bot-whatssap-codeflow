const config = require('../config');
const { loadMembers, saveMembers } = require('../repositories/members');
const { REGISTER_TEMPLATE } = require('../constants/menuTexts');
const { formatMemberInfo } = require('../services/menuFormatterService');
const {
    parseRegisterText,
    buildRegisterCommand,
} = require('../parsers/registrationParser');
const {
    normalizePhone,
    findMemberEntriesByIdentity,
} = require('../services/memberIdentityService');

const ALLOWED_ROLE_VALUES = config.allowedRoles;
const ALLOWED_MANAGEMENT_VALUES = config.allowedManagementRoles;

async function handleRegistrationCommand(context = {}) {
    const command = String(context.command || '').trim().toLowerCase();

    if (command === 'info') {
        await handleInfoCommand(context);
        return true;
    }

    if (command === 'daftar') {
        await handleRegisterCommand(context);
        return true;
    }

    if (command === 'add') {
        await handleAddCommand(context);
        return true;
    }

    return false;
}

async function handleRegistrationConversation(context = {}) {
    const {
        state,
        stateKey,
        msg,
        contact,
        senderName,
        senderIdentity,
        senderPhone,
        rawBody,
        conversationStates,
        replyToUser,
    } = context;

    if (!state || state.type !== 'register') {
        return false;
    }

    const text = String(rawBody || '').trim();

    if (state.step === 'askMode') {
        if (/^(lanjut|satu|satu satu|ya|y)$/i.test(text)) {
            state.step = 'name';
            await replyToUser(msg, contact, senderName, 'baik, tulis nama lengkap kamu.');
            return true;
        }

        const parsed = parseRegisterText(`daftar ${text}`);
        if (parsed) {
            const result = completeRegistration(parsed, senderIdentity, senderPhone);
            conversationStates.delete(stateKey);
            await replyToUser(msg, contact, senderName, result.error || 'pendaftaran berhasil disimpan. Sekarang kamu bisa ketik `info` untuk melihat data akunmu.');
            return true;
        }

        await replyToUser(msg, contact, senderName, 'ketik `lanjut` untuk daftar satu-satu, atau kirim format lengkap dengan koma.');
        return true;
    }

    const steps = ['name', 'npm', 'studyProgram', 'suggestion'];
    if (steps.includes(state.step)) {
        state.data[state.step] = text;

        if (state.step === 'name') {
            state.step = 'npm';
            await replyToUser(msg, contact, senderName, 'tulis NPM kamu. Kalau belum ada, ketik `belum`.');
            return true;
        }

        if (state.step === 'npm') {
            state.step = 'studyProgram';
            await replyToUser(msg, contact, senderName, 'tulis prodi kamu.');
            return true;
        }

        if (state.step === 'studyProgram') {
            state.step = 'suggestion';
            await replyToUser(msg, contact, senderName, 'tulis saran/harapan kamu untuk komunitas. Kalau tidak ada, ketik `-`.');
            return true;
        }

        const parsed = buildRegisterCommand({ ...state.data, role: 'Anggota', managementRole: '-' });
        const result = completeRegistration(parsed, senderIdentity, senderPhone);
        conversationStates.delete(stateKey);
        await replyToUser(msg, contact, senderName, result.error || 'pendaftaran berhasil disimpan. Sekarang kamu bisa ketik `info` untuk melihat data akunmu.');
        return true;
    }

    return false;
}

async function handleInfoCommand({ msg, contact, senderName, senderIdentity, findMembersByIdentity, logInteraction, replyToUser }) {
    logInteraction('OUTGOING', `reply=info | to=${senderName}`);
    const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });

    if (matchedMembers.length === 0) {
        await replyToUser(msg, contact, senderName, `data kamu belum terdaftar di sistem bot. Silakan daftar dulu dengan format:\n\`${REGISTER_TEMPLATE}\`\n\nContoh:\n\`daftar | ${senderName} | Belum Diinput | Sistem Informasi | Anggota | - | Ingin ikut aktif\``);
        return;
    }

    const memberSections = matchedMembers
        .map((member, index) => formatMemberInfo(member, matchedMembers.length > 1 ? index + 1 : null))
        .join('\n\n');

    await replyToUser(msg, contact, senderName, `${memberSections}`);
}

async function handleRegisterCommand({ msg, contact, senderName, senderIdentity, senderPhone, from, registerCommand, conversationStates, getConversationKey, logInteraction, replyToUser }) {
    if (!registerCommand) {
        conversationStates.set(getConversationKey(senderIdentity, from), { type: 'register', step: 'askMode', data: {} });
        logInteraction('OUTGOING', `reply=register_prompt | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'kamu bisa daftar sekali ketik dengan format:\n\n```\ndaftar\nnama [namaKamu],\nnpm [npmKamu],\nprodi [prodiKamu],\nsaran [saranKamu]\n```\n\nAtau lanjut satu-satu, ketik:\n`lanjut`\n\nnanti saya arahkan😊.');
        return;
    }

    const result = completeRegistration(registerCommand, senderIdentity, senderPhone);
    if (result.error) {
        logInteraction('OUTGOING', `reply=register_error | to=${senderName}`);
        await replyToUser(msg, contact, senderName, result.error);
        return;
    }

    logInteraction('OUTGOING', `reply=register_success | to=${senderName}`);
    await replyToUser(msg, contact, senderName, 'pendaftaran berhasil disimpan. Sekarang kamu bisa ketik `info` untuk melihat data akunmu.');
}

async function handleAddCommand({ msg, contact, senderName, senderIdentity, addCommand, logInteraction, replyToUser }) {
    if (!addCommand) {
        logInteraction('OUTGOING', `reply=add_invalid_format | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'format command belum benar. Contoh:\n`add npm 24042231035`\n`add no 628123456789`\n`add prodi Sistem Informasi`\n`add saran Perbanyak kegiatan rutin`');
        return;
    }

    const editableField = mapEditableField(addCommand.field);
    if (!editableField) {
        logInteraction('OUTGOING', `reply=add_invalid_field | to=${senderName} | field=${addCommand.field}`);
        await replyToUser(msg, contact, senderName, 'field yang bisa diubah: `nama`, `npm`, `prodi`, `role`, `pengurus`, `saran`, `no`.');
        return;
    }

    const members = loadMembers();
    const matchedIndexes = findMemberEntriesByIdentity(senderIdentity, { allowNameFallback: true });

    if (matchedIndexes.length === 0) {
        logInteraction('OUTGOING', `reply=add_not_found | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'data kamu belum ditemukan, jadi belum bisa diubah lewat command `add`.');
        return;
    }

    if (matchedIndexes.length > 1) {
        logInteraction('OUTGOING', `reply=add_duplicate_phone | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'nomor kamu terhubung ke lebih dari satu profil. Demi keamanan, command `add` dinonaktifkan dulu untuk nomor ini sampai data dirapikan admin.');
        return;
    }

    const { index, member } = matchedIndexes[0];
    const validationResult = validateMemberUpdate(editableField, addCommand.value, member);
    if (validationResult.error) {
        logInteraction('OUTGOING', `reply=add_validation_error | to=${senderName} | field=${editableField}`);
        await replyToUser(msg, contact, senderName, validationResult.error);
        return;
    }

    members[index] = {
        ...member,
        [editableField]: validationResult.value,
    };

    if (editableField === 'role' && validationResult.value === 'Anggota') {
        members[index].managementRole = '-';
    }

    saveMembers(members);
    logInteraction('OUTGOING', `reply=add_success | to=${senderName} | field=${editableField}`);
    await replyToUser(msg, contact, senderName, `data *${addCommand.field}* berhasil diperbarui menjadi *${validationResult.value || '-'}*.\nKetik *info* untuk melihat data terbaru kamu.`);
}

function completeRegistration(registerCommand, senderIdentity, senderPhone) {
    if (!registerCommand) return { error: 'format daftar belum benar.' };
    if (registerCommand.error) return { error: registerCommand.error };

    const members = loadMembers();
    const matchedIndexes = findMemberEntriesByIdentity(senderIdentity, { allowNameFallback: true });
    if (matchedIndexes.length > 0) {
        return { error: 'data kamu sudah terdaftar. Kalau mau koreksi data, gunakan command `add` atau cek dulu dengan `info`.' };
    }

    members.push({
        phone: senderPhone,
        ...(senderIdentity.lid && { lid: senderIdentity.lid }),
        ...registerCommand.value,
    });
    saveMembers(members);
    return { success: true };
}

function mapEditableField(field) {
    const aliases = {
        nama: 'name',
        npm: 'npm',
        prodi: 'studyProgram',
        jurusan: 'studyProgram',
        role: 'role',
        pengurus: 'managementRole',
        jabatan: 'managementRole',
        saran: 'suggestion',
        no: 'phone',
        nomor: 'phone',
        nowa: 'phone',
        wa: 'phone',
    };

    return aliases[field] || null;
}

function validateMemberUpdate(field, value, currentMember) {
    if (!value) {
        return { error: 'Nilai baru tidak boleh kosong.' };
    }

    if (field === 'phone') {
        const normalizedPhone = normalizePhone(value);
        if (!normalizedPhone) {
            return { error: 'Nomor WhatsApp tidak valid. Contoh: add no 628123456789.' };
        }

        return { value: normalizedPhone };
    }

    if (field === 'role') {
        const normalizedRole = normalizeRole(value);
        if (!normalizedRole) {
            return { error: `Role hanya boleh *${ALLOWED_ROLE_VALUES.join('*, *')}*.` };
        }

        return { value: normalizedRole };
    }

    if (field === 'managementRole') {
        const normalizedManagementRole = normalizeManagementRole(value);
        if (!normalizedManagementRole) {
            return { error: `Jabatan pengurus hanya boleh *${ALLOWED_MANAGEMENT_VALUES.join('*, *')}*.` };
        }

        if ((currentMember.role || '').toLowerCase() === 'anggota' && normalizedManagementRole !== '-') {
            return { error: 'Maaf Pengurus Hanya Bisa di isi Jika Role Kamu pengurus.' };
        }

        return { value: normalizedManagementRole };
    }

    if (field === 'npm' && /^belum\s+diinput$/i.test(value)) {
        return { value: '' };
    }

    return { value: value.trim() };
}

function normalizeRole(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (normalizedValue === 'anggota') {
        return 'Anggota';
    }

    if (normalizedValue === 'pengurus') {
        return 'Pengurus';
    }

    return null;
}

function normalizeManagementRole(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    const matchedValue = ALLOWED_MANAGEMENT_VALUES.find((item) => item.toLowerCase() === normalizedValue);
    return matchedValue || null;
}

module.exports = {
    handleRegistrationCommand,
    handleRegistrationConversation,
};
