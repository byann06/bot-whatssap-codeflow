const {
    getMainCashData,
    getMemberCashData,
    summarizeMemberCashByWeek,
    getUnpaidMembers,
    getMemberCashStatus,
    getInventoryLoanData,
} = require('./googleSheetsService');

const MAX_UNPAID_CONTEXT_ROWS = 20;
const MAX_TRANSACTION_CONTEXT_ROWS = 3;
const MAX_INVENTORY_HISTORY_ROWS = 5;

async function getAdminContextForAI(text) {
    const intent = detectAdminContextIntent(text);
    if (!intent) return '';

    try {
        if (intent.type === 'main_cash') return formatMainCashContext(await getMainCashData());
        if (intent.type === 'unpaid_cash') return formatUnpaidCashContext(await getUnpaidMembers());
        if (intent.type === 'member_cash_week') return await getMemberCashWeekContext(intent.weekNumber);
        if (intent.type === 'member_cash_status') return await getMemberCashStatusContext(intent.name);
        if (intent.type === 'inventory_history') return formatInventoryHistoryContext(await getInventoryLoanData());
        if (intent.type === 'inventory_status') return formatInventoryStatusContext(await getInventoryLoanData());
    } catch (error) {
        console.error('[ADMIN_CONTEXT] failed:', error.message);
        return [
            '[ADMIN DATA]',
            'Data administrasi gagal dibaca dari Google Sheets saat ini.',
            'Jangan menebak angka, nama, atau status. Minta admin cek konfigurasi/akses Google Sheets.',
        ].join('\n');
    }

    return '';
}

function isAdminContextQuestion(text) {
    return Boolean(detectAdminContextIntent(text));
}

function getAdminContextAccessDenied() {
    return [
        '[ADMIN DATA ACCESS]',
        'User ini bukan admin grup atau owner.',
        'Jangan tampilkan data kas, data anggota belum bayar, atau data infokus.',
        'Jawab singkat bahwa data administrasi hanya bisa diakses admin/pengurus.',
    ].join('\n');
}

function detectAdminContextIntent(text) {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    if (containsAny(normalized, ['infokus', 'proyektor', 'projector', 'inventaris'])) {
        if (containsAny(normalized, ['riwayat', 'terakhir', 'history', 'pengembalian'])) {
            return { type: 'inventory_history' };
        }
        return { type: 'inventory_status' };
    }

    const weekNumber = extractWeekNumber(normalized);
    if (weekNumber && containsAny(normalized, ['kas', 'bayar', 'lunas', 'minggu'])) {
        return { type: 'member_cash_week', weekNumber };
    }

    if (containsAny(normalized, ['belum bayar kas', 'belum lunas', 'belum bayar', 'nunggak', 'tunggakan'])) {
        return { type: 'unpaid_cash' };
    }

    if (containsAny(normalized, ['kas utama', 'saldo kas', 'uang kas', 'total kas'])) {
        return { type: 'main_cash' };
    }

    const statusName = extractMemberCashStatusName(text);
    if (statusName) {
        return { type: 'member_cash_status', name: statusName };
    }

    return null;
}

function formatMainCashContext(data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const summary = data?.summary || {};
    const latestTransactions = rows.slice(-MAX_TRANSACTION_CONTEXT_ROWS).reverse();
    const lines = [
        '[ADMIN DATA - KAS UTAMA]',
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
        `Saldo: ${formatRupiah(summary.balance)}`,
        `Total Masuk: ${formatRupiah(summary.totalIncome)}`,
        `Total Keluar: ${formatRupiah(summary.totalExpense)}`,
    ];

    if (latestTransactions.length) {
        lines.push('Transaksi Terakhir:');
        latestTransactions.forEach((row) => {
            const amount = getTransactionAmount(row);
            const category = row.kategori || row.jenis || '-';
            const description = row.keterangan || '-';
            lines.push(`- ${row.tanggal || '-'} | ${category} | ${description} | ${amount}`);
        });
    }

    return lines.join('\n');
}

function formatUnpaidCashContext(members) {
    const rows = Array.isArray(members) ? members : [];
    const visibleRows = rows.slice(0, MAX_UNPAID_CONTEXT_ROWS);
    const lines = [
        '[ADMIN DATA - KAS BELUM BAYAR]',
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
        `Total entri belum lunas: ${rows.length}`,
    ];

    if (!visibleRows.length) {
        lines.push('Tidak ada anggota yang terdeteksi belum lunas.');
        return lines.join('\n');
    }

    lines.push('Daftar ringkas:');
    visibleRows.forEach((member) => {
        lines.push(`- ${member.nama || '-'} | ${formatWeekLabelFromRange(member.sourceRange)} | ${formatMemberDebt(member)}`);
    });

    if (rows.length > visibleRows.length) {
        lines.push(`dan ${rows.length - visibleRows.length} lainnya`);
    }

    return lines.join('\n');
}

async function getMemberCashWeekContext(weekNumber) {
    const memberCash = await getMemberCashData();
    const rows = (memberCash.rows || []).filter((member) => getWeekNumberFromRange(member.sourceRange) === weekNumber);
    if (!rows.length) {
        return [
            `[ADMIN DATA - KAS MINGGU ${weekNumber}]`,
            `Data kas minggu ${weekNumber} tidak ditemukan.`,
        ].join('\n');
    }

    const recap = summarizeMemberCashByWeek(rows);
    const total = recap.total || {};
    const unpaidRows = rows.filter((member) => member.isUnpaid);
    const visibleUnpaidRows = unpaidRows.slice(0, MAX_UNPAID_CONTEXT_ROWS);
    const lines = [
        `[ADMIN DATA - KAS MINGGU ${weekNumber}]`,
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
        `Anggota: ${total.totalMembers || 0}`,
        `Lunas: ${total.paidMembers || 0}`,
        `Belum Lunas: ${total.unpaidMembers || 0}`,
        `Terkumpul: ${formatRupiah(total.totalCollected)}`,
        `Hutang: ${formatRupiah(total.totalDebt)}`,
    ];

    if (visibleUnpaidRows.length) {
        lines.push('Belum Lunas:');
        visibleUnpaidRows.forEach((member) => {
            lines.push(`- ${member.nama || '-'} | ${formatMemberDebt(member)}`);
        });
    } else {
        lines.push('Belum Lunas: tidak ada');
    }

    if (unpaidRows.length > visibleUnpaidRows.length) {
        lines.push(`dan ${unpaidRows.length - visibleUnpaidRows.length} lainnya`);
    }

    return lines.join('\n');
}

async function getMemberCashStatusContext(name) {
    const member = await getMemberCashStatus(name);
    if (!member) {
        return [
            `[ADMIN DATA - STATUS KAS ${name}]`,
            'Anggota tidak ditemukan di data kas.',
        ].join('\n');
    }

    const lines = [
        `[ADMIN DATA - STATUS KAS ${member.nama || name}]`,
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
        `Status: ${member.status || (member.isUnpaid ? 'Belum lunas' : 'Lunas/aman')}`,
        `Tunggakan: ${formatMemberDebt(member)}`,
    ];

    if (member.unpaidReason) lines.push(`Catatan: ${member.unpaidReason}`);
    return lines.join('\n');
}

function formatInventoryStatusContext(data) {
    const activeRows = getActiveInventoryLoans(data);
    const lines = [
        '[ADMIN DATA - INFOKUS]',
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
    ];

    if (!activeRows.length) {
        lines.push('Status: Infokus sedang tidak dipinjam.');
        return lines.join('\n');
    }

    lines.push(`Peminjaman aktif: ${activeRows.length}`);
    activeRows.slice(0, MAX_INVENTORY_HISTORY_ROWS).forEach((item) => {
        lines.push(`- ${item.peminjam || '-'} | ${item.tanggalPinjam || item.tanggal || '-'} | ${item.kegiatan || '-'} | ${item.status || 'Peminjaman'}${item.catatan ? ` | ${item.catatan}` : ''}`);
    });

    if (activeRows.length > MAX_INVENTORY_HISTORY_ROWS) {
        lines.push(`dan ${activeRows.length - MAX_INVENTORY_HISTORY_ROWS} lainnya`);
    }

    return lines.join('\n');
}

function formatInventoryHistoryContext(data) {
    const rows = getTargetInventoryRows(data)
        .filter(isDisplayableInventoryRow)
        .sort((a, b) => getInventoryTimestamp(a) - getInventoryTimestamp(b))
        .slice(-MAX_INVENTORY_HISTORY_ROWS)
        .reverse();
    const lines = [
        '[ADMIN DATA - RIWAYAT INFOKUS]',
        'Sifat data: read-only dari Google Sheets. Jangan klaim bisa mengedit spreadsheet.',
    ];

    if (!rows.length) {
        lines.push('Belum ada riwayat infokus yang terbaca.');
        return lines.join('\n');
    }

    rows.forEach((item) => {
        lines.push(`- ${getInventoryStatusLabel(item)} | ${item.peminjam || '-'} | ${getInventoryDateLabel(item)} | ${item.kegiatan || '-'}${item.catatan ? ` | ${item.catatan}` : ''}`);
    });

    return lines.join('\n');
}

function extractMemberCashStatusName(text) {
    const rawText = String(text || '').trim();
    const match = rawText.match(/(?:status\s+kas|kas\s+status)\s+(.+)/i);
    if (!match) return '';

    return cleanNameQuery(match[1]);
}

function cleanNameQuery(value) {
    return String(value || '')
        .replace(/\b(gimana|bagaimana|berapa|dong|nih|ya|sekarang|statusnya|kasnya|tolong|cek|coba|lihat|liat)\b/gi, ' ')
        .replace(/[?!.,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractWeekNumber(normalizedText) {
    const match = normalizedText.match(/(?:minggu|pekan)\s*(\d+)/i);
    return match ? Number(match[1]) : null;
}

function getTargetInventoryRows(data) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const infokusRows = rows.filter(isInfokusItem);
    return infokusRows.length ? infokusRows : rows;
}

function getActiveInventoryLoans(data) {
    const latestByItem = new Map();
    getTargetInventoryRows(data)
        .filter(isDisplayableInventoryRow)
        .forEach((item, index) => {
            const key = getInventoryMatchKey(item);
            if (!key) return;

            const current = latestByItem.get(key);
            const candidate = { item, index, timestamp: getInventoryTimestamp(item) };
            if (!current || candidate.timestamp > current.timestamp || (candidate.timestamp === current.timestamp && candidate.index > current.index)) {
                latestByItem.set(key, candidate);
            }
        });

    return Array.from(latestByItem.values())
        .map((entry) => entry.item)
        .filter(isInventoryBorrowRow);
}

function isInventoryBorrowRow(item) {
    if (!isDisplayableInventoryRow(item) || isInventoryReturnRow(item)) return false;
    const text = normalizeText(`${item?.status || ''} ${item?.sourceRange || ''}`);
    return text.includes('peminjaman') || text.includes('dipinjam') || text.includes('pinjam') || Boolean(item.tanggalPinjam) || Boolean(item.peminjam);
}

function isInventoryReturnRow(item) {
    const text = normalizeText(`${item?.status || ''} ${item?.sourceRange || ''}`);
    return text.includes('pengembalian') || text.includes('dikembalikan') || text.includes('returned') || text.includes('tersedia') || text.includes('kembali') || Boolean(item.tanggalKembali);
}

function isDisplayableInventoryRow(item) {
    return Boolean(item?.peminjam || item?.barang || item?.kegiatan || item?.status || item?.tanggalPinjam || item?.tanggalKembali || item?.catatan);
}

function isInfokusItem(item) {
    const name = normalizeText(item?.barang);
    return name.includes('infokus') || name.includes('proyektor') || name.includes('projector');
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
    return 'Riwayat';
}

function getInventoryDateLabel(item) {
    if (isInventoryReturnRow(item)) return item.tanggalKembali || item.tanggal || '-';
    return item.tanggalPinjam || item.tanggal || '-';
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

function getWeekNumberFromRange(range) {
    const match = String(range || '').match(/\d+/);
    return match ? Number(match[0]) : null;
}

function formatWeekLabelFromRange(range) {
    const week = getWeekNumberFromRange(range);
    return week ? `Minggu ${week}` : 'Tanpa minggu';
}

function formatMemberDebt(member) {
    const amount = getMemberDebtAmount(member);
    if (amount > 0) return formatRupiah(amount);
    return member?.isUnpaid ? (member.unpaidReason || 'Belum lunas') : 'Rp 0';
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

function getTransactionAmount(row) {
    if (typeof row?.masuk === 'number') return `+${formatRupiah(row.masuk)}`;
    if (typeof row?.keluar === 'number') return `-${formatRupiah(row.keluar)}`;
    if (typeof row?.nominal === 'number') return formatRupiah(row.nominal);
    return 'nominal tidak terbaca';
}

function formatRupiah(value) {
    const number = Number(value || 0);
    return `Rp ${number.toLocaleString('id-ID')}`;
}

function containsAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
}

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

module.exports = {
    getAdminContextForAI,
    isAdminContextQuestion,
    getAdminContextAccessDenied,
    detectAdminContextIntent,
};

