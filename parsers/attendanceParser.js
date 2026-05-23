const {
    getWibDateKey,
    normalizeDateInput,
    parseTimeRange,
} = require('../lib/dateTime');

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
}

function parseAttendanceReportCommand(rawBody) {
    const match = String(rawBody || '').trim().match(/^daftar\s+hadir(?:\s+(.+))?$/i);
    if (!match) return null;

    return {
        dateKey: normalizeDateInput(match[1]) || getWibDateKey(),
        hasExplicitDate: Boolean(match[1]),
    };
}

module.exports = {
    parseAttendanceCommand,
    parseAttendanceReportCommand,
};
