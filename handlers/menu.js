const fs = require('fs');
const path = require('path');

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
const pemateriData = require('../data/pemateri');
const driveDocs = require('./drive');

const MENU_TEXT = `
>>menu - melihat daftar perintah bot 

>>link - melihat link penting komunitas

>>info - melihat data akun anggota

>>daftar - mendaftarkan akun anggota baru

>>add - mengubah data diri yang sudah terdaftar

>>pemateri - melihat susunan pemateri kegiatan

>>jadwalku - melihat giliran kamu sebagai pemateri

>>logo - meminta file logo komunitas

>>create folder - membuat folder dokumentasi Google Drive

>>folder aktif - memilih folder dokumentasi aktif

>>share to discord - membagikan link dokumentasi ke Discord

>>sirpai - fitur fun untuk mention teman dengan foto sir-pai

>>hadir - mencatat kehadiran hari ini

>>daftar hadir - melihat rekap kehadiran hari ini

>>codeflowchallenge - melihat info challenge season 1

>>aspek penilaian - melihat aspek penilaian pemenang
`;

const LINK_KOMUNITAS = `
*🌐 Link Komunitas CodeFlow Community*

🔗 *WhatsApp Channel*
👉 https://whatsapp.com/channel/0029Vb7I0E11HspvtixrkS06
📌 Informasi, materi, tips, dan update seputar Web Development.

💻 *GitHub*
👉 https://github.com/CodeFlow-community
📌 Repository kode program dan project komunitas.

📚 *Pusat Literasi*
👉 https://drive.google.com/drive/folders/1icdU9FwZnKRn3F9PkpPVHHd-A_vLEnK-
📌 Perpustakaan digital CFC dan sumber literasi.

🖼️ *Dokumentasi Kegiatan*
👉 https://drive.google.com/drive/folders/14BkC8l8IG0rNrdTLWJTT-O6lMUjLRym2
📌 Foto dan video kegiatan komunitas.

🎮 *Discord*
👉 https://discord.gg/XPKSHbtH
📌 Diskusi, sharing, main game bareng, dan interaksi antaar anggota.

🎵 *TikTok*
👉 https://www.tiktok.com/@codeflowcom
📌 Tips dan dokumentasi kegiatan dalam bentuk video.

📸 *Instagram*
👉 https://www.instagram.com/codeflowcom
📌 Publikasi kegiatan dan dokumentasi visual komunitas.

📚 *Materi Pembelajaran*
👉 _(segera hadir)_
📌 Materi pembelajaran mingguan.

📊 *Laporan Kas*
👉 _(segera hadir)_
📌 Pemasukan dan pengeluaran kas komunitas secara transparan.
`;

const LOGO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const AVAILABLE_COMMANDS = new Set(['menu', 'link', 'logo', 'drive auth', 'sirpai', 'info', 'daftar', 'pemateri', 'jadwalku', 'add', 'hadir', 'daftar hadir', 'codeflowchallenge', 'aspek penilaian']);
const INFO_TEMPLATE = `
*Informasi Akun Anggota*
>> Nama :
>> NPM :
>> Prodi :
>> Role : (Anggota/Pengurus)
>> Pengurus : (Pembina/Ketua/Wakil Ketua/Sekretaris/Bendahara/Divisi Medig/Divisi Perlog)
>> Berikan saran :

*Noted:*
- Jika role kamu *Anggota*, isi bagian *Pengurus* dengan \`-\`
- Jika role kamu *Pengurus*, isi sesuai jabatan
`;
const CODEFLOW_CHALLENGE_TEXT = `
*CodeFlow Challenge*

*Syarat Peserta:*
1. Kehadiran >> minimal 90% dari total pertemuan season 1
2. Uang Kas >> wajib melunasi sebelum season berakhir
3. Jadi Pemateri >> setiap kelompok wajib tampil sesuai jadwal

*3 Kategori Pemenang:*
1. Best Pemateri
2. Most Consistent
3. Best Progress

*Hadiah:*
>> 5% per 1 orang dari pemasukan uang kas dan pembulatan mata uang
>> Sertifikat dari Code Flow Community

*Ketentuan Hadiah:*
>> Hadiah dapat berupa uang tunai atau barang sesuai kesepakatan
>> 1 orang maksimal bisa memenangkan 1 kategori

Ketik *aspek penilaian* untuk melihat aspek penilaian pemenang.
`;
const ASPEK_PENILAIAN_TEXT = `
*Aspek Penilaian Pemenang*

Belum diinput
`;
const REGISTER_TEMPLATE = 'daftar | Nama Lengkap | NPM | Prodi | Role | Pengurus | Saran';
const MEMBERS_FILE = path.join(__dirname, '..', 'data', 'members.json');
const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'attendance.json');
const SIR_PAI_FILE = path.join(__dirname, '..', 'assets', 'sir-pai.jpg');
const SIR_PAI_COOLDOWN_MS = 60 * 1000;
const sirPaiCooldowns = new Map();
const ADMIN_PHONE = process.env.ADMIN_PHONE.split(',').map(v => v.trim());
const ADMIN_LID = process.env.ADMIN_LID.split(',').map(v => v.trim());;
const ALLOWED_ROLE_VALUES = ['Anggota', 'Pengurus'];
const ALLOWED_MANAGEMENT_VALUES = ['Pembina', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Divisi Medig', 'Divisi Perlog', '-'];

function logInteraction(type, details) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] [${type}] ${details}`);
}

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

function loadMembers() {
    if (!fs.existsSync(MEMBERS_FILE)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(MEMBERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        logInteraction('WARN', `members | reason=load_failed | error="${error.message}"`);
        return [];
    }
}

function saveMembers(members) {
    fs.writeFileSync(MEMBERS_FILE, `${JSON.stringify(members, null, 2)}\n`, 'utf8');
}

function loadAttendance() {
    if (!fs.existsSync(ATTENDANCE_FILE)) {
        return {};
    }

    try {
        const raw = fs.readFileSync(ATTENDANCE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        logInteraction('WARN', 'attendance | reason=load_failed | error=' + error.message);
        return {};
    }
}

function saveAttendance(attendance) {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendance, null, 2) + '\n', 'utf8');
}

function getWibDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function getWibTimeLabel(date = new Date()) {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date).replace(':', '.');
}

function formatDateKey(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-');
    return year && month && day ? day + '/' + month + '/' + year : dateKey;
}

function parseAttendanceReportCommand(rawBody) {
    const match = String(rawBody || '').trim().match(/^daftar\s+hadir(?:\s+(\d{4}-\d{2}-\d{2}))?$/i);
    if (!match) {
        return null;
    }

    return {
        dateKey: match[1] || getWibDateKey(),
    };
}

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

    return null;
}

function isAdminUser(senderPhone, msg) {
    if (senderPhone === ADMIN_PHONE) {
        return true;
    }

    const ids = [
        msg?.author, msg?.from,
        msg?.key?.remoteJid,
        msg?.key?.participant
    ]
        .filter(Boolean)
        .map(v => String(v).trim())

    return ids.some(id => ADMIN_LID.includes(id));
}

function isDocumentationAdmin(senderPhone, msg) {
    return isAdminUser(senderPhone, msg);
}

function isDocumentationUploadCommand(rawBody) {
    return /^upload\s+(dokumentasi|docs?)$/i.test(String(rawBody || '').trim());
}

function getDriveErrorMessage(error) {
    const code = error?.message || '';
    const messages = {
        credentials_not_found: 'file Google Drive credentials belum ditemukan. Pastikan ada di `credentials/google-drive-credentials.json`.',
        invalid_credentials: 'file Google Drive credentials tidak valid. Download ulang OAuth Client JSON dari Google Cloud.',
        drive_not_authorized: 'Google Drive belum login. Jalankan `drive auth`, buka link, lalu kirim `drive code <kode>`.',
        parent_folder_required: 'GOOGLE_DRIVE_PARENT_FOLDER_ID belum diisi di `.env` bot utama.',
        folder_name_required: 'nama folder wajib diisi. Contoh: `create folder "pkkmb 2026"`.',
        folder_not_found: 'folder dokumentasi belum ditemukan. Buat dulu dengan `create folder "nama folder"`.',
        active_folder_required: 'belum ada folder aktif. Pilih dulu dengan `folder aktif "nama folder"`.',
        discord_channel_unavailable: 'bridge Discord hidup, tapi channel Discord belum bisa diakses.',
        unauthorized: 'BRIDGE_INTERNAL_SECRET tidak cocok dengan secret di bridge.',
    };

    return messages[code] || `terjadi error dokumentasi: ${code || 'unknown_error'}`;
}

function recordAttendance(member, phone) {
    const attendance = loadAttendance();
    const dateKey = getWibDateKey();
    const todayRecords = Array.isArray(attendance[dateKey]) ? attendance[dateKey] : [];
    const existingRecord = todayRecords.find((record) => normalizePhone(record.phone) === normalizePhone(phone));

    if (existingRecord) {
        return { status: 'exists', dateKey, record: existingRecord };
    }

    const now = new Date();
    const record = {
        phone: normalizePhone(phone),
        name: member.name || '-',
        npm: member.npm || '',
        role: member.role || '-',
        time: getWibTimeLabel(now),
        timestamp: now.toISOString(),
    };

    todayRecords.push(record);
    attendance[dateKey] = todayRecords;
    saveAttendance(attendance);

    return { status: 'saved', dateKey, record };
}

function formatAttendanceReport(dateKey) {
    const attendance = loadAttendance();
    const records = Array.isArray(attendance[dateKey]) ? attendance[dateKey] : [];

    if (records.length === 0) {
        return '*Daftar Hadir - ' + formatDateKey(dateKey) + '*\n\nBelum ada anggota yang mengisi hadir.';
    }

    const lines = records.map((record, index) => (index + 1) + '. ' + (record.name || '-') + ' - ' + (record.time || '-') + ' WIB');
    return '*Daftar Hadir - ' + formatDateKey(dateKey) + '*\nTotal: ' + records.length + ' anggota\n\n' + lines.join('\n');
}
function getMentionHandle(contact, senderName) {
    const mentionId = contact?.id?._serialized || '';
    if (mentionId) {
        return `@${mentionId.split('@')[0]}`;
    }

    return senderName;
}

function getMentionTargets(contact) {
    return contact ? [contact] : [];
}

async function replyToUser(msg, contact, senderName, text) {
    const mentionHandle = getMentionHandle(contact, senderName);
    return msg.reply(`${mentionHandle} ${text}`.trim(), undefined, {
        mentions: getMentionTargets(contact),
    });
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

function formatPemateriSchedule() {
    const sections = pemateriData.refreshScheduleReference().map((schedule) => {
        const speakerLines = schedule.speakers
            .map((speaker, index) => `${index + 1}. ${speaker.name || '-'}`)
            .join('\n');

        return `*Pertemuan ${schedule.week}:*\n${speakerLines}`;
    });

    return `*Susunan Pemateri Gen 2*\n\n${sections.join('\n\n')}`;
}

function formatMeetingForUser(schedule, lookupName) {
    const normalizedLookupName = String(lookupName || '').trim().toLowerCase();
    const lines = schedule.speakers.map((speaker, index) => {
        const speakerName = String(speaker.name || '-').trim() || '-';
        const isCurrentUser = speakerName.toLowerCase() === normalizedLookupName;
        const displayName = isCurrentUser ? `*${speakerName}*` : speakerName;
        return `${index + 1}. ${displayName}`;
    });

    return `Pertemuan ${schedule.week}:\n${lines.join('\n')}`;
}

function formatMemberInfo(member, index = null) {
    const title = index ? `*Informasi Akun ${index}*` : '*Informasi Akun Anggota*';
    return [
        title,
        `>> Nama : ${member.name || '-'}`,
        `>> NPM : ${member.npm || '-'}`,
        `>> Prodi : ${member.studyProgram || '-'}`,
        `>> Role : ${member.role || '-'}`,
        `>> Pengurus : ${member.managementRole || '-'}`,
        `>> Nomor Untuk Dihubungi : ${member.phone || '-'}`,
        `>> Berikan saran : ${member.suggestion || '-'}`,
    ].join('\n');
}

function getLogoPaths() {
    const assetsDir = path.join(__dirname, '..', 'assets');
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

function getSenderPhone(contact, msg) {
    const candidates = [msg.author, msg.from, contact?.id?._serialized];

    for (const candidate of candidates) {
        const sourceId = String(candidate || '');
        if (!sourceId || sourceId.endsWith('@lid')) {
            continue;
        }

        const phone = normalizePhone(sourceId.split('@')[0]);
        if (phone) {
            return phone;
        }
    }

    return normalizePhone(String(contact?.id?._serialized || '').split('@')[0]);
}

function findMembersByPhone(phone) {
    const normalizedPhone = normalizePhone(phone);
    return loadMembers().filter((member) => normalizePhone(member.phone) === normalizedPhone);
}

function findPrimaryMemberByPhone(phone) {
    const matchedMembers = findMembersByPhone(phone);
    return matchedMembers.length === 1 ? matchedMembers[0] : null;
}

function findMemberByName(name) {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) {
        return null;
    }

    return loadMembers().find((member) => String(member.name || '').trim().toLowerCase() === normalizedName) || null;
}

function parseAdminCommands(rawBody) {
    const segments = String(rawBody || '')
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length === 0) {
        return null;
    }

    const actions = [];

    for (const segment of segments) {
        const mentionMatch = segment.match(/^pemateri\s+(\d+)$/i);
        if (mentionMatch) {
            actions.push({
                type: 'mention',
                week: Number(mentionMatch[1]),
            });
            continue;
        }

        const forwardMatch = segment.match(/^kirim\s+to\s+pertemuan\s+(\d+)$/i);
        if (forwardMatch) {
            actions.push({
                type: 'forward',
                week: Number(forwardMatch[1]),
            });
            continue;
        }

        if (/^kirim\s+pesan$/i.test(segment)) {
            actions.push({
                type: 'forward',
                week: null,
                needsInheritedWeek: true,
            });
            continue;
        }

        const removeMatch = segment.match(/^remove\s+(.+)$/i);
        if (removeMatch) {
            actions.push({
                type: 'remove',
                name: removeMatch[1].replace(/^"|"$/g, '').trim(),
            });
            continue;
        }

        const changeMatch = segment.match(/^change\s+"?(.+?)"?\s+to\s+pertemuan\s+(\d+)\s+line\s+(\d+)$/i);
        if (changeMatch) {
            actions.push({
                type: 'move',
                name: changeMatch[1].trim(),
                week: Number(changeMatch[2]),
                line: Number(changeMatch[3]),
            });
            continue;
        }

        const addScheduleMatch = segment.match(/^add\s+"?(.+?)"?\s+to\s+pertemuan\s+(\d+)\s+line\s+(\d+)$/i);
        if (addScheduleMatch) {
            actions.push({
                type: 'add_schedule',
                name: addScheduleMatch[1].trim(),
                week: Number(addScheduleMatch[2]),
                line: Number(addScheduleMatch[3]),
            });
            continue;
        }

        const remindMatch = segment.match(/^ingatkan\s+pemateri\s+(\d+)$/i);
        if (remindMatch) {
            actions.push({
                type: 'remind',
                week: Number(remindMatch[1]),
            });
            continue;
        }

        return null;
    }

    return actions.length > 0 ? actions : null;
}

function buildAdminPemateriReply(schedule) {
    const mentions = [];
    const recipients = [];
    const lines = schedule.speakers.map((speaker, index) => {
        const member = findMemberByName(speaker.name);
        if (member?.phone) {
            const chatId = `${normalizePhone(member.phone)}@s.whatsapp.net`;
            mentions.push(chatId);
            recipients.push({
                name: member.name,
                phone: normalizePhone(member.phone),
                chatId,
            });
            return `${index + 1}. @${normalizePhone(member.phone)}`;
        }

        return `${index + 1}. ${speaker.name || '-'}`;
    });

    return {
        text: `Pemateri Pertemuan ${schedule.week}:\n${lines.join('\n')}`,
        mentions,
        recipients,
    };
}

function buildPemateriReminderText(recipientName, week) {
    return [
        `Halo ${recipientName},`,
        `ini pengingat bahwa kamu terjadwal sebagai pemateri Pertemuan ${week} di Code Flow Community.`,
        'Mohon siapkan materi dan pantau grup untuk informasi lanjutan dari admin.',
    ].join('\n');
}

function parseAddCommand(rawBody) {
    const match = String(rawBody || '').trim().match(/^add\s+(\S+)\s+(.+)$/i);
    if (!match) {
        return null;
    }

    return {
        field: match[1].toLowerCase(),
        value: match[2].trim(),
    };
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

function parseRegisterCommand(rawBody) {
    const registerMatch = String(rawBody || '').trim().match(/^daftar\s*\|(.+)$/i);
    if (!registerMatch) {
        return null;
    }

    const parts = registerMatch[1].split('|').map((part) => part.trim());
    if (parts.length < 6) {
        return { error: `format daftar belum lengkap. Gunakan:\n\`${REGISTER_TEMPLATE}\`` };
    }

    const [name, npm, studyProgram, role, managementRole, suggestion = '-'] = parts;
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
        return { error: `Role hanya boleh *${ALLOWED_ROLE_VALUES.join('*, *')}*.` };
    }

    if (normalizedRole === 'Pengurus') {
        return { error: 'Pendaftaran sebagai *Pengurus* tidak bisa dilakukan lewat bot. Silakan hubungi admin untuk pendataan pengurus.' };
    }

    const normalizedManagementRole = normalizeManagementRole(managementRole);
    if (!normalizedManagementRole) {
        return { error: `Jabatan pengurus hanya boleh *${ALLOWED_MANAGEMENT_VALUES.join('*, *')}*.` };
    }

    if (normalizedManagementRole !== '-') {
        return { error: 'Maaf Daftar Data Hanya diKHUSUSkan untuk anggota .isi bidang Role Sebagai "Anggota", lalu kirimkan ulang format dengan benar.' };
    }

    if (!name || !studyProgram) {
        return { error: 'Nama dan prodi wajib diisi saat daftar.' };
    }

    return {
        value: {
            name,
            npm: /^belum\s+diinput$/i.test(npm) ? '' : npm,
            studyProgram,
            role: normalizedRole,
            managementRole: normalizedManagementRole,
            suggestion: suggestion || '-',
        },
    };
}

async function handleMessage(msg, client) {
    const rawBody = msg.body.replace(/@\d+/g, '').replace(/^@bot\s+/i, '').trim();
    const body = rawBody.toLowerCase();
    const from = msg.from || '';
    const author = msg.author || '';
    const isChannelMessage = from.endsWith('@newsletter') || author.endsWith('@newsletter');

    if (isChannelMessage) {
        logInteraction('SKIP', `CHANNEL | chat=${from} | reason=unsupported_newsletter_message`);
        return;
    }

    const contact = await msg.getContact().catch(() => null);
    const senderName = contact?.pushname || contact?.name || author || from;
    const senderPhone = getSenderPhone(contact, msg);
    const addCommand = parseAddCommand(rawBody);
    const registerCommand = parseRegisterCommand(rawBody);
    const adminCommands = parseAdminCommands(rawBody);
    const attendanceReportCommand = parseAttendanceReportCommand(rawBody);
    const documentationCommand = parseDocumentationCommand(rawBody);
    const documentationUploadCommand = isDocumentationUploadCommand(rawBody);
    const primaryCommand = addCommand ? 'add' : registerCommand ? 'daftar' : attendanceReportCommand ? 'daftar hadir' : documentationCommand ? 'documentation' : body;

    let chat = null;
    let chatType = 'PRIVATE';
    let isGroup = false;

    try {
        chat = await msg.getChat();
        isGroup = Boolean(chat?.isGroup);
        chatType = isGroup ? 'GROUP' : 'PRIVATE';
    } catch (error) {
        logInteraction('WARN', `chat=${from} | reason=getChat_failed | error="${error.message}"`);
    }

    logInteraction('INCOMING', `${chatType} | from=${senderName} | chat=${from} | body="${msg.body}" | command="${body || '-'}"`);

    if (isAdminUser(senderPhone, msg) && adminCommands) {
        const quotedMessage = msg.hasQuotedMsg ? await msg.getQuotedMessage().catch(() => null) : null;
        const explicitWeeks = adminCommands
            .map((action) => action.week)
            .filter((week) => Number.isInteger(week) && week > 0);
        const inheritedWeek = explicitWeeks.length > 0 ? explicitWeeks[0] : null;
        const scheduleCache = new Map();

        for (const action of adminCommands) {
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

        return;
    }

    if (adminCommands) {
        logInteraction('OUTGOING', `reply=admin_only_command_blocked | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'command ini khusus admin dan tidak bisa digunakan oleh anggota lain.');
        return;
    }

    if (msg.mediaInfo && typeof msg.downloadMedia === 'function' && documentationUploadCommand) {
        if (!isDocumentationAdmin(senderPhone, msg)) {
            logInteraction('SKIP', `DOCUMENTATION_UPLOAD | from=${senderName} | reason=not_admin`);
            return;
        }

        try {
            const media = await msg.downloadMedia();
            if (!media?.buffer) {
                await replyToUser(msg, contact, senderName, 'dokumen gagal dibaca dari WhatsApp. Coba kirim ulang sebagai document.');
                return;
            }

            const uploaded = await driveDocs.uploadBufferToActiveFolder(from, media);
            logInteraction('OUTGOING', `reply=documentation_upload_success | to=${senderName} | folder=${uploaded.folder.name} | file=${uploaded.file.name}`);
            await replyToUser(msg, contact, senderName, `file *${uploaded.file.name}* berhasil diupload ke folder *${uploaded.folder.name}*.`);
            return;
        } catch (error) {
            logInteraction('OUTGOING', `reply=documentation_upload_error | to=${senderName} | error=${error.message}`);
            await replyToUser(msg, contact, senderName, getDriveErrorMessage(error));
            return;
        }
    }

    if (isGroup) {
        const botNumber = client.info.wid._serialized;
        const isMentioned = msg.mentionedIds?.includes(botNumber);
        const isKnownCommand = AVAILABLE_COMMANDS.has(primaryCommand) || primaryCommand === 'documentation' || documentationUploadCommand || Boolean(adminCommands);
        if (!isMentioned && !isKnownCommand) {
            logInteraction('SKIP', `GROUP | from=${senderName} | reason=not_mentioned_and_unknown_command`);
            return;
        }
    }

    switch (primaryCommand) {
        case 'documentation': {
            if (!isDocumentationAdmin(senderPhone, msg)) {
                logInteraction('OUTGOING', `reply=documentation_admin_only | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'fitur dokumentasi khusus admin/pengurus yang diberi akses.');
                break;
            }

            try {
                if (documentationCommand.type === 'drive_auth') {
                    const authUrl = driveDocs.getAuthUrl();
                    logInteraction('OUTGOING', `reply=drive_auth | to=${senderName}`);
                    await replyToUser(msg, contact, senderName, `buka link ini untuk login Google Drive:\n${authUrl}\n\nSetelah dapat kode, kirim:\n\`drive code KODE_DARI_GOOGLE\``);
                    break;
                }

                if (documentationCommand.type === 'drive_code') {
                    await driveDocs.saveTokenFromCode(documentationCommand.code);
                    logInteraction('OUTGOING', `reply=drive_code_saved | to=${senderName}`);
                    await replyToUser(msg, contact, senderName, 'login Google Drive berhasil disimpan. Sekarang bot bisa membuat folder dan upload dokumentasi.');
                    break;
                }

                if (documentationCommand.type === 'create_folder') {
                    const folder = await driveDocs.createFolder(documentationCommand.name, senderName);
                    driveDocs.setActiveFolder(from, folder.name);
                    logInteraction('OUTGOING', `reply=documentation_folder_created | to=${senderName} | folder=${folder.name}`);
                    await replyToUser(msg, contact, senderName, `${folder.exists ? 'folder sudah ada' : 'folder berhasil dibuat'}: *${folder.name}*\nFolder ini juga sudah dijadikan folder aktif.\n${folder.link}`);
                    break;
                }

                if (documentationCommand.type === 'set_active_folder') {
                    const folder = driveDocs.setActiveFolder(from, documentationCommand.name);
                    logInteraction('OUTGOING', `reply=documentation_active_folder | to=${senderName} | folder=${folder.name}`);
                    await replyToUser(msg, contact, senderName, `folder aktif sekarang: *${folder.name}*. Kirim dokumentasi sebagai document agar langsung diupload ke folder ini.`);
                    break;
                }

                if (documentationCommand.type === 'share_folder') {
                    const result = await driveDocs.shareFolderToDiscord(documentationCommand.name, senderName);
                    logInteraction('OUTGOING', `reply=documentation_share_discord | to=${senderName} | folder=${result.folder.name}`);
                    await replyToUser(msg, contact, senderName, `link folder *${result.folder.name}* berhasil dikirim ke Discord.`);
                    break;
                }
            } catch (error) {
                logInteraction('OUTGOING', `reply=documentation_error | to=${senderName} | error=${error.message}`);
                await replyToUser(msg, contact, senderName, getDriveErrorMessage(error));
                break;
            }

            break;
        }

        case 'menu':
            logInteraction('OUTGOING', `reply=menu | to=${senderName}`);
            await replyToUser(msg, contact, senderName, MENU_TEXT);
            break;

        case 'hadir': {
            const matchedMembers = findMembersByPhone(senderPhone);
            if (matchedMembers.length === 0) {
                logInteraction('OUTGOING', 'reply=attendance_not_registered | to=' + senderName);
                await replyToUser(msg, contact, senderName, 'data kamu belum terdaftar, jadi kehadiran belum bisa dicatat. Silakan daftar dulu dengan format:\n' + REGISTER_TEMPLATE);
                break;
            }

            if (matchedMembers.length > 1) {
                logInteraction('OUTGOING', 'reply=attendance_duplicate_phone | to=' + senderName);
                await replyToUser(msg, contact, senderName, 'nomor kamu terhubung ke lebih dari satu profil. Hubungi admin dulu supaya data bisa dirapikan sebelum absen.');
                break;
            }

            const attendanceResult = recordAttendance(matchedMembers[0], senderPhone);
            if (attendanceResult.status === 'exists') {
                logInteraction('OUTGOING', 'reply=attendance_exists | to=' + senderName + ' | date=' + attendanceResult.dateKey);
                await replyToUser(msg, contact, senderName, 'kehadiran kamu hari ini sudah tercatat pada ' + (attendanceResult.record.time || '-') + ' WIB.');
                break;
            }

            logInteraction('OUTGOING', 'reply=attendance_saved | to=' + senderName + ' | date=' + attendanceResult.dateKey);
            await replyToUser(msg, contact, senderName, 'kehadiran berhasil dicatat untuk ' + formatDateKey(attendanceResult.dateKey) + ' pukul ' + attendanceResult.record.time + ' WIB.');
            break;
        }

        case 'daftar hadir': {
            if (!isAdminUser(senderPhone, msg)) {
                logInteraction('OUTGOING', 'reply=attendance_report_admin_only | to=' + senderName);
                await replyToUser(msg, contact, senderName, 'rekap daftar hadir hanya bisa dilihat oleh admin.');
                break;
            }

            logInteraction('OUTGOING', 'reply=attendance_report | to=' + senderName + ' | date=' + attendanceReportCommand.dateKey);
            await replyToUser(msg, contact, senderName, formatAttendanceReport(attendanceReportCommand.dateKey));
            break;
        }

        case 'link':
            logInteraction('OUTGOING', `reply=link | to=${senderName}`);
            await replyToUser(msg, contact, senderName, `berikut link komunitas CFC:\n\n${LINK_KOMUNITAS}`);
            break;

        case 'info': {
            logInteraction('OUTGOING', `reply=info | to=${senderName}`);
            const matchedMembers = findMembersByPhone(senderPhone);

            if (matchedMembers.length === 0) {
                await replyToUser(msg, contact, senderName, `data kamu belum terdaftar di sistem bot. Silakan daftar dulu dengan format:\n\`${REGISTER_TEMPLATE}\`\n\nContoh:\n\`daftar | ${senderName} | Belum Diinput | Sistem Informasi | Anggota | - | Ingin ikut aktif\``);
                break;
            }

            const memberSections = matchedMembers
                .map((member, index) => formatMemberInfo(member, matchedMembers.length > 1 ? index + 1 : null))
                .join('\n\n');

            const duplicateNote = matchedMembers.length > 1
                ? '\n\n*Noted:* nomor ini terhubung ke lebih dari satu profil. Tolong hubungi admin untuk merapikan data duplikat sebelum memakai command `add`.'
                : '';

            await replyToUser(msg, contact, senderName, `${memberSections}\n\n*Noted:* bot ini masih tahap build. Jika ada data yang salah atau kosong, gunakan command seperti:\n- \`add npm 24042231035\`\n- \`add no 628123456789\`\n- \`add prodi Sistem Informasi\`\n- \`add saran Perbanyak kegiatan rutin\`${duplicateNote}`);
            break;
        }

        case 'daftar': {
            if (!registerCommand) {
                logInteraction('OUTGOING', `reply=register_format_info | to=${senderName}`);
                await replyToUser(msg, contact, senderName, `format daftar belum benar. Gunakan:\n\`${REGISTER_TEMPLATE}\``);
                break;
            }

            if (registerCommand.error) {
                logInteraction('OUTGOING', `reply=register_error | to=${senderName}`);
                await replyToUser(msg, contact, senderName, registerCommand.error);
                break;
            }

            const members = loadMembers();
            const matchedIndexes = members
                .map((member, index) => ({ member, index }))
                .filter(({ member }) => normalizePhone(member.phone) === senderPhone);

            if (matchedIndexes.length > 0) {
                logInteraction('OUTGOING', `reply=register_exists | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'nomor kamu sudah terdaftar. Kalau mau koreksi data, gunakan command `add` atau cek dulu dengan `info`.');
                break;
            }

            members.push({
                phone: senderPhone,
                ...registerCommand.value,
            });

            saveMembers(members);
            logInteraction('OUTGOING', `reply=register_success | to=${senderName}`);
            await replyToUser(msg, contact, senderName, 'pendaftaran berhasil disimpan. Sekarang kamu bisa ketik `info` untuk melihat data akunmu.');
            break;
        }

        case 'pemateri':
            logInteraction('OUTGOING', `reply=pemateri | to=${senderName}`);
            await replyToUser(msg, contact, senderName, `berikut susunan pemateri kegiatan rutin:\n\n${formatPemateriSchedule()}`);
            break;

        case 'codeflowchallenge':
            logInteraction('OUTGOING', `reply=codeflowchallenge | to=${senderName}`);
            await replyToUser(msg, contact, senderName, CODEFLOW_CHALLENGE_TEXT);
            break;

        case 'aspek penilaian':
            logInteraction('OUTGOING', `reply=aspek_penilaian | to=${senderName}`);
            await replyToUser(msg, contact, senderName, ASPEK_PENILAIAN_TEXT);
            break;

        case 'jadwalku': {
            const memberProfile = findPrimaryMemberByPhone(senderPhone);
            const lookupName = memberProfile?.name || senderName;
            const schedule = pemateriData.findSpeakerSchedule(lookupName);
            if (!schedule) {
                logInteraction('OUTGOING', `reply=jadwalku_not_found | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'jadwal pemateri kamu belum terdaftar. Nanti tinggal isi data nama kamu di file jadwal pemateri.');
                break;
            }

            logInteraction('OUTGOING', `reply=jadwalku | to=${senderName} | week=${schedule.week} | order=${schedule.order}`);
            await replyToUser(msg, contact, senderName, formatMeetingForUser(schedule, lookupName));
            break;
        }

        case 'add': {
            if (!addCommand) {
                logInteraction('OUTGOING', `reply=add_invalid_format | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'format command belum benar. Contoh:\n`add npm 24042231035`\n`add no 628123456789`\n`add prodi Sistem Informasi`\n`add saran Perbanyak kegiatan rutin`');
                break;
            }

            const editableField = mapEditableField(addCommand.field);
            if (!editableField) {
                logInteraction('OUTGOING', `reply=add_invalid_field | to=${senderName} | field=${addCommand.field}`);
                await replyToUser(msg, contact, senderName, 'field yang bisa diubah: `nama`, `npm`, `prodi`, `role`, `pengurus`, `saran`, `no`.');
                break;
            }

            const members = loadMembers();
            const matchedIndexes = members
                .map((member, index) => ({ member, index }))
                .filter(({ member }) => normalizePhone(member.phone) === senderPhone);

            if (matchedIndexes.length === 0) {
                logInteraction('OUTGOING', `reply=add_not_found | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'data kamu belum ditemukan, jadi belum bisa diubah lewat command `add`.');
                break;
            }

            if (matchedIndexes.length > 1) {
                logInteraction('OUTGOING', `reply=add_duplicate_phone | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'nomor kamu terhubung ke lebih dari satu profil. Demi keamanan, command `add` dinonaktifkan dulu untuk nomor ini sampai data dirapikan admin.');
                break;
            }

            const { index, member } = matchedIndexes[0];
            const validationResult = validateMemberUpdate(editableField, addCommand.value, member);
            if (validationResult.error) {
                logInteraction('OUTGOING', `reply=add_validation_error | to=${senderName} | field=${editableField}`);
                await replyToUser(msg, contact, senderName, validationResult.error);
                break;
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
            break;
        }

        case 'sirpai': {
            if (!fs.existsSync(SIR_PAI_FILE)) {
                logInteraction('OUTGOING', `reply=sirpai_not_found | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'foto sir-pai belum ditemukan. Simpan file ke `assets/sir-pai.jpg` dulu ya.');
                break;
            }

            const sirPaiTargets = isGroup
                ? getSirPaiTargets(msg, client)
                : senderPhone ? [`${senderPhone}@s.whatsapp.net`] : [];

            if (isGroup && sirPaiTargets.length === 0) {
                logInteraction('OUTGOING', `reply=sirpai_no_target | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'tag teman yang mau kena sir-pai. Contoh: `@bot sirpai @teman`');
                break;
            }

            const cooldown = canUseSirPai(from, sirPaiTargets.length ? sirPaiTargets : [senderPhone || from]);
            if (!cooldown.allowed) {
                logInteraction('OUTGOING', `reply=sirpai_cooldown | to=${senderName} | wait=${cooldown.secondsLeft}`);
                await replyToUser(msg, contact, senderName, `sir-pai lagi istirahat. Coba lagi ${cooldown.secondsLeft} detik lagi.`);
                break;
            }

            logInteraction('OUTGOING', `reply=sirpai | to=${senderName} | targets=${sirPaiTargets.join(',') || senderPhone || from}`);
            await sendSirPai(msg, client, sirPaiTargets);
            break;
        }

        case 'logo': {
            const logoPaths = getLogoPaths();

            if (logoPaths.length === 0) {
                logInteraction('OUTGOING', `reply=logo_not_found | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'logo CFC belum tersedia. Simpan file logo ke folder assets dengan ekstensi .jpg, .jpeg, atau .png.');
                break;
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
            break;
        }

        default:
            logInteraction('SKIP', `${chatType} | from=${senderName} | reason=unknown_command`);
            break;
    }
}

module.exports = { handleMessage };








