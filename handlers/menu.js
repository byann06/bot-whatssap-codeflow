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
const { loadDocsState, listFoldersFromDrive, removeFolder, getMediaType, uploadMediaBatch } = driveDocs;

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
const AVAILABLE_COMMANDS = new Set(['menu', 'link', 'logo', 'drive auth', 'sirpai', 'info', 'daftar', 'pemateri', 'jadwalku', 'add', 'hadir', 'daftar hadir', 'codeflowchallenge', 'aspek penilaian', 'upin ipin', 'cek lid', 'min ukm di um apa aja ni?', 'folder list', 'jadwal absen', 'buat jadwal', 'liat jadwal', 'hapus jadwal', 'ubah jadwal', 'jam absen', 'close absen', 'buka absen', 'tutup absen', 'hapus hadir', 'izin', 'daftar izin']);
const INFO_TEMPLATE = `
*Informasi Akun Anggota*
>> Nama :
>> NPM :
>> Prodi :
>> Role : (Anggota/Pengurus)
>> Pengurus : (Pembina/Ketua/Wakil Ketua/Sekretaris/Bendahara/Divisi Medig/Divisi Perlog)
>> Berikan saran :
>> LID : 

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
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '').split(',').map(v => v.trim()).filter(Boolean);
const ADMIN_LID = (process.env.ADMIN_LID || '').split(',').map(v => v.trim()).filter(Boolean);
// Antrian upload media per admin
const uploadQueue = new Map();
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000; // 2 menit
const UPLOAD_WARNING_MS = 105 * 1000; // warning di DETIK ke-1:45
const HADIR_LID = (process.env.HADIR_LID || '').split(',').map(v => v.trim()).filter(Boolean);
const DOKUMENTASI_LID = (process.env.DOKUMENTASI_LID || '').split(',').map(v => v.trim()).filter(Boolean);
const KOMUNIKASI_LID = (process.env.KOMUNIKASI_LID || '').split(',').map(v => v.trim()).filter(Boolean);
const PEMATERI_LID = (process.env.PEMATERI_LID || '').split(',').map(v => v.trim()).filter(Boolean);
const ALLOWED_ROLE_VALUES = ['Anggota', 'Pengurus'];
const ALLOWED_MANAGEMENT_VALUES = ['Pembina', 'Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Divisi Medig', 'Divisi Perlog', '-'];
const ATTENDANCE_SESSIONS_KEY = '__sessions';
const ATTENDANCE_ACTIVE_KEY = '__activeByChat';
const ATTENDANCE_REMINDER_MINUTES = Number(process.env.ABSEN_REMINDER_MINUTES || 30);
const attendanceReminderTimers = new Map();
const BOT_NOTICE_GROUP_ID = process.env.BOT_NOTICE_GROUP_ID;

async function sendBotNotice(client, text) {
    if (!BOT_NOTICE_GROUP_ID || !client?.sock?.sendMessage) return;
    try {
        await client.sock.sendMessage(BOT_NOTICE_GROUP_ID, { text });
    } catch (error) {
        logInteraction('WARN', `bot_notice_failed | group=${BOT_NOTICE_GROUP_ID} | error="${error.message}"`);
    }
}
const conversationStates = new Map();

function getConversationKey(identity, chatId) {
    return normalizeLid(identity?.lid) || normalizePhone(identity?.phone) || chatId || 'unknown';
}

function splitCommaValues(value) {
    return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function normalizeDateInput(value) {
    const text = String(value || '').trim();
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function normalizeTimeInput(value) {
    const match = String(value || '').trim().match(/^([0-2]?\d)[.:]([0-5]\d)$/);
    if (!match) return null;
    const hour = Number(match[1]);
    if (hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function parseTimeRange(value) {
    const parts = String(value || '').split('-').map((part) => normalizeTimeInput(part));
    return { startTime: parts[0] || null, endTime: parts[1] || null };
}

function isSkipValue(value) {
    return /^(belum|nanti|skip|lewati|-|tidak)$/i.test(String(value || '').trim());
}

function parseRegisterText(rawBody) {
    const text = String(rawBody || '').trim();
    let payload = '';
    if (/^daftar\s*\|/i.test(text)) {
        return parseRegisterCommand(text);
    }
    if (/^daftar\s*:/i.test(text)) {
        payload = text.replace(/^daftar\s*:/i, '').trim();
    } else if (/^daftar\s*,/i.test(text)) {
        payload = text.replace(/^daftar\s*,/i, '').trim();
    } else if (/^daftar\s+/i.test(text)) {
        payload = text.replace(/^daftar\s+/i, '').trim();
    } else {
        return null;
    }

    const data = {};
    const aliases = {
        nama: 'name', name: 'name', npm: 'npm', prodi: 'studyProgram', jurusan: 'studyProgram', role: 'role', pengurus: 'managementRole', jabatan: 'managementRole', saran: 'suggestion'
    };
    splitCommaValues(payload).forEach((segment) => {
        const match = segment.match(/^([a-zA-Z]+)\s*[:=]?\s+(.+)$/);
        if (!match) return;
        const key = aliases[match[1].toLowerCase()];
        if (key) data[key] = match[2].trim();
    });

    if (!Object.keys(data).length) return null;
    return buildRegisterCommand(data);
}

function buildRegisterCommand(data) {
    const name = String(data.name || '').trim();
    const npm = String(data.npm || '').trim();
    const studyProgram = String(data.studyProgram || '').trim();
    const role = normalizeRole(data.role || 'Anggota');
    const managementRole = normalizeManagementRole(data.managementRole || '-');
    const suggestion = String(data.suggestion || '-').trim() || '-';

    if (!name || !studyProgram) return { error: 'Nama dan prodi wajib diisi saat daftar.' };
    if (!role) return { error: `Role hanya boleh *${ALLOWED_ROLE_VALUES.join('*, *')}*.` };
    if (role === 'Pengurus') return { error: 'Pendaftaran sebagai *Pengurus* tidak bisa dilakukan lewat bot. Silakan hubungi admin untuk pendataan pengurus.' };
    if (!managementRole) return { error: `Jabatan pengurus hanya boleh *${ALLOWED_MANAGEMENT_VALUES.join('*, *')}*.` };
    if (managementRole !== '-') return { error: 'Maaf Daftar Data Hanya diKHUSUSkan untuk anggota. Isi pengurus dengan `-`.' };

    return {
        value: {
            name,
            npm: /^belum\s+diinput$/i.test(npm) ? '' : npm,
            studyProgram,
            role,
            managementRole,
            suggestion,
        },
    };
}

function getScheduleList() {
    const attendance = loadAttendance();
    const { sessions } = getAttendanceMeta(attendance);
    return Object.values(sessions).sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
}

function findScheduleByQuery(query, chatId) {
    const schedules = getScheduleList();
    const scope = getChatScope(chatId);
    const raw = String(query || '').trim();
    const numberMatch = raw.match(/^(?:jadwal\s*)?(\d+)$/i);
    if (numberMatch) return schedules[Number(numberMatch[1]) - 1] || null;
    const dateKey = normalizeDateInput(raw);
    const normalized = normalizeNameKey(raw);
    return schedules.find((session) =>
        session.id === raw ||
        session.dateKey === dateKey ||
        normalizeNameKey(session.title) === normalized ||
        normalizeNameKey(session.title).includes(normalized) ||
        (session.chatId === scope && normalized === 'aktif')
    ) || null;
}

function saveAttendanceSession(session) {
    const attendance = loadAttendance();
    const existing = findSessionById(attendance, session.id);
    if (!existing) return null;
    Object.assign(existing, session);
    saveAttendance(attendance);
    return existing;
}

function formatScheduleList() {
    const schedules = getScheduleList();
    if (!schedules.length) return 'belum ada jadwal absen.';
    const lines = schedules.map((session, index) => {
        const closeLabel = session.endTime ? `-${session.endTime.replace(':', '.')}` : '';
        return `${index + 1}. ${getSessionTitle(session)} | ${formatDateKey(session.dateKey)} | ${(session.startTime || '-').replace(':', '.')}${closeLabel} | ${session.status}`;
    });
    return `*Jadwal Absen*\n${lines.join('\n')}`;
}

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

function normalizeLid(value) {
    const jid = String(value || '').trim();
    return jid.endsWith('@lid') ? jid : '';
}

function normalizeNameKey(value) {
    return String(value || '').trim().toLowerCase();
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

function parseWibDateTime(dateKey, timeLabel) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    const [hour, minute] = String(timeLabel || '').split(':').map(Number);
    if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
        return null;
    }

    return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
}

function formatDateTimeLabel(dateKey, timeLabel) {
    return `${formatDateKey(dateKey)} pukul ${String(timeLabel || '').replace(':', '.')} WIB`;
}

function slugifyId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'sesi';
}

function getChatScope(chatId) {
    return chatId && chatId.endsWith('@g.us') ? chatId : 'global';
}

function getAttendanceMeta(attendance) {
    if (!attendance[ATTENDANCE_SESSIONS_KEY] || typeof attendance[ATTENDANCE_SESSIONS_KEY] !== 'object') {
        attendance[ATTENDANCE_SESSIONS_KEY] = {};
    }

    if (!attendance[ATTENDANCE_ACTIVE_KEY] || typeof attendance[ATTENDANCE_ACTIVE_KEY] !== 'object') {
        attendance[ATTENDANCE_ACTIVE_KEY] = {};
    }

    return {
        sessions: attendance[ATTENDANCE_SESSIONS_KEY],
        activeByChat: attendance[ATTENDANCE_ACTIVE_KEY],
    };
}

function getSessionRecords(session) {
    if (!Array.isArray(session.records)) session.records = [];
    return session.records;
}

function getSessionExcuses(session) {
    if (!Array.isArray(session.excuses)) session.excuses = [];
    return session.excuses;
}

function getSessionTitle(session) {
    return session?.title || `Pertemuan ${session?.dateKey || ''}`.trim();
}

function findSessionById(attendance, sessionId) {
    const { sessions } = getAttendanceMeta(attendance);
    return sessions[sessionId] || null;
}

function findOpenSessionForChat(attendance, chatId) {
    const { sessions, activeByChat } = getAttendanceMeta(attendance);
    const scope = getChatScope(chatId);
    const activeId = activeByChat[scope] || activeByChat.global;
    const activeSession = activeId ? sessions[activeId] : null;
    if (activeSession?.status === 'open') return activeSession;

    return Object.values(sessions)
        .filter((session) => session.status === 'open' && (session.chatId === scope || session.chatId === 'global'))
        .sort((a, b) => String(b.openedAt || '').localeCompare(String(a.openedAt || '')))[0] || null;
}

function findRelevantSessionForExcuse(attendance, chatId) {
    const open = findOpenSessionForChat(attendance, chatId);
    if (open) return open;

    const { sessions } = getAttendanceMeta(attendance);
    const scope = getChatScope(chatId);
    const now = new Date();
    return Object.values(sessions)
        .filter((session) => ['scheduled', 'open'].includes(session.status))
        .filter((session) => session.chatId === scope || session.chatId === 'global' || scope === 'global')
        .map((session) => ({ session, startsAt: parseWibDateTime(session.dateKey, session.startTime) }))
        .filter((item) => !item.startsAt || item.startsAt.getTime() >= now.getTime() - 24 * 60 * 60 * 1000)
        .sort((a, b) => (a.startsAt?.getTime() || 0) - (b.startsAt?.getTime() || 0))[0]?.session || null;
}

function createAttendanceSession(chatId, dateKey, startTime, title, createdBy, endTime = null) {
    const attendance = loadAttendance();
    const { sessions } = getAttendanceMeta(attendance);
    const safeTitle = String(title || `Pertemuan ${formatDateKey(dateKey)}`).trim();
    const idBase = `${dateKey}-${startTime}-${slugifyId(safeTitle)}`;
    let id = idBase;
    let counter = 2;
    while (sessions[id]) {
        id = `${idBase}-${counter}`;
        counter += 1;
    }

    sessions[id] = {
        id,
        chatId: getChatScope(chatId),
        title: safeTitle,
        dateKey,
        startTime,
        ...(endTime && { endTime }),
        status: 'scheduled',
        createdBy: createdBy || '-',
        createdAt: new Date().toISOString(),
        reminderSent: false,
        records: [],
        excuses: [],
    };

    saveAttendance(attendance);
    return sessions[id];
}

function openAttendanceSession(chatId, title) {
    const attendance = loadAttendance();
    const { sessions, activeByChat } = getAttendanceMeta(attendance);
    const scope = getChatScope(chatId);
    let session = Object.values(sessions)
        .filter((item) => ['scheduled', 'open'].includes(item.status))
        .filter((item) => item.chatId === scope || item.chatId === 'global')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];

    if (!session) {
        const dateKey = getWibDateKey();
        const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
        session = createAttendanceSession(chatId, dateKey, nowTime, title || `Absensi ${formatDateKey(dateKey)}`, 'admin');
    }

    session.status = 'open';
    session.openedAt = new Date().toISOString();
    if (title) session.title = title;
    activeByChat[scope] = session.id;
    saveAttendance(attendance);
    return session;
}

function closeAttendanceSession(chatId) {
    const attendance = loadAttendance();
    const session = findOpenSessionForChat(attendance, chatId);
    if (!session) return null;
    const { activeByChat } = getAttendanceMeta(attendance);
    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    for (const [scope, sessionId] of Object.entries(activeByChat)) {
        if (sessionId === session.id) delete activeByChat[scope];
    }
    saveAttendance(attendance);
    return session;
}

function recordAttendanceInSession(sessionId, member, identity = {}) {
    const attendance = loadAttendance();
    const session = findSessionById(attendance, sessionId);
    if (!session) return { status: 'missing' };
    const records = getSessionRecords(session);
    const attendanceIdentity = getAttendanceIdentity(identity) || getAttendanceIdentity(member);
    const existing = records.find((record) => getAttendanceIdentity(record) === attendanceIdentity);
    if (existing) return { status: 'exists', session, record: existing };

    const now = new Date();
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: normalizeLid(identity.lid || member.lid),
        name: member.name || '-',
        npm: member.npm || '',
        role: member.role || '-',
        status: 'hadir',
        time: getWibTimeLabel(now),
        timestamp: now.toISOString(),
    };
    records.push(record);
    saveAttendance(attendance);
    return { status: 'saved', session, record };
}

function recordExcuseInSession(sessionId, member, identity = {}, reason = '', proof = null) {
    const attendance = loadAttendance();
    const session = findSessionById(attendance, sessionId);
    if (!session) return { status: 'missing' };
    const excuses = getSessionExcuses(session);
    const excuseIdentity = getAttendanceIdentity(identity) || getAttendanceIdentity(member);
    const existing = excuses.find((record) => getAttendanceIdentity(record) === excuseIdentity);
    const now = new Date();
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: normalizeLid(identity.lid || member.lid),
        name: member.name || '-',
        npm: member.npm || '',
        role: member.role || '-',
        status: 'izin',
        reason: String(reason || '').trim() || '-',
        proof: proof || null,
        time: getWibTimeLabel(now),
        timestamp: now.toISOString(),
    };

    if (existing) {
        Object.assign(existing, record);
    } else {
        excuses.push(record);
    }

    saveAttendance(attendance);
    return { status: existing ? 'updated' : 'saved', session, record };
}

function removeAttendanceFromSession(chatId, query) {
    const attendance = loadAttendance();
    const session = findOpenSessionForChat(attendance, chatId) || findRelevantSessionForExcuse(attendance, chatId);
    if (!session) return { status: 'no_session' };
    const normalizedQuery = normalizeNameKey(query);
    const records = getSessionRecords(session);
    const index = records.findIndex((record) =>
        normalizeNameKey(record.name) === normalizedQuery ||
        normalizeNameKey(record.npm) === normalizedQuery ||
        normalizeNameKey(record.lid) === normalizedQuery
    );
    if (index < 0) return { status: 'not_found', session };
    const [removed] = records.splice(index, 1);
    saveAttendance(attendance);
    return { status: 'removed', session, removed };
}

function formatAttendanceSessionReport(session) {
    const records = getSessionRecords(session);
    const excuses = getSessionExcuses(session);
    const presentNames = new Set(records.map((record) => normalizeNameKey(record.name)).filter(Boolean));
    const excuseNames = new Set(excuses.map((record) => normalizeNameKey(record.name)).filter(Boolean));
    const alpaMembers = loadMembers().filter((member) => {
        const nameKey = normalizeNameKey(member.name);
        return nameKey && !presentNames.has(nameKey) && !excuseNames.has(nameKey);
    });

    const hadirLines = records.length
        ? records.map((record, index) => `${index + 1}. ${record.name || '-'} - ${record.time || '-'} WIB`).join('\n')
        : 'Belum ada yang hadir.';
    const izinLines = excuses.length
        ? excuses.map((record, index) => `${index + 1}. ${record.name || '-'} - ${record.reason || '-'}${record.proof ? ' (Memberikan Bukti Foto)' : ''}`).join('\n')
        : 'Belum ada izin.';
    const alpaLines = alpaMembers.length
        ? alpaMembers.map((member, index) => `${index + 1}. ${member.name || '-'}`).join('\n')
        : 'Tidak ada.';

    return `*Daftar Hadir - ${getSessionTitle(session)}*\n${formatDateTimeLabel(session.dateKey, session.startTime)}\nStatus: ${session.status}\n\n*Hadir (${records.length})*\n${hadirLines}\n\n*Izin (${excuses.length})*\n${izinLines}\n\n*Alpa (${alpaMembers.length})*\n${alpaLines}`;
}

function parseAttendanceCommand(rawBody) {
    const text = String(rawBody || '').trim();

    if (/^buat\s+jadwal$/i.test(text)) return { primary: 'buat jadwal', type: 'schedule_prompt' };

    const easySchedule = text.match(/^buat\s+jadwal\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.+)$/i);
    if (easySchedule) {
        const dateKey = normalizeDateInput(easySchedule[1]);
        const range = parseTimeRange(easySchedule[2]);
        return { primary: 'buat jadwal', type: 'schedule', dateKey, startTime: range.startTime, endTime: range.endTime, title: easySchedule[3].trim() };
    }

    const scheduleMatch = text.match(/^jadwal\s+absen\s*\|\s*([^|]+)\s*\|\s*([^|]+)(?:\s*\|\s*(.+))?$/i);
    if (scheduleMatch) {
        const dateKey = normalizeDateInput(scheduleMatch[1]);
        const range = parseTimeRange(scheduleMatch[2]);
        return { primary: 'jadwal absen', type: 'schedule', dateKey, startTime: range.startTime, endTime: range.endTime, title: (scheduleMatch[3] || '').trim() };
    }

    if (/^(liat|lihat)\s+jadwal$/i.test(text)) return { primary: 'liat jadwal', type: 'schedule_list' };

    const deleteSchedule = text.match(/^hapus\s+jadwal\s*,\s*(.+)$/i);
    if (deleteSchedule) return { primary: 'hapus jadwal', type: 'schedule_delete', query: deleteSchedule[1].trim() };

    const changeSchedule = text.match(/^ubah\s+jadwal\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.+)$/i);
    if (changeSchedule) return { primary: 'ubah jadwal', type: 'schedule_update', query: changeSchedule[1].trim(), field: changeSchedule[2].trim().toLowerCase(), value: changeSchedule[3].trim() };

    const startUpdate = text.match(/^jam\s+absen\s*,?\s*(.+)$/i);
    if (startUpdate) return { primary: 'jam absen', type: 'schedule_set_start', value: startUpdate[1].trim() };

    const closeUpdate = text.match(/^close\s+absen\s*,?\s*(.+)$/i);
    if (closeUpdate) return { primary: 'close absen', type: 'schedule_set_end', value: closeUpdate[1].trim() };

    const openMatch = text.match(/^buka\s+absen(?:\s*[,|]\s*(.+))?$/i);
    if (openMatch) return { primary: 'buka absen', type: 'open', title: (openMatch[1] || '').trim() };

    if (/^tutup\s+absen$/i.test(text)) return { primary: 'tutup absen', type: 'close' };

    const removeMatch = text.match(/^hapus\s+hadir\s+(.+)$/i);
    if (removeMatch) return { primary: 'hapus hadir', type: 'remove', query: removeMatch[1].trim() };

    const excuseMatch = text.match(/^izin(?:\s*[|,]\s*(.+))?$/i);
    if (excuseMatch) return { primary: 'izin', type: 'excuse', reason: (excuseMatch[1] || '').trim() };

    const excuseListMatch = text.match(/^daftar\s+izin(?:\s+(.+))?$/i);
    if (excuseListMatch) return { primary: 'daftar izin', type: 'excuse_report', dateKey: normalizeDateInput(excuseListMatch[1]) || getWibDateKey() };

    return null;
} function scheduleAttendanceReminder(client, session, targetChatId) {
    if (!client?.sock || !session?.id || attendanceReminderTimers.has(session.id)) {
        return;
    }

    const startsAt = parseWibDateTime(session.dateKey, session.startTime);
    if (!startsAt) {
        return;
    }

    const remindAt = startsAt.getTime() - ATTENDANCE_REMINDER_MINUTES * 60 * 1000;
    const delay = remindAt - Date.now();
    if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) {
        return;
    }

    const timer = setTimeout(async () => {
        attendanceReminderTimers.delete(session.id);
        try {
            const mentions = HADIR_LID.length ? HADIR_LID : ADMIN_LID;
            const mentionText = mentions.map((lid) => `@${lid.split('@')[0]}`).join(' ');
            await client.sock.sendMessage(targetChatId || session.chatId, {
                text: `${mentionText ? mentionText + ' ' : ''}pengingat: sesi absen *${getSessionTitle(session)}* dijadwalkan mulai ${formatDateTimeLabel(session.dateKey, session.startTime)}. Ketik *buka absen* saat kegiatan dimulai.`,
                mentions,
            });
        } catch (error) {
            logInteraction('WARN', `attendance_reminder_failed | session=${session.id} | error=${error.message}`);
        }
    }, delay);

    attendanceReminderTimers.set(session.id, timer);
}
function parseAttendanceReportCommand(rawBody) {
    const match = String(rawBody || '').trim().match(/^daftar\s+hadir(?:\s+(\d{4}-\d{2}-\d{2}))?$/i);
    if (!match) {
        return null;
    }

    return {
        dateKey: match[1] || getWibDateKey(),
        hasExplicitDate: Boolean(match[1]),
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
    if (/^folder\s+list$/i.test(text)) {
        return { type: 'list_folders' };
    }

    const removeFolderMatch = text.match(/^remove\s+folder\s+"([^"]+)"$/i);
    if (removeFolderMatch) {
        return { type: 'remove_folder', name: removeFolderMatch[1].trim() };
    }

    return null;
}

function isAdminUser(senderPhone, msg) {
    if (ADMIN_PHONE.includes(normalizePhone(senderPhone))) {
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

function hasLidRole(senderIdentity, ...lidLists) {
    if (ADMIN_LID.includes(senderIdentity.lid)) return true;
    return lidLists.some(list => list.includes(senderIdentity.lid));
}

function getUploadQueue(lid) {
    return uploadQueue.get(lid) || null;
}

function clearUploadQueue(lid) {
    const queue = uploadQueue.get(lid);
    if (queue) {
        if (queue.timeoutId) clearTimeout(queue.timeoutId);
        if (queue.warningId) clearTimeout(queue.warningId);
        uploadQueue.delete(lid);
    }
}

function setUploadQueue(lid, data) {
    uploadQueue.set(lid, data);
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

function getAttendanceIdentity(value) {
    const lid = normalizeLid(value?.lid);
    if (lid) {
        return lid;
    }

    return normalizePhone(value?.phone || value);
}

function recordAttendance(member, identity = {}) {
    const attendance = loadAttendance();
    const dateKey = getWibDateKey();
    const todayRecords = Array.isArray(attendance[dateKey]) ? attendance[dateKey] : [];
    const attendanceIdentity = getAttendanceIdentity(identity) || getAttendanceIdentity(member);
    const existingRecord = todayRecords.find((record) => getAttendanceIdentity(record) === attendanceIdentity);

    if (existingRecord) {
        return { status: 'exists', dateKey, record: existingRecord };
    }

    const now = new Date();
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: normalizeLid(identity.lid || member.lid),
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
    const assetsDir = path.join(__dirname, '..', 'assets','logo');
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

function findMembersByIdentity(identity, options = {}) {
    const matchedEntries = findMemberEntriesByIdentity(identity, options);
    if (matchedEntries.length === 1) {
        rememberSenderIdentity(matchedEntries[0].index, identity);
    }

    return matchedEntries.map(({ member }) => member);
}

function rememberSenderIdentity(index, identity) {
    if (!Number.isInteger(index) || index < 0) {
        return;
    }

    const members = loadMembers();
    const member = members[index];
    if (!member) {
        return;
    }

    let changed = false;
    const phone = normalizePhone(identity?.phone);
    const lid = normalizeLid(identity?.lid);

    if (phone && normalizePhone(member.phone) !== phone) {
        member.phone = phone;
        changed = true;
    }

    if (lid && normalizeLid(member.lid) !== lid) {
        member.lid = lid;
        changed = true;
    }

    if (changed) {
        saveMembers(members);
    }
}

function findPrimaryMemberByIdentity(identity, options = {}) {
    const matchedEntries = findMemberEntriesByIdentity(identity, options);
    if (matchedEntries.length !== 1) {
        return null;
    }

    rememberSenderIdentity(matchedEntries[0].index, identity);
    return matchedEntries[0].member;
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
        if (removeMatch && !/^folder\s+/i.test(removeMatch[1])) {
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

function getMemberChatId(member) {
    const lid = normalizeLid(member?.lid);
    if (lid) {
        return lid;
    }

    const phone = normalizePhone(member?.phone);
    return phone ? `${phone}@s.whatsapp.net` : '';
}

function getMentionLabel(chatId) {
    return `@${String(chatId || '').split('@')[0]}`;
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

function buildPemateriReminderText(recipientName, week) {
    return [
        `Halo ${recipientName},`,
        `ini pengingat bahwa kamu terjadwal sebagai pemateri Pertemuan ${week} di Code Flow Community.`,
        'Mohon pelajari materi yg sudah dikirim dan pantau grup untuk informasi lanjutan dari admin.',
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

function createScheduleFromData(data, chatId, senderName) {
    if (!data.dateKey) return { error: 'tanggal jadwal belum ada.' };
    if (!data.title) return { error: 'nama jadwal belum ada.' };
    const startTime = data.startTime || '00:00';
    const startsAt = parseWibDateTime(data.dateKey, startTime);
    if (!startsAt) return { error: 'format tanggal/jam belum benar.' };
    const session = createAttendanceSession(chatId, data.dateKey, startTime, data.title, senderName, data.endTime || null);
    return { session };
}

async function handleConversationReply(msg, contact, senderName, senderIdentity, senderPhone, from, rawBody, client) {
    const key = getConversationKey(senderIdentity, from);
    const state = conversationStates.get(key);
    if (!state) return false;

    const text = String(rawBody || '').trim();
    if (/^(batal|cancel)$/i.test(text)) {
        conversationStates.delete(key);
        await replyToUser(msg, contact, senderName, 'baik, proses dibatalkan.');
        return true;
    }

    if (state.type === 'schedule') {
        if (!hasLidRole(senderIdentity, HADIR_LID)) {
            conversationStates.delete(key);
            await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
            return true;
        }

        if (state.step === 'date') {
            const dateKey = normalizeDateInput(text);
            if (!dateKey) {
                await replyToUser(msg, contact, senderName, 'format tanggal belum benar. Contoh: `21-05-2026`.');
                return true;
            }
            state.data.dateKey = dateKey;
            state.step = 'time';
            await replyToUser(msg, contact, senderName, 'oke. \napakah jam akses absen anggota \ndan\n jam close absen anggota mau. diisi sekarang? \nContoh: \n`jam absen 13.00` \n`jam close 17.00`\n\n atau kamu belum tau ? cukup ketik `belum`/`nanti`.');
            return true;
        }

        if (state.step === 'time') {
            if (isSkipValue(text)) {
                state.step = 'title';
                await replyToUser(msg, contact, senderName, 'baik, mohon berikan nama jadwal. Contoh: `pertemuan 3`.');
                return true;
            }
            const startMatch = text.match(/^jam\s+absen\s*,?\s*(.+)$/i);
            const range = parseTimeRange(startMatch ? startMatch[1] : text);
            if (!range.startTime) {
                await replyToUser(msg, contact, senderName, 'format jam belum benar. Contoh: `jam absen 13.00` atau `13.00-17.00`.');
                return true;
            }
            state.data.startTime = range.startTime;
            if (range.endTime) state.data.endTime = range.endTime;
            state.step = 'closeTime';
            await replyToUser(msg, contact, senderName, 'jam absen tersimpan. Mau isi jam close absen? Contoh `close absen,17.00` atau ketik `belum`.');
            return true;
        }

        if (state.step === 'closeTime') {
            if (!isSkipValue(text)) {
                const closeMatch = text.match(/^close\s+absen\s*,?\s*(.+)$/i);
                const closeTime = normalizeTimeInput(closeMatch ? closeMatch[1] : text);
                if (!closeTime) {
                    await replyToUser(msg, contact, senderName, 'format jam close belum benar. Contoh: `close absen,17.00` atau ketik `belum`.');
                    return true;
                }
                state.data.endTime = closeTime;
            }
            state.step = 'title';
            await replyToUser(msg, contact, senderName, 'baik, mohon berikan nama jadwal. Contoh: `pertemuan 3`.');
            return true;
        }

        if (state.step === 'title') {
            if (!text || isSkipValue(text)) {
                await replyToUser(msg, contact, senderName, 'nama jadwal wajib diisi. Contoh: `pertemuan 3`.');
                return true;
            }
            state.data.title = text;
            const result = createScheduleFromData(state.data, from, senderName);
            conversationStates.delete(key);
            if (result.error) {
                await replyToUser(msg, contact, senderName, result.error);
                return true;
            }
            scheduleAttendanceReminder(client, result.session, from);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(result.session)}* terbuat. Silakan lihat jadwal dengan *liat jadwal*.`);
            return true;
        }
    }

    if (state.type === 'register') {
        if (state.step === 'askMode') {
            if (/^(lanjut|satu|satu satu|ya|y)$/i.test(text)) {
                state.step = 'name';
                await replyToUser(msg, contact, senderName, 'baik, tulis nama lengkap kamu.');
                return true;
            }
            const parsed = parseRegisterText(`daftar ${text}`);
            if (parsed) {
                const result = completeRegistration(parsed, senderIdentity, senderPhone);
                conversationStates.delete(key);
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
            conversationStates.delete(key);
            await replyToUser(msg, contact, senderName, result.error || 'pendaftaran berhasil disimpan. Sekarang kamu bisa ketik `info` untuk melihat data akunmu.');
            return true;
        }
    }

    return false;
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
    const senderIdentity = buildSenderIdentity(contact, msg, senderName);
    const senderPhone = senderIdentity.phone;
    const addCommand = parseAddCommand(rawBody);
    const registerCommand = parseRegisterText(rawBody);
    const adminCommands = parseAdminCommands(rawBody);
    const attendanceReportCommand = parseAttendanceReportCommand(rawBody);
    const attendanceCommand = parseAttendanceCommand(rawBody);
    const documentationCommand = parseDocumentationCommand(rawBody);
    const documentationUploadCommand = isDocumentationUploadCommand(rawBody);
    const primaryCommand = addCommand ? 'add' : registerCommand ? 'daftar' : attendanceReportCommand ? 'daftar hadir' : attendanceCommand ? attendanceCommand.primary : documentationCommand ? 'documentation' : body;

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

    if (await handleConversationReply(msg, contact, senderName, senderIdentity, senderPhone, from, rawBody, client)) {
        return;
    }

    // Handle media masuk dari admin dokumentasi (chat pribadi)
    if (!isGroup && msg.mediaInfo && typeof msg.downloadMedia === 'function') {
        if (hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
            const mediaType = getMediaType(msg.mediaInfo.mimetype, msg.mediaInfo.fileName);
            if (mediaType) {
                const lid = senderIdentity.lid;
                if (!getUploadQueue(lid)) {
                    uploadQueue.set(lid, { items: [], warningId: null, timeoutId: null, debounceId: null, sock: null });
                }
                const existing = getUploadQueue(lid);
                const downloaded = await msg.downloadMedia().catch(() => null);
                if (downloaded?.buffer) {
                    existing.items.push({
                        buffer: downloaded.buffer,
                        mimetype: downloaded.mimetype,
                        fileName: downloaded.fileName || msg.mediaInfo.fileName,
                        type: mediaType,
                    });
                    await client.sock.sendMessage(from, { text: `⏳ File diterima (${existing.items.length}). Menunggu file berikutnya...` });
                    // Reset timer setiap ada file baru masuk
                    if (existing.warningId) clearTimeout(existing.warningId);
                    if (existing.timeoutId) clearTimeout(existing.timeoutId);

                    // Warning menit ke-4
                    existing.warningId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        if (!q) return;
                        const foto = q.items.filter(i => i.type === 'foto').length;
                        const video = q.items.filter(i => i.type === 'video').length;
                        await client.sock.sendMessage(from, {
                            text: `⚠️ Sesi upload hampir habis (1 menit lagi)!\nTertampung: ${foto} foto, ${video} video.\nSegera balas: *ya*, *upload foto*, atau *upload video*`
                        });
                    }, UPLOAD_WARNING_MS);

                    // Timeout 5 menit → hapus antrian
                    existing.timeoutId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        if (!q) return;
                        clearUploadQueue(lid);
                        await client.sock.sendMessage(from, {
                            text: `❌ Sesi upload habis. File yang tertampung telah dihapus dari memory. Silakan kirim ulang.`
                        });
                    }, UPLOAD_TIMEOUT_MS);


                    // Balas konfirmasi setelah jeda singkat (debounce 2 detik)
                    if (existing.debounceId) clearTimeout(existing.debounceId);
                    existing.debounceId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        console.log(`[debounce] fired | queue:`, q ? `${q.items.length} items` : 'null');
                        if (!q) return;
                        const foto = q.items.filter(i => i.type === 'foto').length;
                        const video = q.items.filter(i => i.type === 'video').length;
                        await client.sock.sendMessage(from, {
                            text: `📥 Saya menerima *${foto} foto* dan *${video} video* — total *${foto + video} item*.\n\nBalas dengan:\n- *ya* → upload semua\n- *upload foto* → upload foto saja\n- *upload video* → upload video saja\n- *reset* → batalkan semua file\n\nSesi akan habis dalam *1 menit*.`
                        });
                    }, 5000);

                }
                return;
            }
        }
    }



    const shouldLogCommand = primaryCommand === 'documentation' || AVAILABLE_COMMANDS.has(primaryCommand) || Boolean(adminCommands) || documentationUploadCommand || Boolean(attendanceCommand);
    logInteraction('INCOMING', `${chatType} | chat=${from} | phone=${senderIdentity.phone || '-'} | lid=${senderIdentity.lid || '-'} | messageLength=${String(msg.body || '').length}${shouldLogCommand ? ` | command=${primaryCommand || '-'}` : ''}`);

    if (hasLidRole(senderIdentity, KOMUNIKASI_LID, PEMATERI_LID) && adminCommands) {
        const quotedMessage = msg.hasQuotedMsg ? await msg.getQuotedMessage().catch(() => null) : null;
        const explicitWeeks = adminCommands
            .map((action) => action.week)
            .filter((week) => Number.isInteger(week) && week > 0);
        const inheritedWeek = explicitWeeks.length > 0 ? explicitWeeks[0] : null;
        const scheduleCache = new Map();

        for (const action of adminCommands) {
            // remove, move, add_schedule = hanya PEMATERI_LID atau ADMIN_LID
            if (['remove', 'move', 'add_schedule'].includes(action.type) && !hasLidRole(senderIdentity, PEMATERI_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin pemateri.');
                return;
            }

            // mention, forward, remind = hanya KOMUNIKASI_LID atau ADMIN_LID
            if (['mention', 'forward', 'remind'].includes(action.type) && !hasLidRole(senderIdentity, KOMUNIKASI_LID)) {
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

        return;
    }

    if (adminCommands) {
        logInteraction('OUTGOING', `reply=admin_only_command_blocked | to=${senderName}`);
        await replyToUser(msg, contact, senderName, 'command ini khusus admin tidak bisa digunakan.');
        return;
    }

    if (documentationUploadCommand) {
        if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
            logInteraction('SKIP', `DOCUMENTATION_UPLOAD | from=${senderName} | reason=not_dokumentasi`);
            return;
        }

        // Ambil media dari quoted message (pesan yang di-reply)
        const quotedMsg = msg.hasQuotedMsg ? await msg.getQuotedMessage().catch(() => null) : null;
        const mediaSource = (quotedMsg?.mediaInfo && typeof quotedMsg.downloadMedia === 'function')
            ? quotedMsg
            : (msg.mediaInfo && typeof msg.downloadMedia === 'function')
                ? msg
                : null;

        if (!mediaSource) {
            await replyToUser(msg, contact, senderName, 'tidak ada file yang terdeteksi. Reply ke file/foto/video lalu ketik upload dokumentasi.');
            return;
        }

        try {
            const media = await mediaSource.downloadMedia();
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
        const isKnownCommand = AVAILABLE_COMMANDS.has(primaryCommand) || primaryCommand === 'documentation' || documentationUploadCommand || Boolean(adminCommands) || Boolean(attendanceCommand);
        if (!isMentioned && !isKnownCommand) {
            logInteraction('SKIP', `GROUP | from=${senderName} | reason=not_mentioned_and_unknown_command`);
            return;
        }
    }

    switch (primaryCommand) {
        case 'documentation': {
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
                logInteraction('OUTGOING', `reply=documentation_admin_only | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'fitur dokumentasi khusus admin dokumentasi.');
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
                    const folder = await driveDocs.setActiveFolder(from, documentationCommand.name);
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

            if (documentationCommand.type === 'list_folders') {
                const folders = await listFoldersFromDrive();

                if (folders.length === 0) {
                    await replyToUser(msg, contact, senderName, 'belum ada folder di Google Drive.');
                    break;
                }

                const lines = folders.map((folder, index) =>
                    `${index + 1}. *${folder.name}*\n` +
                    `${folder.photos} foto · ${folder.videos} video · ${folder.total} item\n` +
                    `${folder.webViewLink}`
                );

                logInteraction('OUTGOING', `reply=list_folders | to=${senderName} | count=${folders.length}`);
                await replyToUser(msg, contact, senderName, `*Daftar Folder Dokumentasi:*\n\n${lines.join('\n\n')}`);
                break;
            }
            if (documentationCommand.type === 'remove_folder') {
                const removed = await removeFolder(documentationCommand.name);
                logInteraction('OUTGOING', `reply=remove_folder | to=${senderName} | folder=${removed.name}`);
                await replyToUser(msg, contact, senderName, `folder *${removed.name}* berhasil dihapus dari Google Drive.`);
                break;
            }
            break;
        }

        case 'buat jadwal':
        case 'jadwal absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            if (attendanceCommand.type === 'schedule_prompt') {
                conversationStates.set(getConversationKey(senderIdentity, from), { type: 'schedule', step: 'date', data: {} });
                await replyToUser(msg, contact, senderName, 'untuk tanggal berapa? Contoh: `21-05-2026`.');
                break;
            }

            const result = createScheduleFromData(attendanceCommand, from, senderName);
            if (result.error) {
                await replyToUser(msg, contact, senderName, 'format jadwal belum benar. Contoh lengkap: `buat jadwal,21-05-2026,13.00-17.00,pertemuan ketiga`.');
                break;
            }

            scheduleAttendanceReminder(client, result.session, from);
            const closeText = result.session.endTime ? ` sampai ${result.session.endTime.replace(':', '.')} WIB` : '';
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(result.session)}* terbuat untuk ${formatDateKey(result.session.dateKey)} pukul ${result.session.startTime.replace(':', '.')} WIB${closeText}. Lihat semua jadwal dengan *liat jadwal*.`);
            break;
        }

        case 'liat jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            await replyToUser(msg, contact, senderName, formatScheduleList());
            break;
        }

        case 'hapus jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const attendance = loadAttendance();
            const { sessions, activeByChat } = getAttendanceMeta(attendance);
            const session = findScheduleByQuery(attendanceCommand.query, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'jadwal tidak ditemukan. Pakai nomor dari `liat jadwal`, tanggal, atau nama jadwal.');
                break;
            }
            delete sessions[session.id];
            for (const [scope, sessionId] of Object.entries(activeByChat)) {
                if (sessionId === session.id) delete activeByChat[scope];
            }
            saveAttendance(attendance);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(session)}* sudah dihapus.`);
            break;
        }

        case 'ubah jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const session = findScheduleByQuery(attendanceCommand.query, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'jadwal tidak ditemukan. Contoh: `ubah jadwal,1,nama,pertemuan 4`.');
                break;
            }
            const field = attendanceCommand.field;
            const value = attendanceCommand.value;
            if (['tanggal', 'date'].includes(field)) {
                const dateKey = normalizeDateInput(value);
                if (!dateKey) {
                    await replyToUser(msg, contact, senderName, 'format tanggal belum benar. Contoh: `ubah jadwal,1,tanggal,21-05-2026`.');
                    break;
                }
                session.dateKey = dateKey;
            } else if (['jam', 'jam absen', 'absen', 'mulai'].includes(field)) {
                const startTime = normalizeTimeInput(value);
                if (!startTime) {
                    await replyToUser(msg, contact, senderName, 'format jam belum benar. Contoh: `ubah jadwal,1,jam,13.00`.');
                    break;
                }
                session.startTime = startTime;
            } else if (['close', 'close absen', 'tutup'].includes(field)) {
                if (isSkipValue(value)) delete session.endTime;
                else {
                    const endTime = normalizeTimeInput(value);
                    if (!endTime) {
                        await replyToUser(msg, contact, senderName, 'format close absen belum benar. Contoh: `ubah jadwal,1,close,17.00`.');
                        break;
                    }
                    session.endTime = endTime;
                }
            } else if (['nama', 'judul', 'pertemuan'].includes(field)) {
                session.title = value;
            } else {
                await replyToUser(msg, contact, senderName, 'field yang bisa diubah: `tanggal`, `jam`, `close`, `nama`.');
                break;
            }
            saveAttendanceSession(session);
            await replyToUser(msg, contact, senderName, `jadwal diperbarui:\n${formatScheduleList()}`);
            break;
        }

        case 'jam absen':
        case 'close absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const attendance = loadAttendance();
            const session = findOpenSessionForChat(attendance, from) || findRelevantSessionForExcuse(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'belum ada jadwal yang bisa diubah. Buat dulu dengan `buat jadwal`.');
                break;
            }
            const timeValue = normalizeTimeInput(attendanceCommand.value);
            if (!timeValue) {
                await replyToUser(msg, contact, senderName, `format jam belum benar. Contoh: \`${primaryCommand},17.00\`.`);
                break;
            }
            if (primaryCommand === 'jam absen') session.startTime = timeValue;
            else session.endTime = timeValue;
            saveAttendanceSession(session);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(session)}* diperbarui.\n${formatScheduleList()}`);
            break;
        }
        case 'buka absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const session = openAttendanceSession(from, attendanceCommand.title);
            const closeText = session.endTime ? ` sebelum pukul ${session.endTime.replace(':', '.')} WIB` : ' sebelum absen ditutup';
            await sendBotNotice(client, `*Absen Dibuka*\n\nAbsen untuk jadwal *${getSessionTitle(session)}* telah dibuka. Silakan ketik *hadir* di grup${closeText}.`);
            await replyToUser(msg, contact, senderName, `sesi absen *${getSessionTitle(session)}* sudah dibuka. Anggota hanya bisa absen dari grup dengan command *hadir*.`);
            break;
        }

        case 'tutup absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const session = closeAttendanceSession(from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'tidak ada sesi absen yang sedang dibuka.');
                break;
            }

            await sendBotNotice(client, `*Absen Ditutup*\n\nAbsen untuk jadwal *${getSessionTitle(session)}* telah ditutup. Terima kasih.`);
            await replyToUser(msg, contact, senderName, `sesi absen *${getSessionTitle(session)}* ditutup.\n\n${formatAttendanceSessionReport(session)}`);
            break;
        }

        case 'hapus hadir': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const result = removeAttendanceFromSession(from, attendanceCommand.query);
            if (result.status === 'no_session') {
                await replyToUser(msg, contact, senderName, 'belum ada sesi absen aktif/terjadwal untuk dikoreksi.');
                break;
            }
            if (result.status === 'not_found') {
                await replyToUser(msg, contact, senderName, `nama/npm/lid *${attendanceCommand.query}* tidak ditemukan di daftar hadir sesi *${getSessionTitle(result.session)}*.`);
                break;
            }

            await replyToUser(msg, contact, senderName, `*${result.removed.name}* dihapus dari daftar hadir sesi *${getSessionTitle(result.session)}*.`);
            break;
        }

        case 'izin': {
            const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });
            if (matchedMembers.length === 0) {
                await replyToUser(msg, contact, senderName, 'data kamu belum terdaftar, jadi izin belum bisa dicatat. Hubungi pengurus/admin hadir.');
                break;
            }
            if (matchedMembers.length > 1) {
                await replyToUser(msg, contact, senderName, 'data kamu terdeteksi lebih dari satu profil. Hubungi admin agar data dirapikan dulu.');
                break;
            }

            const attendance = loadAttendance();
            const session = findRelevantSessionForExcuse(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'belum ada jadwal/sesi absen yang bisa menerima izin. Tunggu admin hadir menjadwalkan pertemuan dulu.');
                break;
            }

            const proof = msg.mediaInfo ? {
                hasMedia: true,
                type: msg.mediaInfo.type,
                fileName: msg.mediaInfo.fileName,
                mimetype: msg.mediaInfo.mimetype,
            } : null;
            const result = recordExcuseInSession(session.id, matchedMembers[0], senderIdentity, attendanceCommand.reason, proof);
            await replyToUser(msg, contact, senderName, `izin kamu untuk *${getSessionTitle(result.session)}* sudah ${result.status === 'updated' ? 'diperbarui' : 'dicatat'}. Alasan: ${result.record.reason}${proof ? '\nBukti media terdeteksi.' : ''}`);
            break;
        }

        case 'daftar izin': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'rekap izin hanya bisa dilihat oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const { sessions } = getAttendanceMeta(attendance);
            const matchedSessions = Object.values(sessions).filter((session) => session.dateKey === attendanceCommand.dateKey);
            if (matchedSessions.length === 0) {
                await replyToUser(msg, contact, senderName, `belum ada sesi izin pada ${formatDateKey(attendanceCommand.dateKey)}.`);
                break;
            }

            const lines = matchedSessions.map((session) => {
                const excuses = getSessionExcuses(session);
                const detail = excuses.length
                    ? excuses.map((record, index) => `${index + 1}. ${record.name || '-'} - ${record.reason || '-'}${record.proof ? ' (ada bukti)' : ''}`).join('\n')
                    : 'Belum ada izin.';
                return `*${getSessionTitle(session)}*\n${detail}`;
            });
            await replyToUser(msg, contact, senderName, `*Daftar Izin - ${formatDateKey(attendanceCommand.dateKey)}*\n\n${lines.join('\n\n')}`);
            break;
        }
        case 'menu':
            logInteraction('OUTGOING', `reply=menu | to=${senderName}`);
            await replyToUser(msg, contact, senderName, MENU_TEXT);
            break;

        case 'hadir': {
            if (!isGroup) {
                await replyToUser(msg, contact, senderName, 'absen hadir hanya bisa dilakukan di grup saat sesi absen dibuka oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const session = findOpenSessionForChat(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'sesi absen belum dibuka. Tunggu admin hadir membuka sesi dengan command *buka absen*.');
                break;
            }

            const nowMs = Date.now();
            const opensAt = parseWibDateTime(session.dateKey, session.startTime);
            const closesAt = session.endTime ? parseWibDateTime(session.dateKey, session.endTime) : null;
            if (opensAt && nowMs < opensAt.getTime()) {
                await replyToUser(msg, contact, senderName, `akses absen untuk *${getSessionTitle(session)}* belum dimulai. Mulai pukul ${session.startTime.replace(':', '.')} WIB.`);
                break;
            }
            if (closesAt && nowMs > closesAt.getTime()) {
                closeAttendanceSession(from);
                await replyToUser(msg, contact, senderName, `akses absen untuk *${getSessionTitle(session)}* sudah ditutup pukul ${session.endTime.replace(':', '.')} WIB.`);
                break;
            }

            const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });
            if (matchedMembers.length === 0) {
                logInteraction('OUTGOING', 'reply=attendance_not_registered | to=' + senderName + ' | lid=' + (senderIdentity.lid || '-') + ' | names=' + (senderIdentity.names.join('|') || '-'));
                await replyToUser(msg, contact, senderName, 'data kamu belum terdaftar, jadi kehadiran belum bisa dicatat. Hubungi pengurus/admin hadir.');
                break;
            }

            if (matchedMembers.length > 1) {
                await replyToUser(msg, contact, senderName, 'data kamu terdeteksi lebih dari satu profil. Hubungi admin agar data dirapikan dulu.');
                break;
            }

            const attendanceResult = recordAttendanceInSession(session.id, matchedMembers[0], senderIdentity);
            if (attendanceResult.status === 'exists') {
                await replyToUser(msg, contact, senderName, 'kehadiran kamu sudah tercatat pada ' + (attendanceResult.record.time || '-') + ' WIB untuk sesi *' + getSessionTitle(session) + '*.');
                break;
            }

            await replyToUser(msg, contact, senderName, 'kehadiran berhasil dicatat untuk sesi *' + getSessionTitle(session) + '* pukul ' + attendanceResult.record.time + ' WIB.');
            break;
        }

        case 'daftar hadir': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                logInteraction('OUTGOING', 'reply=attendance_report_admin_only | to=' + senderName);
                await replyToUser(msg, contact, senderName, 'rekap daftar hadir hanya bisa dilihat oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const { sessions } = getAttendanceMeta(attendance);

            if (!attendanceReportCommand.hasExplicitDate) {
                const activeSession = findOpenSessionForChat(attendance, from);
                if (activeSession) {
                    await replyToUser(msg, contact, senderName, formatAttendanceSessionReport(activeSession));
                    break;
                }
            }

            const matchedSessions = Object.values(sessions).filter((session) => session.dateKey === attendanceReportCommand.dateKey);
            if (matchedSessions.length > 0) {
                await replyToUser(msg, contact, senderName, matchedSessions.map(formatAttendanceSessionReport).join('\n\n'));
                break;
            }

            logInteraction('OUTGOING', 'reply=attendance_report_legacy | to=' + senderName + ' | date=' + attendanceReportCommand.dateKey);
            await replyToUser(msg, contact, senderName, formatAttendanceReport(attendanceReportCommand.dateKey));
            break;
        }

        case 'link':
            logInteraction('OUTGOING', `reply=link | to=${senderName}`);
            await replyToUser(msg, contact, senderName, `berikut link komunitas CFC:\n\n${LINK_KOMUNITAS}`);
            break;

        case 'info': {
            logInteraction('OUTGOING', `reply=info | to=${senderName}`);
            const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });

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

            await replyToUser(msg, contact, senderName, `${memberSections}`);
            break;
        }

        case 'daftar': {
            if (!registerCommand) {
                conversationStates.set(getConversationKey(senderIdentity, from), { type: 'register', step: 'askMode', data: {} });
                logInteraction('OUTGOING', `reply=register_prompt | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'kamu bisa daftar sekali ketik dengan format:\n\n```\ndaftar\nnama [namaKamu],\nnpm [npmKamu],\nprodi [prodiKamu],\nsaran [saranKamu]\n```\n\nAtau lanjut satu-satu, ketik:\n`lanjut`\n\nnanti saya arahkan😊.');
                break;
            }

            const result = completeRegistration(registerCommand, senderIdentity, senderPhone);
            if (result.error) {
                logInteraction('OUTGOING', `reply=register_error | to=${senderName}`);
                await replyToUser(msg, contact, senderName, result.error);
                break;
            }

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
            pemateriData.refreshScheduleReference();
            const memberProfile = findPrimaryMemberByIdentity(senderIdentity, { allowNameFallback: true });
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
            const matchedIndexes = findMemberEntriesByIdentity(senderIdentity, { allowNameFallback: true });

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
        case 'upin ipin': {
            const ipinNumber = '6283166111757@s.whatsapp.net';

            await client.sock.sendMessage(msg.key.remoteJid, {
                text: `Halo saye upin dan ini adik saye ipin! 🌙\n@${ipinNumber.split('@')[0]}`,
                mentions: [ipinNumber]
            });
            break;
        }
        case 'cek lid': {
            if (!isAdminUser(senderPhone, msg)) {
                logInteraction('SKIP', `${chatType} | from=${senderName} | reason=cek_lid_admin_only`);
                break;
            }

            const mentionedIds = msg.mentionedIds || [];
            if (mentionedIds.length === 0) {
                await replyToUser(msg, contact, senderName, 'tag anggota yang mau dicek LID-nya. Contoh: `cek lid @anggota`');
                break;
            }

            const lidLines = mentionedIds.map((jid) => {
                const normalized = String(jid || '').trim();
                const isLid = normalized.endsWith('@lid');
                const label = `@${normalized.split('@')[0]}`;
                return isLid
                    ? `${label} → \`${normalized}\``
                    : `${label} → _(LID tidak tersedia, hanya phone)_`;
            });

            logInteraction('OUTGOING', `reply=cek_lid | to=${senderName} | count=${mentionedIds.length}`);

            const sentMsg = await replyToUser(msg, contact, senderName, `*Hasil Cek LID:*\n\n${lidLines.join('\n')}`);

            // Hapus pesan bot setelah 10 detik
            // setTimeout(async () => {
            //     try {
            //         await client.sock.sendMessage(msg.from, {
            //             delete: sentMsg.key,
            //         });

            //         await client.sock.sendMessage(msg.from, {
            //             delete: msg.key,
            //         });

            //         logInteraction('OUTGOING', `delete=cek_lid | to=${senderName}`);
            //     } catch (err) {
            //         logInteraction('WARN', `delete=cek_lid_failed | reason=${err.message}`);
            //     }
            // }, 15 * 1000);

            break;
        }
        case 'min ukm di um apa aja ni?': {
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
            break;
        }
        case 'reset': {
            if (isGroup) break;
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) break;

            const lid = senderIdentity.lid;
            const queue = getUploadQueue(lid);

            if (!queue || queue.items.length === 0) {
                await client.sock.sendMessage(from, { text: '⚠️ Tidak ada sesi upload yang aktif.' });
                break;
            }

            const foto = queue.items.filter(i => i.type === 'foto').length;
            const video = queue.items.filter(i => i.type === 'video').length;
            clearUploadQueue(lid);
            await client.sock.sendMessage(from, { text: `🗑️ Sesi dibatalkan. ${foto} foto dan ${video} video telah dihapus dari memory.` });
            break;
        }



        case 'ya':
        case 'upload foto':
        case 'upload video': {
            if (isGroup) break;
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) break;

            const lid = senderIdentity.lid;
            const queue = getUploadQueue(lid);

            if (!queue || queue.items.length === 0) {
                await client.sock.sendMessage(from, { text: 'Tidak ada file yang tertampung. Silakan kirim file terlebih dahulu.' });
                break;
            }

            let toUpload = queue.items;
            if (body === 'upload foto') toUpload = queue.items.filter(i => i.type === 'foto');
            if (body === 'upload video') toUpload = queue.items.filter(i => i.type === 'video');

            if (toUpload.length === 0) {
                await client.sock.sendMessage(from, { text: `Tidak ada ${body === 'upload foto' ? 'foto' : 'video'} yang tertampung.` });
                break;
            }

            clearUploadQueue(lid);
            await client.sock.sendMessage(from, { text: `⏳ Mengupload ${toUpload.length} file ke Google Drive...` });

            try {
                const { folder, results } = await uploadMediaBatch(from, toUpload);
                const lines = [];
                if (results.foto.length) lines.push(`✅ ${results.foto.length} foto berhasil diupload`);
                if (results.video.length) lines.push(`✅ ${results.video.length} video berhasil diupload`);
                if (results.gagal.length) lines.push(`❌ ${results.gagal.length} file gagal: ${results.gagal.join(', ')}`);

                await client.sock.sendMessage(from, {
                    text: `*Upload selesai ke folder ${folder.name}*\n\n${lines.join('\n')}`
                });
                logInteraction('OUTGOING', `reply=upload_batch_done | to=${senderName} | foto=${results.foto.length} | video=${results.video.length} | gagal=${results.gagal.length}`);
            } catch (error) {
                await client.sock.sendMessage(from, { text: `❌ Gagal upload: ${getDriveErrorMessage(error)}` });
                logInteraction('OUTGOING', `reply=upload_batch_error | to=${senderName} | error=${error.message}`);
            }

            break;
        }

        default:
            logInteraction('SKIP', `${chatType} | from=${senderName} | reason=unknown_command`);
            break;
    }
}

module.exports = { handleMessage };















