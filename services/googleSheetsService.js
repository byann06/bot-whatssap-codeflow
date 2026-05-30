const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('../config');

const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const EMPTY_CASH_SUMMARY = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    rowCount: 0,
};

function resolveProjectPath(value) {
    if (!value) return '';
    return path.isAbsolute(value) ? value : path.join(config.rootDir, value);
}

function normalizeRangeList(value) {
    const rawRanges = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return rawRanges
        .map(normalizeA1Range)
        .filter(Boolean);
}

function normalizeA1Range(value) {
    const range = cleanCell(value);
    if (!range) return '';

    const separatorIndex = range.indexOf('!');
    if (separatorIndex < 0) return range;

    const rawSheetName = range.slice(0, separatorIndex).trim();
    const cells = range.slice(separatorIndex + 1).trim() || 'A:Z';
    const sheetName = unquoteSheetName(rawSheetName);
    if (!sheetName) return range;

    return `${quoteSheetName(sheetName)}!${cells}`;
}

function unquoteSheetName(value) {
    let sheetName = String(value || '').trim();
    while (sheetName.startsWith("'") || sheetName.endsWith("'")) {
        if (sheetName.startsWith("'")) sheetName = sheetName.slice(1);
        if (sheetName.endsWith("'")) sheetName = sheetName.slice(0, -1);
        sheetName = sheetName.trim();
    }
    return sheetName.replace(/''/g, "'");
}

function quoteSheetName(value) {
    return `'${String(value || '').replace(/'/g, "''")}'`;
}

function getSheetsConfig() {
    const adminSpreadsheetId = config.googleSheets.adminSpreadsheetId || config.googleSheets.spreadsheetId;
    const inventorySpreadsheetId = config.googleSheets.inventorySpreadsheetId || adminSpreadsheetId;

    return {
        credentialsPath: resolveProjectPath(config.googleSheets.credentialsPath),
        adminSpreadsheetId,
        inventorySpreadsheetId,
        mainCashRange: normalizeA1Range(config.googleSheets.mainCashRange || "'KAS UTAMA'!A:Z"),
        memberCashRanges: normalizeRangeList(
            config.googleSheets.memberCashRanges?.length
                ? config.googleSheets.memberCashRanges
                : config.googleSheets.memberCashRange || "'KAS ANGGOTA MINGGU 1'!A:Z",
        ),
        inventoryRanges: normalizeRangeList(
            config.googleSheets.inventoryRanges?.length
                ? config.googleSheets.inventoryRanges
                : config.googleSheets.inventoryRange || "'Sheet Peminjaman'!A:Z",
        ),
    };
}

function validateConfig({ credentialsPath, spreadsheetId }, range) {
    if (!credentialsPath) throw new Error('google_sheets_credentials_path_missing');
    if (!fs.existsSync(credentialsPath)) throw new Error('google_sheets_credentials_not_found');
    if (!spreadsheetId) throw new Error('google_sheets_spreadsheet_id_missing');
    if (range !== undefined && !range) throw new Error('google_sheets_range_missing');
}

function getSheetsClient(spreadsheetId, range) {
    const sheetsConfig = getSheetsConfig();
    validateConfig({ credentialsPath: sheetsConfig.credentialsPath, spreadsheetId }, range);

    const auth = new google.auth.GoogleAuth({
        keyFile: sheetsConfig.credentialsPath,
        scopes: [SHEETS_READONLY_SCOPE],
    });

    return google.sheets({ version: 'v4', auth });
}

async function readSheetValues(spreadsheetId, range) {
    const normalizedRange = normalizeA1Range(range);
    const sheets = getSheetsClient(spreadsheetId, normalizedRange);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: normalizedRange,
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
    });

    return response.data.values || [];
}

async function readMultipleSheetValues(spreadsheetId, ranges) {
    const results = [];
    for (const range of normalizeRangeList(ranges)) {
        const normalizedRange = normalizeA1Range(range);
        const values = await readSheetValues(spreadsheetId, normalizedRange);
        results.push({ range: normalizedRange, values });
    }
    return results;
}

async function getSpreadsheetSheets(spreadsheetId) {
    const sheets = getSheetsClient(spreadsheetId);
    const response = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
    });

    return (response.data.sheets || [])
        .map((sheet) => sheet.properties?.title)
        .filter(Boolean);
}

async function getMemberCashRangesFromSheets(spreadsheetId) {
    const sheetNames = await getSpreadsheetSheets(spreadsheetId);
    return sheetNames
        .filter(isMemberCashSheetName)
        .sort(compareMemberCashSheetNames)
        .map(sheetNameToRange);
}

async function getInventoryRangesFromSheets(spreadsheetId) {
    const sheetNames = await getSpreadsheetSheets(spreadsheetId);
    return sheetNames
        .filter(isInventorySheetName)
        .sort((a, b) => a.localeCompare(b, 'id-ID'))
        .map(sheetNameToRange);
}

async function resolveMemberCashRanges(spreadsheetId, fallbackRanges) {
    try {
        const discoveredRanges = await getMemberCashRangesFromSheets(spreadsheetId);
        if (discoveredRanges.length) {
            logDiscoveredSheets('member cash', discoveredRanges);
            return discoveredRanges;
        }
    } catch (error) {
        console.warn(`[SHEETS] member cash auto-discover failed, using fallback ranges: ${error.message}`);
    }

    const fallback = normalizeRangeList(fallbackRanges).length
        ? normalizeRangeList(fallbackRanges)
        : normalizeRangeList("'KAS ANGGOTA MINGGU 1'!A:Z");
    logDiscoveredSheets('member cash fallback', fallback);
    return fallback;
}

async function resolveInventoryRanges(spreadsheetId, fallbackRanges) {
    try {
        const discoveredRanges = await getInventoryRangesFromSheets(spreadsheetId);
        if (discoveredRanges.length) {
            logDiscoveredSheets('inventory', discoveredRanges);
            return discoveredRanges;
        }
    } catch (error) {
        console.warn(`[SHEETS] inventory auto-discover failed, using fallback ranges: ${error.message}`);
    }

    const fallback = normalizeRangeList(fallbackRanges).length
        ? normalizeRangeList(fallbackRanges)
        : normalizeRangeList("'PEMINJAMAN'!A:Z,'PENGEMBALIAN'!A:Z");
    logDiscoveredSheets('inventory fallback', fallback);
    return fallback;
}

async function getMainCashData() {
    const { adminSpreadsheetId, mainCashRange } = getSheetsConfig();
    const values = await readSheetValues(adminSpreadsheetId, mainCashRange);
    const rows = parseMainCashRows(values);

    return {
        range: mainCashRange,
        rows,
        summary: summarizeMainCash(rows),
    };
}

async function getMemberCashData() {
    const { adminSpreadsheetId, memberCashRanges } = getSheetsConfig();
    const resolvedRanges = await resolveMemberCashRanges(adminSpreadsheetId, memberCashRanges);
    const sheetValues = await readMultipleSheetValues(adminSpreadsheetId, resolvedRanges);
    const rows = sheetValues.flatMap(({ range, values }) => (
        parseMemberCashRows(values).map((row) => ({ ...row, sourceRange: range }))
    ));

    return {
        ranges: resolvedRanges,
        rows,
        summary: summarizeMemberCash(rows),
    };
}

async function getUnpaidMembers() {
    const memberCash = await getMemberCashData();
    return memberCash.rows.filter((member) => member.isUnpaid);
}

async function getMemberCashStatus(name) {
    const memberCash = await getMemberCashData();
    return findMemberCashStatus(memberCash.rows, name);
}

async function getInventoryLoanData() {
    const { inventorySpreadsheetId, inventoryRanges } = getSheetsConfig();
    const resolvedRanges = await resolveInventoryRanges(inventorySpreadsheetId, inventoryRanges);
    const sheetValues = await readMultipleSheetValues(inventorySpreadsheetId, resolvedRanges);
    const rows = sheetValues.flatMap(({ range, values }) => (
        parseInventoryRows(values).map((row) => ({
            ...row,
            status: row.status || getInventoryStatusFromRange(range),
            sourceRange: range,
        }))
    ));

    return {
        ranges: resolvedRanges,
        rows,
        summary: summarizeInventory(rows),
    };
}

function isMemberCashSheetName(sheetName) {
    const name = normalizeHeader(sheetName);
    return /^kas anggota minggu \d+$/.test(name) || /^minggu \d+$/.test(name);
}

function isInventorySheetName(sheetName) {
    const name = normalizeHeader(sheetName);
    return ['peminjaman', 'pengembalian', 'infokus', 'inventaris', 'riwayat'].some((keyword) => name.includes(keyword));
}

function compareMemberCashSheetNames(a, b) {
    const numberA = extractWeekNumber(a);
    const numberB = extractWeekNumber(b);
    if (numberA !== numberB) return numberA - numberB;
    return a.localeCompare(b, 'id-ID');
}

function extractWeekNumber(sheetName) {
    const match = normalizeHeader(sheetName).match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function sheetNameToRange(sheetName) {
    return normalizeA1Range(`${quoteSheetName(sheetName)}!A:Z`);
}

function getSheetNameFromRange(range) {
    const separatorIndex = String(range || '').indexOf('!');
    if (separatorIndex < 0) return cleanCell(range);
    return unquoteSheetName(String(range).slice(0, separatorIndex));
}

function logDiscoveredSheets(label, ranges) {
    const tabs = normalizeRangeList(ranges).map(getSheetNameFromRange).filter(Boolean);
    console.log(`[SHEETS] ${label} tabs=${tabs.join(', ') || '-'}`);
}

function getInventoryStatusFromRange(range) {
    const name = normalizeHeader(getSheetNameFromRange(range));
    if (name.includes('pengembalian')) return 'Pengembalian';
    if (name.includes('peminjaman')) return 'Peminjaman';
    return '';
}

function parseMainCashRows(values) {
    return parseTable(values).map(({ object, raw }) => {
        const income = parseMoney(getByAliases(object, ['masuk', 'pemasukan', 'debit', 'income', 'uang masuk']));
        const expense = parseMoney(getByAliases(object, ['keluar', 'pengeluaran', 'kredit', 'credit', 'expense', 'uang keluar']));
        const amount = parseMoney(getByAliases(object, ['nominal', 'jumlah', 'amount', 'total']));
        const balance = parseMoney(getByAliases(object, ['saldo', 'balance', 'sisa kas', 'total uang kas', 'total kas', 'uang kas']));

        return {
            tanggal: getByAliases(object, ['tanggal', 'date', 'waktu']),
            keterangan: getByAliases(object, ['keterangan', 'deskripsi', 'uraian', 'catatan', 'description']),
            kategori: getByAliases(object, ['kategori', 'category', 'jenis']),
            masuk: income,
            keluar: expense,
            nominal: amount,
            saldo: balance,
            raw,
        };
    }).filter(isMainCashTransactionRow);
}

function parseMemberCashRows(values) {
    return parseTable(values).map(({ object, raw }) => {
        const name = getByAliases(object, ['nama', 'nama anggota', 'anggota', 'member', 'name']);
        const paidAmount = parseMoney(getByAliases(object, ['terbayar', 'dibayar', 'bayar', 'sudah bayar', 'paid', 'total bayar']));
        const dueAmount = parseMoney(getByAliases(object, ['tagihan', 'iuran', 'wajib bayar', 'harus bayar', 'due', 'total tagihan']));
        const outstandingAmount = parseMoney(getByAliases(object, ['tunggakan', 'sisa', 'kurang', 'belum bayar', 'outstanding', 'arrears', 'hutang', 'kas']));
        const status = getByAliases(object, ['status', 'keterangan', 'ket', 'status kas']);
        const paymentCells = getPaymentCells(object);
        const isUnpaid = isUnpaidMember({ status, paidAmount, dueAmount, outstandingAmount, paymentCells });

        return {
            nama: name,
            npm: getByAliases(object, ['npm', 'nim', 'id anggota', 'id']),
            status,
            paidAmount,
            dueAmount,
            outstandingAmount,
            isUnpaid,
            unpaidReason: getUnpaidReason({ status, paidAmount, dueAmount, outstandingAmount, paymentCells }),
            payments: paymentCells,
            raw,
        };
    }).filter((member) => Boolean(member.nama));
}

function parseInventoryRows(values) {
    return parseTable(values).map(({ object, raw }) => {
        const useFallbackOrder = usesFallbackColumns(object);
        const tanggal = getInventoryField(object, raw, [
            'tanggal', 'date', 'waktu', 'tanggal pinjam', 'tanggal ambil', 'tanggal pengambilan',
        ], useFallbackOrder ? 0 : null);
        const tanggalPinjam = getInventoryField(object, raw, [
            'tanggal pinjam', 'pinjam', 'borrow date', 'borrowed at', 'tanggal ambil', 'tanggal pengambilan',
        ], useFallbackOrder ? 0 : null);
        const tanggalKembali = getInventoryField(object, raw, [
            'tanggal kembali', 'kembali', 'return date', 'returned at', 'tanggal pengembalian',
        ], useFallbackOrder ? 4 : null);

        return {
            barang: getInventoryField(object, raw, [
                'no s/n', 'no sn', 'seri', 'no seri', 'barang', 'item', 'nama barang',
                'inventaris', 'alat', 'inv.ypm.no', 'inv ypm no',
            ]),
            peminjam: getInventoryField(object, raw, [
                'nama', 'peminjam', 'borrower', 'nama peminjam', 'dipinjam oleh',
                'nama pengambil', 'pengambil', 'nama pengembali', 'pengembali',
            ], useFallbackOrder ? 1 : null),
            tanggal,
            tanggalPinjam,
            tanggalKembali,
            jam: getInventoryField(object, raw, ['jam', 'jam ambil', 'jam pengembalian', 'jam kembali']),
            kegiatan: getInventoryField(object, raw, ['kegiatan', 'agenda', 'keperluan'], useFallbackOrder ? 2 : null),
            lokasi: getInventoryField(object, raw, ['lokasi', 'lokasi ambil', 'lokasi pengembalian', 'lokasi kembali']),
            status: getInventoryField(object, raw, ['status', 'keterangan', 'ket'], useFallbackOrder ? 3 : null),
            kondisi: getInventoryField(object, raw, ['kondisi', 'condition']),
            perlengkapan: getInventoryField(object, raw, ['perlengkapan', 'kelengkapan', 'accessories']),
            catatan: getInventoryField(object, raw, ['catatan', 'note', 'notes', 'keterangan tambahan'], useFallbackOrder ? 5 : null),
            raw,
        };
    }).filter(hasInventoryRowContent);
}

function getInventoryField(object, raw, aliases, fallbackIndex) {
    const value = getByAliases(object, aliases);
    if (hasMeaningfulCell(value)) return value;

    if (Number.isInteger(fallbackIndex)) {
        const fallback = cleanCell(raw?.[fallbackIndex]);
        if (hasMeaningfulCell(fallback)) return fallback;
    }

    return '';
}

function usesFallbackColumns(object) {
    return Object.keys(object || {}).some((key) => /^column \d+$/.test(key));
}

function hasInventoryRowContent(item) {
    return [
        item.barang,
        item.peminjam,
        item.tanggal,
        item.tanggalPinjam,
        item.tanggalKembali,
        item.kegiatan,
        item.status,
        item.kondisi,
        item.perlengkapan,
        item.catatan,
    ].some(hasMeaningfulCell);
}

function hasMeaningfulCell(value) {
    const text = cleanCell(value);
    if (!text) return false;

    const normalized = normalizeHeader(text);
    return normalized !== '-' && !/^x+$/.test(normalized);
}

function parseTable(values) {
    if (!Array.isArray(values) || !values.length) return [];

    const rows = values.filter((row) => Array.isArray(row) && row.some((cell) => cleanCell(cell)));
    if (!rows.length) return [];

    const headerIndex = rows.findIndex(isLikelyHeaderRow);
    const headers = headerIndex >= 0 ? rows[headerIndex].map(normalizeHeader) : [];
    const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

    return dataRows.map((row) => ({
        raw: row.map(cleanCell),
        object: headers.length ? rowToObject(row, headers) : rowToFallbackObject(row),
    }));
}

function rowToObject(row, headers) {
    return headers.reduce((result, header, index) => {
        const key = header || `column ${index + 1}`;
        result[key] = cleanCell(row[index]);
        return result;
    }, {});
}

function rowToFallbackObject(row) {
    return row.reduce((result, value, index) => {
        result[`column ${index + 1}`] = cleanCell(value);
        return result;
    }, {});
}

function isLikelyHeaderRow(row) {
    const headers = row.map(normalizeHeader);
    const knownHeaders = new Set([
        'tanggal', 'date', 'waktu', 'keterangan', 'deskripsi', 'uraian', 'kategori', 'jenis',
        'masuk', 'pemasukan', 'debit', 'keluar', 'pengeluaran', 'kredit', 'nominal', 'jumlah',
        'saldo', 'nama', 'nama anggota', 'anggota', 'member', 'npm', 'nim', 'status', 'tagihan',
        'iuran', 'terbayar', 'dibayar', 'tunggakan', 'sisa', 'kurang', 'barang', 'item',
        'inventaris', 'peminjam', 'tanggal pinjam', 'tanggal pengambilan', 'tanggal kembali', 'kondisi',
        'nama pengambil', 'tanggal ambil', 'jam ambil', 'kegiatan', 'lokasi ambil',
        'no s/n', 'no sn', 'seri', 'no seri', 'inv.ypm.no', 'inv ypm no',
        'nama file dokumentasi', 'perlengkapan', 'catatan', 'note', 'notes', 'keperluan', 'nama pengembali', 'pengembali',
        'tanggal pengembalian', 'jam pengembalian', 'lokasi pengembalian',
    ]);

    const knownCount = headers.filter((header) => knownHeaders.has(header) || isPaymentColumn(header)).length;
    return knownCount >= 2;
}

function getByAliases(object, aliases) {
    const entries = Object.entries(object);
    const normalizedAliases = aliases.map(normalizeHeader);

    for (const alias of normalizedAliases) {
        const exact = entries.find(([key, value]) => key === alias && cleanCell(value));
        if (exact) return cleanCell(exact[1]);
    }

    for (const alias of normalizedAliases) {
        const partial = entries.find(([key, value]) => (key.includes(alias) || alias.includes(key)) && cleanCell(value));
        if (partial) return cleanCell(partial[1]);
    }

    return '';
}

function getPaymentCells(object) {
    return Object.entries(object)
        .filter(([key]) => isPaymentColumn(key))
        .map(([period, value]) => ({
            period,
            value: cleanCell(value),
            paid: isPaidValue(value),
            unpaid: isUnpaidValue(value),
        }));
}

function isPaymentColumn(key) {
    const normalized = normalizeHeader(key);
    return /^(jan|januari|feb|februari|mar|maret|apr|april|mei|jun|juni|jul|juli|agu|agustus|sep|september|okt|oktober|nov|november|des|desember)(\s+\d{4})?$/.test(normalized)
        || normalized.startsWith('minggu ')
        || normalized.startsWith('bulan ')
        || normalized.startsWith('kas ');
}

function isUnpaidMember({ status, paidAmount, dueAmount, outstandingAmount, paymentCells }) {
    if (isUnpaidValue(status)) return true;
    if (typeof outstandingAmount === 'number' && outstandingAmount > 0) return true;
    if (typeof dueAmount === 'number' && typeof paidAmount === 'number' && paidAmount < dueAmount) return true;
    return paymentCells.some((cell) => cell.unpaid);
}

function getUnpaidReason({ status, paidAmount, dueAmount, outstandingAmount, paymentCells }) {
    if (isUnpaidValue(status)) return status;
    if (typeof outstandingAmount === 'number' && outstandingAmount > 0) return `sisa ${formatNumber(outstandingAmount)}`;
    if (typeof dueAmount === 'number' && typeof paidAmount === 'number' && paidAmount < dueAmount) {
        return `kurang ${formatNumber(dueAmount - paidAmount)}`;
    }

    const unpaidPeriods = paymentCells.filter((cell) => cell.unpaid).map((cell) => cell.period);
    return unpaidPeriods.length ? `belum bayar: ${unpaidPeriods.join(', ')}` : '';
}

function findMemberCashStatus(rows, name) {
    const target = normalizeName(name);
    if (!target) return null;

    return rows.find((member) => {
        const memberName = normalizeName(member.nama);
        return memberName === target || memberName.includes(target) || target.includes(memberName);
    }) || null;
}

function summarizeMainCash(rows) {
    if (!rows.length) return { ...EMPTY_CASH_SUMMARY };

    const totalIncome = sumMoney(rows.map((row) => row.masuk ?? positiveNominal(row)));
    const totalExpense = sumMoney(rows.map((row) => row.keluar ?? negativeNominal(row)));
    const latestBalance = [...rows].reverse().find((row) => typeof row.saldo === 'number')?.saldo;

    return {
        totalIncome,
        totalExpense,
        balance: typeof latestBalance === 'number' ? latestBalance : totalIncome - totalExpense,
        rowCount: rows.length,
    };
}

function summarizeMemberCash(rows) {
    const unpaidMembers = rows.filter((member) => member.isUnpaid);
    const paidMembers = rows.filter((member) => !member.isUnpaid && (isPaidValue(member.status) || member.payments.some((item) => item.paid)));

    return {
        totalMembers: rows.length,
        paidMembers: paidMembers.length,
        unpaidMembers: unpaidMembers.length,
        unknownStatusMembers: rows.length - paidMembers.length - unpaidMembers.length,
    };
}

function summarizeMemberCashByWeek(rows) {
    const groups = new Map();

    for (const member of rows || []) {
        const sourceRange = member.sourceRange || 'Unknown';
        if (!groups.has(sourceRange)) {
            groups.set(sourceRange, {
                sourceRange,
                label: formatWeekLabelFromRange(sourceRange),
                weekNumber: extractWeekNumber(sourceRange),
                totalMembers: 0,
                paidMembers: 0,
                unpaidMembers: 0,
                totalCollected: 0,
                totalDebt: 0,
            });
        }

        const group = groups.get(sourceRange);
        group.totalMembers += 1;
        if (member.isUnpaid) group.unpaidMembers += 1;
        else group.paidMembers += 1;
        group.totalCollected += typeof member.paidAmount === 'number' ? member.paidAmount : 0;
        group.totalDebt += getMemberDebtAmount(member);
    }

    const weeks = Array.from(groups.values())
        .sort((a, b) => a.weekNumber - b.weekNumber || a.label.localeCompare(b.label, 'id-ID'));

    return {
        weeks,
        total: weeks.reduce((summary, week) => ({
            totalMembers: summary.totalMembers + week.totalMembers,
            paidMembers: summary.paidMembers + week.paidMembers,
            unpaidMembers: summary.unpaidMembers + week.unpaidMembers,
            totalCollected: summary.totalCollected + week.totalCollected,
            totalDebt: summary.totalDebt + week.totalDebt,
        }), {
            totalMembers: 0,
            paidMembers: 0,
            unpaidMembers: 0,
            totalCollected: 0,
            totalDebt: 0,
        }),
    };
}

function getMemberDebtAmount(member) {
    if (typeof member.outstandingAmount === 'number') return member.outstandingAmount;
    if (
        member.isUnpaid
        && typeof member.dueAmount === 'number'
        && typeof member.paidAmount === 'number'
        && member.dueAmount > member.paidAmount
    ) {
        return member.dueAmount - member.paidAmount;
    }
    return 0;
}

function formatWeekLabelFromRange(range) {
    const sheetName = getSheetNameFromRange(range) || String(range || '').trim();
    const weekNumber = extractWeekNumber(sheetName);
    if (Number.isFinite(weekNumber) && weekNumber !== Number.MAX_SAFE_INTEGER) {
        return `Minggu ${weekNumber}`;
    }
    return sheetName || 'Tanpa Minggu';
}

function summarizeInventory(rows) {
    return {
        totalItems: rows.length,
        borrowedItems: rows.filter((item) => isBorrowedStatus(item.status)).length,
        returnedItems: rows.filter((item) => isReturnedStatus(item.status)).length,
    };
}

function hasCashRowContent(row) {
    return Boolean(row.tanggal || row.keterangan || row.kategori || row.masuk || row.keluar || row.nominal || row.saldo);
}

function isMainCashTransactionRow(row) {
    if (!hasCashRowContent(row)) return false;

    const rawText = Array.isArray(row.raw) ? row.raw.join(' ').trim().toLowerCase() : '';
    if (rawText.startsWith('noted:')) return false;

    const date = cleanCell(row.tanggal);
    const description = cleanCell(row.keterangan);
    const category = cleanCell(row.kategori);
    const hasMovement = typeof row.masuk === 'number' || typeof row.keluar === 'number' || typeof row.nominal === 'number';
    const hasInfo = [description, category].some((value) => value && value !== '-');

    if (!date && !hasInfo && hasMovement) return false;
    if (date === '-' && !hasInfo && !hasMovement) return false;

    return hasMovement || hasInfo;
}

function positiveNominal(row) {
    if (typeof row.nominal === 'number' && !isExpenseText(`${row.kategori} ${row.keterangan}`)) return row.nominal;
    return null;
}

function negativeNominal(row) {
    if (typeof row.nominal === 'number' && isExpenseText(`${row.kategori} ${row.keterangan}`)) return row.nominal;
    return null;
}

function isExpenseText(value) {
    const text = normalizeHeader(value);
    return ['keluar', 'pengeluaran', 'beli', 'bayar', 'biaya', 'expense'].some((word) => text.includes(word));
}

function isPaidValue(value) {
    const text = normalizeHeader(value);
    return ['lunas', 'paid', 'sudah bayar', 'sudah', 'ok', 'done'].some((word) => text === word || text.includes(word));
}

function isUnpaidValue(value) {
    const text = normalizeHeader(value);
    return ['belum', 'unpaid', 'tunggak', 'menunggak', 'kurang', 'hutang', 'pending', 'minus'].some((word) => text.includes(word));
}

function isBorrowedStatus(value) {
    const text = normalizeHeader(value);
    return ['dipinjam', 'pinjam', 'borrowed', 'keluar'].some((word) => text.includes(word));
}

function isReturnedStatus(value) {
    const text = normalizeHeader(value);
    return ['kembali', 'dikembalikan', 'returned', 'available', 'tersedia'].some((word) => text.includes(word));
}

function parseMoney(value) {
    const text = cleanCell(value);
    if (!text || !/\d/.test(text)) return null;

    let cleaned = text.replace(/[^\d,.-]/g, '');
    const negative = cleaned.startsWith('-');
    const unsigned = cleaned.replace(/^-/, '');
    const lastComma = unsigned.lastIndexOf(',');
    const lastDot = unsigned.lastIndexOf('.');

    if (lastComma >= 0 && lastDot >= 0) {
        cleaned = lastComma > lastDot
            ? unsigned.replace(/\./g, '').replace(',', '.')
            : unsigned.replace(/,/g, '');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
        cleaned = unsigned.replace(/\./g, '');
    } else if (/^\d{1,3}(,\d{3})+$/.test(unsigned)) {
        cleaned = unsigned.replace(/,/g, '');
    } else if (lastComma >= 0) {
        cleaned = unsigned.replace(',', '.');
    } else {
        cleaned = unsigned;
    }

    const parsed = Number(`${negative ? '-' : ''}${cleaned}`);
    return Number.isFinite(parsed) ? parsed : null;
}

function sumMoney(values) {
    return values.reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0);
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('id-ID');
}

function normalizeName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s.]/g, ' ')
        .replace(/\s+/g, ' ');
}

function normalizeHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function cleanCell(value) {
    return String(value || '').trim();
}

module.exports = {
    getMainCashData,
    getMemberCashData,
    summarizeMemberCashByWeek,
    getUnpaidMembers,
    getMemberCashStatus,
    getInventoryLoanData,
    getSpreadsheetSheets,
    getMemberCashRangesFromSheets,
    getInventoryRangesFromSheets,
    normalizeA1Range,
    normalizeRangeList,
    parseMainCashRows,
    parseMemberCashRows,
    parseInventoryRows,
    parseTable,
    findMemberCashStatus,
    isUnpaidMember,
    parseMoney,
};





