const config = require('../config');
const {
    getMainCashData,
    getMemberCashData,
    summarizeMemberCashByWeek,
    getUnpaidMembers,
    getMemberCashStatus,
    getInventoryLoanData,
} = require('../services/googleSheetsService');

const MAX_UNPAID_RESULTS = 15;
const MAX_TRANSACTION_RESULTS = 3;
const MAX_INVENTORY_RESULTS = 10;
const MAX_ACTIVE_INFOCUS_RESULTS = 5;
const MAX_INVENTORY_HISTORY_RESULTS = 5;
const MAX_WEEK_UNPAID_RESULTS = 20;

function parseAdminSheetsCommand(text) {
    const normalized = String(text || '').trim();
    if (/^\.kas\s+utama$/i.test(normalized)) {
        return { type: 'main_cash' };
    }

    if (/^\.kas\s+belum\s+bayar$/i.test(normalized)) {
        return { type: 'unpaid_cash' };
    }

    if (/^\.kas\s+rekap$/i.test(normalized)) {
        return { type: 'member_cash_recap' };
    }

    const weekRecapMatch = normalized.match(/^\.kas\s+rekap\s+minggu\s+(\d+)$/i);
    if (weekRecapMatch) {
        return { type: 'member_cash_week_recap', weekNumber: Number(weekRecapMatch[1]) };
    }

    const statusMatch = normalized.match(/^\.kas\s+status(?:\s+(.+))?$/i);
    if (statusMatch) {
        return { type: 'member_cash_status', name: (statusMatch[1] || '').trim() };
    }

    if (/^\.infokus\s+aktif$/i.test(normalized)) {
        return { type: 'infokus_active' };
    }

    if (/^\.infokus\s+riwayat$/i.test(normalized)) {
        return { type: 'infokus_history' };
    }

    if (/^\.infokus$/i.test(normalized)) {
        return { type: 'infokus' };
    }

    return null;
}

async function handleAdminSheetsCommand(sock, message, text) {
    const command = parseAdminSheetsCommand(text);
    if (!command) return false;

    const chatId = message.key.remoteJid || '';
    const senderId = message.key.participant || chatId;
    const isGroup = chatId.endsWith('@g.us');
    const isOwner = isOwnerId(senderId);

    if (isGroup) {
        const isAdmin = isOwner || await isGroupAdmin(sock, chatId, senderId);
        if (!isAdmin) {
            await reply(sock, message, 'Command administrasi CFC hanya bisa digunakan admin grup atau owner.');
            return true;
        }
    } else if (!isOwner) {
        await reply(sock, message, 'Command administrasi CFC hanya bisa digunakan owner.');
        return true;
    }

    try {
        if (command.type === 'main_cash') {
            const data = await getMainCashData();
            await reply(sock, message, formatMainCashForWhatsApp(data));
            return true;
        }

        if (command.type === 'unpaid_cash') {
            const unpaidMembers = await getUnpaidMembers();
            await reply(sock, message, formatUnpaidMembersForWhatsApp(unpaidMembers));
            return true;
        }

        if (command.type === 'member_cash_recap') {
            const memberCash = await getMemberCashData();
            const recap = summarizeMemberCashByWeek(memberCash.rows);
            await reply(sock, message, formatMemberCashRecapForWhatsApp(recap));
            return true;
        }

        if (command.type === 'member_cash_week_recap') {
            const memberCash = await getMemberCashData();
            const weekRows = filterMemberCashRowsByWeek(memberCash.rows, command.weekNumber);
            await reply(sock, message, formatMemberCashWeekRecapForWhatsApp(command.weekNumber, weekRows));
            return true;
        }

        if (command.type === 'member_cash_status') {
            if (!command.name) {
                await reply(sock, message, 'Cara pakai: `.kas status <nama>`\nContoh: `.kas status Abyan`');
                return true;
            }

            const member = await getMemberCashStatus(command.name);
            await reply(sock, message, formatMemberCashStatusForWhatsApp(command.name, member));
            return true;
        }

        if (command.type === 'infokus' || command.type === 'infokus_active' || command.type === 'infokus_history') {
            const data = await getInventoryLoanData();
            const output = command.type === 'infokus_active'
                ? formatInfokusActiveForWhatsApp(data)
                : command.type === 'infokus_history'
                    ? formatInfokusHistoryForWhatsApp(data)
                    : formatInfokusForWhatsApp(data);
            await reply(sock, message, output);
            return true;
        }
    } catch (error) {
        console.error('[SHEETS] admin command failed:', error.message);
        await reply(sock, message, getSheetsErrorMessage(error));
        return true;
    }

    return false;
}

function formatMainCashForWhatsApp(data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const summary = data?.summary || {};
    const latestTransactions = rows.slice(-MAX_TRANSACTION_RESULTS).reverse();
    const lines = [
        '💰 Kas Utama CFC',
        '',
        `Saldo: ${formatRupiah(summary.balance)}`,
        `Total Masuk: ${formatRupiah(summary.totalIncome)}`,
        `Total Keluar: ${formatRupiah(summary.totalExpense)}`,
        `Jumlah Transaksi: ${summary.rowCount || rows.length}`,
    ];

    if (!latestTransactions.length) {
        lines.push('', 'Belum ada transaksi yang terbaca dari Google Sheets.');
        return lines.join('\n');
    }

    lines.push('', 'Transaksi Terakhir:');
    latestTransactions.forEach((row, index) => {
        const amount = getTransactionAmount(row);
        const description = row.keterangan || row.kategori || '';
        const label = [row.tanggal, description].filter(Boolean).join(' - ') || '-';
        lines.push(`${index + 1}. ${label} (${amount})`);
    });

    return lines.join('\n');
}

function formatUnpaidMembersForWhatsApp(members) {
    const rows = Array.isArray(members) ? members : [];
    if (!rows.length) {
        return '✅ Kas Anggota\n\nTidak ada anggota yang terdeteksi belum lunas.';
    }

    const visibleRows = rows.slice(0, MAX_UNPAID_RESULTS);
    const lines = [
        '⚠️ Kas Belum Bayar',
        '',
        `Total belum lunas: ${rows.length}`,
        '',
        ...visibleRows.map((member, index) => `${index + 1}. ${member.nama || '-'}${formatUnpaidDetail(member)}`),
    ];

    if (rows.length > visibleRows.length) {
        lines.push('', `+${rows.length - visibleRows.length} anggota lain tidak ditampilkan biar chat nggak jadi novel.`);
    }

    return lines.join('\n');
}

function formatMemberCashRecapForWhatsApp(recap) {
    const weeks = Array.isArray(recap?.weeks) ? recap.weeks : [];
    if (!weeks.length) {
        return '📊 Rekap Kas Anggota\n\nBelum ada data kas anggota yang terbaca dari Google Sheets.';
    }

    const lines = ['📊 Rekap Kas Anggota'];
    for (const week of weeks) {
        lines.push(
            '',
            week.label || 'Tanpa Minggu',
            `Anggota: ${week.totalMembers || 0}`,
            `Lunas: ${week.paidMembers || 0}`,
            `Belum Lunas: ${week.unpaidMembers || 0}`,
            `Terkumpul: ${formatRupiah(week.totalCollected)}`,
            `Hutang: ${formatRupiah(week.totalDebt)}`,
        );
    }

    const total = recap.total || {};
    lines.push(
        '',
        'Total:',
        `Anggota: ${total.totalMembers || 0}`,
        `Lunas: ${total.paidMembers || 0}`,
        `Belum Lunas: ${total.unpaidMembers || 0}`,
        `Terkumpul: ${formatRupiah(total.totalCollected)}`,
        `Hutang: ${formatRupiah(total.totalDebt)}`,
    );

    return lines.join('\n');
}

function formatMemberCashWeekRecapForWhatsApp(weekNumber, rows) {
    const members = Array.isArray(rows) ? rows : [];
    if (!members.length) {
        return `Data kas minggu ${weekNumber} tidak ditemukan.`;
    }

    const recap = summarizeMemberCashByWeek(members);
    const total = recap.total || {};
    const unpaidMembers = members.filter((member) => member.isUnpaid);
    const visibleUnpaidMembers = unpaidMembers.slice(0, MAX_WEEK_UNPAID_RESULTS);
    const lines = [
        `📊 Rekap Kas Anggota - Minggu ${weekNumber}`,
        '',
        `Anggota: ${total.totalMembers || 0}`,
        `Lunas: ${total.paidMembers || 0}`,
        `Belum Lunas: ${total.unpaidMembers || 0}`,
        `Terkumpul: ${formatRupiah(total.totalCollected)}`,
        `Hutang: ${formatRupiah(total.totalDebt)}`,
    ];

    if (!unpaidMembers.length) {
        lines.push('', 'Belum Lunas:', 'Tidak ada. Mantap, bendahara bisa napas dulu.');
        return lines.join('\n');
    }

    lines.push('', 'Belum Lunas:');
    visibleUnpaidMembers.forEach((member, index) => {
        lines.push(`${index + 1}. ${member.nama || '-'} - ${formatRupiah(getMemberDebtAmount(member))}`);
    });

    if (unpaidMembers.length > visibleUnpaidMembers.length) {
        lines.push('', `+${unpaidMembers.length - visibleUnpaidMembers.length} anggota lain tidak ditampilkan.`);
    }

    return lines.join('\n');
}

function formatMemberCashStatusForWhatsApp(query, member) {
    if (!member) {
        return `🔎 Kas Status: ${query}\n\nAnggota tidak ditemukan di data kas.`;
    }

    const statusLabel = member.isUnpaid ? 'Belum lunas' : 'Lunas/aman';
    const lines = [
        `🔎 Kas Status: ${member.nama || query}`,
        '',
        `Status: ${member.status || statusLabel}`,
    ];

    if (member.npm) lines.push(`NPM: ${member.npm}`);
    if (typeof member.dueAmount === 'number') lines.push(`Tagihan: ${formatRupiah(member.dueAmount)}`);
    if (typeof member.paidAmount === 'number') lines.push(`Terbayar: ${formatRupiah(member.paidAmount)}`);
    if (typeof member.outstandingAmount === 'number') lines.push(`Tunggakan: ${formatRupiah(member.outstandingAmount)}`);
    if (member.unpaidReason) lines.push(`Catatan: ${member.unpaidReason}`);

    const unpaidPeriods = Array.isArray(member.payments)
        ? member.payments.filter((payment) => payment.unpaid).map((payment) => payment.period)
        : [];
    if (unpaidPeriods.length) lines.push(`Periode belum bayar: ${unpaidPeriods.join(', ')}`);

    return lines.join('\n');
}

function formatInfokusForWhatsApp(data) {
    const activeRows = getActiveInfokusLoans(data);
    if (!activeRows.length) {
        return '📽️ Status Infokus\n\nInfokus sedang tidak dipinjam.';
    }

    return formatInfokusActiveForWhatsApp(data, '📽️ Status Infokus');
}

function formatInfokusActiveForWhatsApp(data, title = '📽️ Infokus Aktif') {
    const activeRows = getActiveInfokusLoans(data);
    if (!activeRows.length) {
        return `${title}\n\nInfokus sedang tidak dipinjam.`;
    }

    const visibleRows = activeRows.slice(0, MAX_ACTIVE_INFOCUS_RESULTS);
    const lines = [
        title,
        '',
        `Peminjaman aktif: ${activeRows.length}`,
        '',
    ];

    visibleRows.forEach((item, index) => {
        if (index > 0) lines.push('');
        lines.push(formatActiveInfokusLine(item, index + 1));
    });

    if (activeRows.length > visibleRows.length) {
        lines.push('', `+${activeRows.length - visibleRows.length} peminjaman aktif lain tidak ditampilkan.`);
    }

    return lines.join('\n');
}

function formatInfokusHistoryForWhatsApp(data) {
    const rows = getTargetInventoryRows(data).filter(isDisplayableInventoryRow);
    if (!rows.length) {
        return '📽️ Riwayat Infokus\n\nBelum ada riwayat peminjaman/pengembalian yang terbaca dari Google Sheets.';
    }

    const visibleRows = sortInventoryRowsByDate(rows).slice(-MAX_INVENTORY_HISTORY_RESULTS).reverse();
    const lines = ['📽️ Riwayat Infokus', ''];

    visibleRows.forEach((item, index) => {
        if (index > 0) lines.push('');
        lines.push(formatInventoryHistoryLine(item, index + 1));
    });

    return lines.join('\n');
}

function formatActiveInfokusLine(item, number) {
    const lines = [
        `${number}. ${item.peminjam || '-'}`,
        `Tanggal pinjam: ${item.tanggalPinjam || item.tanggal || '-'}`,
        `Kegiatan: ${item.kegiatan || '-'}`,
        `Status: ${getInventoryStatusLabel(item) || 'Peminjaman'}`,
    ];

    if (item.catatan) lines.push(`Catatan: ${item.catatan}`);
    return lines.join('\n');
}

function formatInventoryHistoryLine(item, number) {
    const lines = [
        `${number}. ${getInventoryStatusLabel(item) || 'Riwayat'} - ${item.peminjam || '-'}`,
        `Tanggal: ${getInventoryDateLabel(item)}`,
    ];

    if (item.kegiatan) lines.push(`Kegiatan: ${item.kegiatan}`);
    if (item.catatan) lines.push(`Catatan: ${item.catatan}`);
    return lines.join('\n');
}

function formatInventoryLine(item, number) {
    return formatInventoryHistoryLine(item, number);
}

function getActiveInfokusLoans(data) {
    const latestByItem = new Map();
    getTargetInventoryRows(data)
        .filter(isDisplayableInventoryRow)
        .forEach((item, index) => {
            const key = getInventoryMatchKey(item);
            if (!key) return;

            const current = latestByItem.get(key);
            const candidate = {
                item,
                index,
                timestamp: getInventoryTimestamp(item),
            };

            if (
                !current
                || candidate.timestamp > current.timestamp
                || (candidate.timestamp === current.timestamp && candidate.index > current.index)
            ) {
                latestByItem.set(key, candidate);
            }
        });

    return Array.from(latestByItem.values())
        .map((entry) => entry.item)
        .filter(isInventoryBorrowRow);
}

function getTargetInventoryRows(data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const infokusRows = rows.filter(isInfokusItem);
    return infokusRows.length ? infokusRows : rows;
}

function isInventoryBorrowRow(item) {
    if (!isDisplayableInventoryRow(item) || isInventoryReturnRow(item)) return false;

    const text = normalizeInventoryStatusText(item);
    return text.includes('peminjaman')
        || text.includes('dipinjam')
        || text.includes('pinjam')
        || Boolean(item.tanggalPinjam)
        || Boolean(item.peminjam);
}

function isInventoryReturnRow(item) {
    const text = normalizeInventoryStatusText(item);
    return text.includes('pengembalian')
        || text.includes('dikembalikan')
        || text.includes('returned')
        || text.includes('tersedia')
        || text.includes('kembali')
        || Boolean(item.tanggalKembali);
}

function isDisplayableInventoryRow(item) {
    return Boolean(item?.peminjam || item?.barang || item?.kegiatan || item?.status || item?.tanggalPinjam || item?.tanggalKembali || item?.catatan);
}

function getInventoryMatchKey(item) {
    const itemKey = normalizeText(item?.barang || '');
    if (itemKey) return itemKey;

    const borrowerKey = normalizeText(item?.peminjam || '');
    return borrowerKey ? `peminjam:${borrowerKey}` : '';
}

function getInventoryStatusLabel(item) {
    if (item?.status) return item.status;
    if (isInventoryReturnRow(item)) return 'Pengembalian';
    if (isInventoryBorrowRow(item)) return 'Peminjaman';
    return '';
}

function getInventoryDateLabel(item) {
    if (isInventoryReturnRow(item)) return item.tanggalKembali || item.tanggal || '-';
    return item.tanggalPinjam || item.tanggal || '-';
}

function sortInventoryRowsByDate(rows) {
    return [...rows].sort((a, b) => getInventoryTimestamp(a) - getInventoryTimestamp(b));
}

function getInventoryTimestamp(item) {
    return parseInventoryDate(getInventoryDateLabel(item)) + parseInventoryTime(item?.jam);
}

function parseInventoryDate(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
        return Date.UTC(year, month - 1, day);
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseInventoryTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})/);
    if (!match) return 0;
    return ((Number(match[1]) * 60) + Number(match[2])) * 60 * 1000;
}

function normalizeInventoryStatusText(item) {
    return normalizeText(`${item?.status || ''} ${item?.sourceRange || ''}`);
}

function getTransactionAmount(row) {
    if (typeof row.masuk === 'number') return `+${formatRupiah(row.masuk)}`;
    if (typeof row.keluar === 'number') return `-${formatRupiah(row.keluar)}`;
    if (typeof row.nominal === 'number') return formatRupiah(row.nominal);
    return 'nominal tidak terbaca';
}

function formatUnpaidDetail(member) {
    const details = [];
    if (typeof member.outstandingAmount === 'number' && member.outstandingAmount > 0) {
        details.push(formatRupiah(member.outstandingAmount));
    }
    if (member.unpaidReason) details.push(member.unpaidReason);
    if (!details.length && member.status) details.push(member.status);
    return details.length ? ` - ${details.join(' | ')}` : '';
}

function filterMemberCashRowsByWeek(rows, weekNumber) {
    const targetWeek = Number(weekNumber);
    if (!Number.isInteger(targetWeek) || targetWeek <= 0) return [];

    return (Array.isArray(rows) ? rows : [])
        .filter((row) => getWeekNumberFromRange(row.sourceRange) === targetWeek);
}

function getWeekNumberFromRange(range) {
    const match = String(range || '').match(/\d+/);
    return match ? Number(match[0]) : null;
}

function getMemberDebtAmount(member) {
    if (typeof member?.outstandingAmount === 'number') return member.outstandingAmount;
    if (
        member?.isUnpaid
        && typeof member.dueAmount === 'number'
        && typeof member.paidAmount === 'number'
        && member.dueAmount > member.paidAmount
    ) {
        return member.dueAmount - member.paidAmount;
    }
    return 0;
}

function isInfokusItem(item) {
    const name = normalizeText(item?.barang);
    return name.includes('infokus') || name.includes('proyektor') || name.includes('projector');
}

function formatRupiah(value) {
    const number = Number(value || 0);
    return `Rp ${number.toLocaleString('id-ID')}`;
}

function getSheetsErrorMessage(error) {
    const code = error?.message || '';
    const messages = {
        google_sheets_credentials_path_missing: 'Config Google Sheets belum lengkap: GOOGLE_SHEETS_CREDENTIALS_PATH belum diisi.',
        google_sheets_credentials_not_found: 'File credential Google Sheets belum ditemukan. Cek GOOGLE_SHEETS_CREDENTIALS_PATH.',
        google_sheets_spreadsheet_id_missing: 'Config Google Sheets belum lengkap: GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID belum diisi.',
        google_sheets_range_missing: 'Config range Google Sheets belum lengkap.',
    };

    if (messages[code]) return messages[code];
    return 'Gagal membaca data Google Sheets. Cek credential, akses share Sheet, spreadsheet ID, dan range.';
}

async function isGroupAdmin(sock, groupId, senderId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const normalizedSender = normalizeParticipantId(senderId);
        const participant = metadata.participants.find((item) => {
            const ids = [item.id, item.jid, item.lid, item.phoneNumber]
                .filter(Boolean)
                .map(normalizeParticipantId);
            return ids.includes(normalizedSender);
        });

        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
        console.error('Failed to check group admin for admin sheets command:', error.message);
        return false;
    }
}

function isOwnerId(senderId) {
    const normalizedSender = normalizeParticipantId(senderId);
    return config.roles.adminLid
        .map(normalizeParticipantId)
        .includes(normalizedSender);
}

function normalizeParticipantId(value) {
    return String(value || '')
        .replace(/:\d+(?=@)/, '')
        .trim();
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

async function reply(sock, message, text) {
    return sock.sendMessage(
        message.key.remoteJid,
        { text },
        { quoted: message },
    );
}

module.exports = {
    handleAdminSheetsCommand,
    parseAdminSheetsCommand,
    formatMainCashForWhatsApp,
    formatUnpaidMembersForWhatsApp,
    formatMemberCashRecapForWhatsApp,
    formatMemberCashWeekRecapForWhatsApp,
    formatMemberCashStatusForWhatsApp,
    formatInfokusForWhatsApp,
    formatInfokusActiveForWhatsApp,
    formatInfokusHistoryForWhatsApp,
    getSheetsErrorMessage,
    isOwnerId,
};



