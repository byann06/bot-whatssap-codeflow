const config = require('../config');
const { REGISTER_TEMPLATE } = require('../constants/menuTexts');

const ALLOWED_ROLE_VALUES = config.allowedRoles;
const ALLOWED_MANAGEMENT_VALUES = config.allowedManagementRoles;

function splitCommaValues(value) {
    return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
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

module.exports = {
    parseRegisterText,
    buildRegisterCommand,
    parseRegisterCommand,
    parseAddCommand,
};