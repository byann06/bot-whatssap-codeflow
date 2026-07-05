const { formatCommandMenu } = require('./commandCatalog');

const MENU_TEXT = formatCommandMenu();

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
👉 https://discord.gg/jzYhNDCU
📌 Diskusi, sharing, main game bareng, dan interaksi antaar anggota.

🎵 *TikTok*
👉 https://www.tiktok.com/@codeflowcom
📌 Tips dan dokumentasi kegiatan dalam bentuk video.

📸 *Instagram*
👉 https://www.instagram.com/codeflowcom
📌 Publikasi kegiatan dan dokumentasi visual komunitas.

📚 *Materi Pembelajaran*
👉 https://drive.google.com/drive/folders/1psnS1liARk9BaTSyGDdHH70YGkC6aG0F?usp=drive_link
📌 Materi pembelajaran mingguan.

📊 *Laporan Kas*
👉 _(segera hadir)_
📌 Pemasukan dan pengeluaran kas komunitas secara transparan.
`;

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

module.exports = {
    MENU_TEXT,
    LINK_KOMUNITAS,
    INFO_TEMPLATE,
    CODEFLOW_CHALLENGE_TEXT,
    ASPEK_PENILAIAN_TEXT,
    REGISTER_TEMPLATE,
};
