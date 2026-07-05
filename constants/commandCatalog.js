const COMMAND_CATEGORIES = [
    {
        title: 'Umum Anggota',
        access: 'Semua anggota',
        description: 'Command dasar untuk melihat informasi komunitas, akun, pemateri, dan panduan bot.',
        commands: [
            {
                command: 'menu',
                summary: 'Melihat semua command bot yang sudah difilter per kategori.',
                usage: 'menu',
                examples: ['menu'],
                notes: ['Menu hanya ringkasan. Untuk panduan lengkap, gunakan command `command`.'],
            },
            {
                command: 'command',
                aliases: ['commands', 'panduan', 'panduan bot'],
                summary: 'Mengirim file PDF panduan lengkap command bot.',
                usage: 'command',
                examples: ['command'],
                notes: ['Bot akan mengirim PDF sebagai dokumen agar mudah disimpan dan dibaca ulang.'],
            },
            {
                command: '.help',
                summary: 'Melihat help singkat berdasarkan segmen.',
                usage: '.help <segmen>',
                examples: ['.help', '.help absen', '.help drive'],
                notes: ['Segmen: umum, daftar, ai, absen, sesi, drive, kas, infokus, knowledge, bot, admin.'],
            },
            {
                command: 'link',
                summary: 'Melihat link penting komunitas.',
                usage: 'link',
                examples: ['link'],
            },
            {
                command: 'info',
                summary: 'Melihat data akun anggota yang terdaftar.',
                usage: 'info',
                examples: ['info'],
                notes: ['Jika data belum ada, bot akan memberi format daftar.'],
            },
            {
                command: 'daftar',
                summary: 'Mendaftarkan anggota baru.',
                usage: 'daftar',
                examples: [
                    'daftar',
                    'daftar | Nama Lengkap | NPM | Prodi | Anggota | - | Saran',
                    'daftar nama Abyan, npm 24042231035, prodi Sistem Informasi, saran Ingin aktif',
                ],
                notes: ['Pendaftaran lewat bot hanya untuk role Anggota. Pengurus harus menghubungi admin.'],
            },
            {
                command: 'add',
                summary: 'Mengubah data diri yang sudah terdaftar.',
                usage: 'add <field> <nilai>',
                examples: [
                    'add npm 24042231035',
                    'add no 628123456789',
                    'add prodi Sistem Informasi',
                    'add saran Perbanyak kegiatan rutin',
                ],
                notes: ['Field yang bisa diubah: nama, npm, prodi, role, pengurus, saran, no.'],
            },
            {
                command: 'pemateri',
                summary: 'Melihat susunan pemateri kegiatan rutin.',
                usage: 'pemateri',
                examples: ['pemateri'],
            },
            {
                command: 'jadwalku',
                summary: 'Melihat kapan kamu menjadi pemateri.',
                usage: 'jadwalku',
                examples: ['jadwalku'],
            },
            {
                command: 'logo',
                summary: 'Meminta file logo komunitas sebagai dokumen.',
                usage: 'logo',
                examples: ['logo'],
            },
            {
                command: 'codeflowchallenge',
                summary: 'Melihat info CodeFlow Challenge season 1.',
                usage: 'codeflowchallenge',
                examples: ['codeflowchallenge'],
            },
            {
                command: 'aspek penilaian',
                summary: 'Melihat aspek penilaian pemenang challenge.',
                usage: 'aspek penilaian',
                examples: ['aspek penilaian'],
            },
        ],
    },
    {
        title: 'Absen Anggota',
        access: 'Semua anggota',
        description: 'Command untuk mengisi kehadiran atau izin saat sesi absen dibuka.',
        commands: [
            {
                command: 'hadir',
                summary: 'Mencatat kehadiran. Wajib dikirim di grup.',
                usage: 'hadir',
                examples: ['hadir'],
                notes: ['Tidak bisa digunakan di private chat. Jika tidak hadir, gunakan `izin, alasan`.'],
            },
            {
                command: 'izin',
                summary: 'Mengajukan izin. Wajib menyertakan alasan.',
                usage: 'izin, <alasan>',
                examples: ['izin, sakit', 'izin ada urusan keluarga', 'izin | sedang di rumah sakit'],
                notes: ['Boleh dikirim di grup atau private chat bot. Alasan tidak boleh kosong.'],
            },
        ],
    },
    {
        title: 'Absen Admin Hadir',
        access: 'Khusus admin hadir',
        description: 'Command untuk membuat jadwal, membuka, menutup, dan mengoreksi absensi.',
        commands: [
            {
                command: 'buat jadwal',
                summary: 'Membuat jadwal absen dengan mode tanya-jawab.',
                usage: 'buat jadwal',
                examples: ['buat jadwal'],
            },
            {
                command: 'buat jadwal, tanggal, jam, nama',
                summary: 'Membuat jadwal absen sekali kirim.',
                usage: 'buat jadwal,<tanggal>,<jam mulai-jam tutup>,<nama>',
                examples: ['buat jadwal,21-05-2026,13.00-17.00,pertemuan ketiga'],
            },
            {
                command: 'jadwal absen',
                summary: 'Membuat jadwal dengan format pipa.',
                usage: 'jadwal absen | tanggal | jam | nama',
                examples: ['jadwal absen | 21-05-2026 | 13.00-17.00 | pertemuan ketiga'],
            },
            {
                command: 'liat jadwal',
                aliases: ['lihat jadwal'],
                summary: 'Melihat semua jadwal absen.',
                usage: 'liat jadwal',
                examples: ['liat jadwal'],
            },
            {
                command: 'ubah jadwal',
                summary: 'Mengubah tanggal, jam, close, atau nama jadwal.',
                usage: 'ubah jadwal,<nomor/nama>,<field>,<nilai>',
                examples: ['ubah jadwal,1,jam,13.00', 'ubah jadwal,1,close,17.00', 'ubah jadwal,1,nama,pertemuan 4'],
            },
            {
                command: 'hapus jadwal',
                summary: 'Menghapus jadwal absen.',
                usage: 'hapus jadwal,<nomor/nama>',
                examples: ['hapus jadwal,1'],
            },
            {
                command: 'jam absen',
                summary: 'Mengubah jam mulai sesi absen aktif/terjadwal.',
                usage: 'jam absen <jam>',
                examples: ['jam absen 13.00', 'jam absen,13.00'],
            },
            {
                command: 'close absen',
                summary: 'Mengatur jam tutup. Bot akan menutup absen otomatis saat jam ini lewat.',
                usage: 'close absen <jam>',
                examples: ['close absen 17.00', 'close absen,17.00'],
            },
            {
                command: 'buka absen',
                summary: 'Membuka sesi absen dan mengingatkan anggota.',
                usage: 'buka absen[,nama sesi]',
                examples: ['buka absen', 'buka absen,pertemuan 8'],
            },
            {
                command: 'tutup absen',
                summary: 'Menutup sesi absen secara manual.',
                usage: 'tutup absen',
                examples: ['tutup absen'],
            },
            {
                command: 'daftar hadir',
                summary: 'Melihat rekap hadir, izin, dan alpa.',
                usage: 'daftar hadir [tanggal]',
                examples: ['daftar hadir', 'daftar hadir 21-05-2026'],
            },
            {
                command: 'daftar izin',
                summary: 'Melihat rekap izin.',
                usage: 'daftar izin [tanggal]',
                examples: ['daftar izin', 'daftar izin 21-05-2026'],
            },
            {
                command: 'hapus hadir',
                summary: 'Menghapus data hadir/izin yang salah.',
                usage: 'hapus hadir <nama/npm/lid>',
                examples: ['hapus hadir Abyan'],
            },
        ],
    },
    {
        title: 'Dokumentasi Google Drive',
        access: 'Khusus admin dokumentasi',
        description: 'Command untuk membuat folder dokumentasi, upload file, dan membagikan link ke Discord.',
        commands: [
            {
                command: 'drive auth',
                summary: 'Membuat link login Google Drive.',
                usage: 'drive auth',
                examples: ['drive auth'],
            },
            {
                command: 'drive code',
                summary: 'Menyimpan kode login Google Drive.',
                usage: 'drive code <kode_google>',
                examples: ['drive code 4/0A...'],
            },
            {
                command: 'create folder',
                summary: 'Membuat folder dokumentasi baru.',
                usage: 'create folder "nama folder"',
                examples: ['create folder "pkkmb 2026"'],
            },
            {
                command: 'folder aktif',
                summary: 'Memilih folder tujuan upload dokumentasi.',
                usage: 'folder aktif "nama folder"',
                examples: ['folder aktif "pkkmb 2026"'],
            },
            {
                command: 'folder list',
                summary: 'Melihat daftar folder dokumentasi.',
                usage: 'folder list',
                examples: ['folder list'],
            },
            {
                command: 'remove folder',
                summary: 'Menghapus folder dari daftar dan Google Drive.',
                usage: 'remove folder "nama folder"',
                examples: ['remove folder "pkkmb 2026"'],
            },
            {
                command: 'upload dokumentasi',
                aliases: ['upload docs'],
                summary: 'Upload file/foto/video yang direply ke folder aktif.',
                usage: 'Reply file lalu kirim: upload dokumentasi',
                examples: ['upload dokumentasi', 'upload docs'],
                notes: ['Kirim dokumentasi sebagai dokumen agar kualitas tidak dikompres WhatsApp.'],
            },
            {
                command: 'share to discord',
                summary: 'Membagikan link folder dokumentasi ke channel Discord dokumentasi.',
                usage: 'share "nama folder" to discord',
                examples: ['share "pkkmb 2026" to discord'],
            },
            {
                command: 'ya / upload foto / upload video',
                summary: 'Konfirmasi upload batch di private chat admin dokumentasi.',
                usage: 'ya',
                examples: ['ya', 'upload foto', 'upload video'],
            },
            {
                command: 'reset',
                summary: 'Membatalkan antrian upload batch dokumentasi.',
                usage: 'reset',
                examples: ['reset'],
            },
        ],
    },
    {
        title: 'Pemateri dan Komunikasi',
        access: 'Anggota, admin komunikasi, admin pemateri',
        description: 'Command untuk melihat jadwal pemateri dan mengatur/menyebarkan materi.',
        commands: [
            {
                command: 'pemateri <angka>',
                summary: 'Admin komunikasi mention pemateri pertemuan tertentu.',
                usage: 'pemateri <nomor pertemuan>',
                examples: ['pemateri 2'],
            },
            {
                command: 'kirim to pertemuan',
                summary: 'Meneruskan pesan/file yang direply ke pemateri pertemuan tertentu.',
                usage: 'kirim to pertemuan <nomor>',
                examples: ['kirim to pertemuan 2'],
            },
            {
                command: 'pemateri <angka>, kirim pesan',
                summary: 'Gabungan mention dan kirim pesan dalam satu command.',
                usage: 'pemateri <nomor>, kirim pesan',
                examples: ['pemateri 2, kirim pesan'],
            },
            {
                command: 'ingatkan pemateri',
                summary: 'Mengirim pengingat private ke pemateri pertemuan tertentu.',
                usage: 'ingatkan pemateri <nomor>',
                examples: ['ingatkan pemateri 6'],
            },
            {
                command: 'remove',
                summary: 'Admin pemateri menghapus nama dari jadwal pemateri.',
                usage: 'remove <nama>',
                examples: ['remove Jamal'],
            },
            {
                command: 'change',
                summary: 'Admin pemateri memindahkan pemateri ke pertemuan dan line tertentu.',
                usage: 'change "nama" to pertemuan <nomor> line <line>',
                examples: ['change "Abyan Ihza Pradipta" to pertemuan 6 line 1'],
            },
            {
                command: 'add to pertemuan',
                summary: 'Admin pemateri menambahkan nama ke jadwal pemateri.',
                usage: 'add "nama" to pertemuan <nomor> line <line>',
                examples: ['add "Jamal" to pertemuan 10 line 3'],
            },
        ],
    },
    {
        title: 'AI Yanverse',
        access: 'Anggota, admin grup, owner',
        description: 'Command untuk AI assistant Yanverse dan pengaturan memory.',
        commands: [
            {
                command: 'yanverse, <pertanyaan>',
                summary: 'Bertanya ke AI di grup.',
                usage: 'yanverse, <pertanyaan>',
                examples: ['yanverse, jelaskan HTML untuk pemula'],
            },
            {
                command: '.ai on',
                summary: 'Mengaktifkan AI di grup/private.',
                usage: '.ai on',
                examples: ['.ai on'],
                notes: ['Di grup hanya admin grup atau owner.'],
            },
            {
                command: '.ai off',
                summary: 'Mematikan AI di grup/private.',
                usage: '.ai off',
                examples: ['.ai off'],
                notes: ['Di grup hanya admin grup atau owner.'],
            },
            {
                command: '.ai memory clear',
                summary: 'Menghapus memory percakapan AI di chat tersebut.',
                usage: '.ai memory clear',
                examples: ['.ai memory clear'],
            },
        ],
    },
    {
        title: 'Kas, Infokus, Knowledge, dan Status',
        access: 'Khusus admin grup atau owner',
        description: 'Command administrasi berbasis Google Sheets, knowledge base, dan status bot.',
        commands: [
            {
                command: '.kas utama',
                summary: 'Melihat saldo dan transaksi kas utama.',
                usage: '.kas utama',
                examples: ['.kas utama'],
            },
            {
                command: '.kas belum bayar',
                summary: 'Melihat anggota yang belum bayar kas.',
                usage: '.kas belum bayar',
                examples: ['.kas belum bayar'],
            },
            {
                command: '.kas status',
                summary: 'Melihat status kas anggota tertentu.',
                usage: '.kas status <nama>',
                examples: ['.kas status Abyan'],
            },
            {
                command: '.kas rekap',
                summary: 'Melihat rekap kas anggota semua minggu.',
                usage: '.kas rekap',
                examples: ['.kas rekap'],
            },
            {
                command: '.kas rekap minggu',
                summary: 'Melihat rekap kas minggu tertentu.',
                usage: '.kas rekap minggu <angka>',
                examples: ['.kas rekap minggu 4'],
            },
            {
                command: '.infokus',
                summary: 'Melihat status inventaris infokus.',
                usage: '.infokus',
                examples: ['.infokus'],
            },
            {
                command: '.infokus aktif',
                summary: 'Melihat peminjaman infokus yang masih aktif.',
                usage: '.infokus aktif',
                examples: ['.infokus aktif'],
            },
            {
                command: '.infokus riwayat',
                summary: 'Melihat riwayat peminjaman/pengembalian infokus.',
                usage: '.infokus riwayat',
                examples: ['.infokus riwayat'],
            },
            {
                command: '.knowledge stats',
                summary: 'Melihat statistik knowledge base.',
                usage: '.knowledge stats',
                examples: ['.knowledge stats'],
            },
            {
                command: '.knowledge search',
                summary: 'Mencari isi knowledge base.',
                usage: '.knowledge search <keyword>',
                examples: ['.knowledge search medig'],
            },
            {
                command: '.bot status',
                summary: 'Melihat health check bot.',
                usage: '.bot status',
                examples: ['.bot status'],
            },
            {
                command: 'cek lid',
                summary: 'Mengecek LID WhatsApp user yang ditag.',
                usage: 'cek lid @anggota',
                examples: ['cek lid @anggota'],
            },
        ],
    },
    {
        title: 'Fun',
        access: 'Semua anggota',
        description: 'Command hiburan ringan.',
        commands: [
            {
                command: 'sirpai',
                summary: 'Mengirim foto sir-pai ke target yang ditag.',
                usage: 'sirpai @target',
                examples: ['sirpai @teman'],
                notes: ['Di private chat, targetnya adalah pengirim sendiri. Ada cooldown.'],
            },
            {
                command: 'upin ipin',
                summary: 'Command fun mention nomor tertentu.',
                usage: 'upin ipin',
                examples: ['upin ipin'],
            },
            {
                command: 'min ukm di um apa aja ni?',
                summary: 'Melihat daftar UKM.',
                usage: 'min ukm di um apa aja ni?',
                examples: ['min ukm di um apa aja ni?'],
            },
        ],
    },
];

function getCommandCategories() {
    return COMMAND_CATEGORIES;
}

function formatCommandMenu() {
    const lines = [
        '*Menu Lengkap Bot CodeFlow*',
        '',
        'Command sudah difilter berdasarkan kategori dan akses.',
        'Ketik *command* untuk menerima PDF panduan lengkap.',
        '',
    ];

    COMMAND_CATEGORIES.forEach((category, categoryIndex) => {
        lines.push(`*${categoryIndex + 1}. ${category.title}*`);
        lines.push(`Akses: ${category.access}`);
        category.commands.forEach((item) => {
            lines.push(`>>${item.command} - ${item.summary}`);
        });
        lines.push('');
    });

    return lines.join('\n').trim();
}

function getCommandGuideFileName() {
    return 'Panduan-Command-CodeFlow-Bot.pdf';
}

module.exports = {
    getCommandCategories,
    formatCommandMenu,
    getCommandGuideFileName,
};
