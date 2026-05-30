const HELP_TOPICS = {
    utama: {
        title: 'Help Utama',
        lines: [
            'Pakai format: `.help <segmen>`',
            '',
            'Segmen tersedia:',
            '- `.help umum` - command dasar anggota',
            '- `.help daftar` - cara daftar anggota',
            '- `.help ai` - Yanverse AI',
            '- `.help absen` - hadir, izin, daftar hadir',
            '- `.help sesi` - jadwal dan sesi absen',
            '- `.help drive` - dokumentasi Google Drive',
            '- `.help kas` - kas utama dan kas anggota',
            '- `.help infokus` - peminjaman infokus',
            '- `.help knowledge` - knowledge base Yanverse',
            '- `.help bot` - status dan maintenance bot',
            '- `.help admin` - command khusus admin/pengurus',
        ],
    },
    umum: {
        title: 'Help Umum',
        lines: [
            '`menu` - tampilkan menu bot lama',
            '`info` - cek data anggota kamu',
            '`pemateri` - lihat daftar pemateri',
            '`jadwalku` - lihat jadwal pemateri kamu',
            '`logo` - kirim logo Code Flow',
            '`cek lid` - cek LID WhatsApp kamu',
        ],
    },
    daftar: {
        title: 'Help Daftar',
        lines: [
            '`daftar` - mulai daftar satu-satu',
            '',
            'Format sekali kirim:',
            '`daftar`',
            '`nama Nama Kamu,`',
            '`npm 24042231035,`',
            '`prodi Sistem Informasi,`',
            '`saran Ingin aktif belajar`',
            '',
            '`add nama <nama>` - update nama',
            '`add prodi <prodi>` - update prodi',
            '`add saran <saran>` - update saran',
        ],
    },
    ai: {
        title: 'Help Yanverse AI',
        lines: [
            'Admin grup / owner:',
            '`.ai on` - aktifkan AI',
            '`.ai off` - matikan AI',
            '`.ai memory clear` - bersihkan memory chat ini',
            '',
            'Di grup:',
            '`yanverse, pertanyaan kamu`',
            '',
            'Di private chat:',
            'AI bisa dibalas langsung kalau sudah aktif.',
        ],
    },
    absen: {
        title: 'Help Absen',
        lines: [
            '`hadir` - isi hadir saat sesi dibuka',
            '`izin, alasan kamu` - ajukan izin',
            '`daftar hadir` - lihat daftar hadir',
            '`daftar izin` - lihat daftar izin',
            '',
            'Admin hadir:',
            '`buka absen` - buka sesi absen aktif',
            '`buka absen,pertemuan 4` - buka sesi tertentu',
            '`tutup absen` - tutup sesi absen',
            '`hapus hadir <nama>` - hapus anggota dari hadir',
        ],
    },
    sesi: {
        title: 'Help Sesi/Jadwal Absen',
        lines: [
            '`buat jadwal,21-05-2026,13.00-17.00,pertemuan ketiga`',
            '`buat jadwal` - buat jadwal mode tanya-jawab',
            '`liat jadwal` - lihat jadwal yang sudah dibuat',
            '`ubah jadwal,1,jam,13.00` - ubah jam',
            '`ubah jadwal,1,nama,pertemuan 4` - ubah nama sesi',
            '`hapus jadwal,1` - hapus jadwal',
            '`jam absen 13.00` - isi jam buka absen saat mode tanya-jawab',
            '`close absen 17.00` - isi jam tutup absen',
        ],
    },
    drive: {
        title: 'Help Drive/Dokumentasi',
        lines: [
            '`drive auth` - buat link auth Google Drive',
            '`drive code <kode>` - simpan kode auth',
            '`folder list` - lihat folder dokumentasi',
            '`create folder "nama folder"` - buat folder',
            '`folder aktif "nama folder"` - pilih folder aktif',
            '`remove folder "nama folder"` - hapus folder dari daftar',
            '`upload dokumentasi` / `upload docs` - upload media/file yang direply',
            '`share "nama folder" to discord` - share folder ke Discord',
            '`reset` - batalkan proses upload batch',
        ],
    },
    kas: {
        title: 'Help Kas',
        lines: [
            'Admin/owner:',
            '`.kas utama` - saldo dan transaksi kas utama',
            '`.kas belum bayar` - daftar anggota belum lunas',
            '`.kas status <nama>` - cek status kas anggota',
            '`.kas rekap` - rekap semua minggu',
            '`.kas rekap minggu <angka>` - detail minggu tertentu',
            '',
            'Contoh:',
            '`.kas status Abyan`',
            '`.kas rekap minggu 4`',
        ],
    },
    infokus: {
        title: 'Help Infokus',
        lines: [
            'Admin/owner:',
            '`.infokus` - status infokus saat ini',
            '`.infokus aktif` - peminjaman yang belum dikembalikan',
            '`.infokus riwayat` - riwayat terakhir peminjaman/pengembalian',
        ],
    },
    knowledge: {
        title: 'Help Knowledge',
        lines: [
            'Admin/owner:',
            '`.knowledge stats` - cek statistik knowledge base',
            '`.knowledge search <keyword>` - cari section knowledge',
            '',
            'Contoh:',
            '`.knowledge search medig`',
            '`.knowledge search absen`',
        ],
    },
    bot: {
        title: 'Help Bot',
        lines: [
            'Admin/owner:',
            '`.bot status` - cek health check bot',
            '',
            'Maintenance notice dikirim otomatis saat bot shutdown/startup kalau grup notice dikonfigurasi.',
        ],
    },
    admin: {
        title: 'Help Admin/Pengurus',
        lines: [
            'AI: `.ai on`, `.ai off`, `.ai memory clear`',
            'Bot: `.bot status`',
            'Knowledge: `.knowledge stats`, `.knowledge search <keyword>`',
            'Kas: `.kas utama`, `.kas belum bayar`, `.kas status <nama>`, `.kas rekap`',
            'Infokus: `.infokus`, `.infokus aktif`, `.infokus riwayat`',
            'Absen: `buat jadwal`, `buka absen`, `tutup absen`, `hapus hadir <nama>`',
            'Drive: `drive auth`, `drive code <kode>`, `upload dokumentasi`, `folder list`',
        ],
    },
};

const HELP_ALIASES = {
    main: 'utama',
    utama: 'utama',
    umum: 'umum',
    general: 'umum',
    daftar: 'daftar',
    registrasi: 'daftar',
    register: 'daftar',
    ai: 'ai',
    yanverse: 'ai',
    absen: 'absen',
    absensi: 'absen',
    hadir: 'absen',
    attendance: 'absen',
    sesi: 'sesi',
    jadwal: 'sesi',
    pertemuan: 'sesi',
    drive: 'drive',
    docs: 'drive',
    dokumentasi: 'drive',
    kas: 'kas',
    uang: 'kas',
    sheets: 'kas',
    infokus: 'infokus',
    inventaris: 'infokus',
    knowledge: 'knowledge',
    kb: 'knowledge',
    bot: 'bot',
    status: 'bot',
    admin: 'admin',
    pengurus: 'admin',
};

function parseHelpCommand(text) {
    const normalized = String(text || '').trim();
    const match = normalized.match(/^\.help(?:\s+(.+))?$/i);
    if (!match) return null;

    const topic = normalizeTopic(match[1] || 'utama');
    return { topic };
}

async function handleHelpCommand(sock, message, text) {
    const command = parseHelpCommand(text);
    if (!command) return false;

    await reply(sock, message, formatHelp(command.topic));
    return true;
}

function normalizeTopic(value) {
    const key = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    return HELP_ALIASES[key] || key || 'utama';
}

function formatHelp(topic = 'utama') {
    const help = HELP_TOPICS[topic];
    if (!help) {
        return [
            'Help tidak ditemukan.',
            '',
            'Ketik `.help` untuk melihat daftar segmen yang tersedia.',
        ].join('\n');
    }

    return [
        `~ ${help.title}`,
        '',
        ...help.lines,
    ].join('\n');
}

async function reply(sock, message, text) {
    return sock.sendMessage(
        message.key.remoteJid,
        { text },
        { quoted: message },
    );
}

module.exports = {
    handleHelpCommand,
    parseHelpCommand,
    formatHelp,
};