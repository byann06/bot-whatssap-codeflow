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
    return year && month && day ? `${day}/${month}/${year}` : dateKey;
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

module.exports = {
    getWibDateKey,
    getWibTimeLabel,
    formatDateKey,
    parseWibDateTime,
    formatDateTimeLabel,
    normalizeDateInput,
    normalizeTimeInput,
    parseTimeRange,
    isSkipValue,
};
