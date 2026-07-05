const config = require('../config');
const { loadAttendance, saveAttendance } = require('../repositories/attendance');
const { loadMembers } = require('../repositories/members');
const {
    formatDateKey,
    parseWibDateTime,
    formatDateTimeLabel,
} = require('../lib/dateTime');

const ATTENDANCE_SESSIONS_KEY = config.attendanceKeys.sessions;
const ATTENDANCE_ACTIVE_KEY = config.attendanceKeys.activeByChat;

function normalizeNameKey(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

function getAttendanceIdentity(value) {
    const lid = String(value?.lid || '').trim();
    if (lid) return `lid:${lid}`;

    const phone = normalizePhone(value?.phone);
    if (phone) return `phone:${phone}`;

    const npm = String(value?.npm || '').trim();
    if (npm) return `npm:${npm}`;

    const name = normalizeNameKey(value?.name);
    return name ? `name:${name}` : '';
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

    if (activeByChat[scope] && !sessions[activeByChat[scope]]) {
        delete activeByChat[scope];
    }

    let session = Object.values(sessions)
        .filter((item) => ['scheduled', 'open'].includes(item.status))
        .filter((item) => item.chatId === scope || item.chatId === 'global')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];

    if (!session) {
        const { getWibDateKey } = require('../lib/dateTime');
        const dateKey = getWibDateKey();
        const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
        const safeTitle = String(title || `Absensi ${formatDateKey(dateKey)}`).trim();
        const idBase = `${dateKey}-${nowTime}-${slugifyId(safeTitle)}`;
        let id = idBase;
        let counter = 2;
        while (sessions[id]) {
            id = `${idBase}-${counter}`;
            counter += 1;
        }

        session = {
            id,
            chatId: scope,
            title: safeTitle,
            dateKey,
            startTime: nowTime,
            status: 'scheduled',
            createdBy: 'admin',
            createdAt: new Date().toISOString(),
            reminderSent: false,
            records: [],
            excuses: [],
        };
        sessions[id] = session;
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

function closeAttendanceSessionById(sessionId) {
    const attendance = loadAttendance();
    const session = findSessionById(attendance, sessionId);
    if (!session || session.status !== 'open') return null;

    const { activeByChat } = getAttendanceMeta(attendance);
    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    for (const [scope, activeSessionId] of Object.entries(activeByChat)) {
        if (activeSessionId === session.id) delete activeByChat[scope];
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
    const { getWibTimeLabel } = require('../lib/dateTime');
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: identity.lid || member.lid || '',
        name: member.name,
        npm: member.npm,
        role: member.role,
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
    const { getWibTimeLabel } = require('../lib/dateTime');
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: identity.lid || member.lid || '',
        name: member.name,
        npm: member.npm,
        role: member.role,
        status: 'izin',
        reason: String(reason || '').trim() || '-',
        proof,
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

function matchesAttendanceRecordQuery(record, query) {
    const normalizedQuery = normalizeNameKey(query).replace(/\s+/g, ' ');
    if (!normalizedQuery) return false;

    const fields = [record.name, record.npm, record.lid]
        .map((value) => normalizeNameKey(value).replace(/\s+/g, ' '))
        .filter(Boolean);

    return fields.some((field) =>
        field === normalizedQuery ||
        field.includes(normalizedQuery) ||
        normalizedQuery.includes(field)
    );
}

function removeAttendanceFromSession(chatId, query) {
    const attendance = loadAttendance();
    const session = findOpenSessionForChat(attendance, chatId) || findRelevantSessionForExcuse(attendance, chatId);
    if (!session) return { status: 'no_session' };

    const records = getSessionRecords(session);
    const recordIndex = records.findIndex((record) => matchesAttendanceRecordQuery(record, query));
    if (recordIndex >= 0) {
        const [removed] = records.splice(recordIndex, 1);
        saveAttendance(attendance);
        return { status: 'removed', type: 'hadir', session, removed };
    }

    const excuses = getSessionExcuses(session);
    const excuseIndex = excuses.findIndex((record) => matchesAttendanceRecordQuery(record, query));
    if (excuseIndex >= 0) {
        const [removed] = excuses.splice(excuseIndex, 1);
        saveAttendance(attendance);
        return { status: 'removed', type: 'izin', session, removed };
    }

    return { status: 'not_found', session };
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
        ? excuses.map((record, index) => `${index + 1}. ${record.name || '-'} - ${record.reason || '-'}${record.proof ? ' (ada bukti)' : ''}`).join('\n')
        : 'Belum ada izin.';
    const alpaLines = alpaMembers.length
        ? alpaMembers.map((member, index) => `${index + 1}. ${member.name || '-'}`).join('\n')
        : 'Tidak ada.';

    return `*Daftar Hadir - ${getSessionTitle(session)}*\n${formatDateTimeLabel(session.dateKey, session.startTime)}\nStatus: ${session.status}\n\n*Hadir (${records.length})*\n${hadirLines}\n\n*Izin (${excuses.length})*\n${izinLines}\n\n*Alpa (${alpaMembers.length})*\n${alpaLines}`;
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
    const { normalizeDateInput } = require('../lib/dateTime');
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

module.exports = {
    getAttendanceIdentity,
    getChatScope,
    getAttendanceMeta,
    getSessionRecords,
    getSessionExcuses,
    getSessionTitle,
    findSessionById,
    findOpenSessionForChat,
    findRelevantSessionForExcuse,
    createAttendanceSession,
    openAttendanceSession,
    closeAttendanceSession,
    closeAttendanceSessionById,
    recordAttendanceInSession,
    recordExcuseInSession,
    removeAttendanceFromSession,
    formatAttendanceSessionReport,
    getScheduleList,
    findScheduleByQuery,
    saveAttendanceSession,
    formatScheduleList,
};
