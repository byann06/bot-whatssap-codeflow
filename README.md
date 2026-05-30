# Yanverse - Code Flow Community WhatsApp Bot

Yanverse adalah bot WhatsApp untuk Code Flow Community yang menggabungkan command organisasi, AI assistant, knowledge base, administrasi Google Sheets, persistent memory, sistem maintenance, help command, dan health check sistem.

Project ini dibuat untuk membantu kebutuhan komunitas seperti absensi, dokumentasi, kas, inventaris infokus, knowledge organisasi, serta bantuan AI untuk anggota dan pengurus.

---

## Status Project

Project berjalan sebagai aplikasi Node.js CommonJS dengan entry point:

```txt
index.js
```

Package saat ini memakai nama:

```txt
whatssap-web
```

Fitur utama yang sudah tersedia:

- WhatsApp bot berbasis Baileys
- Command organisasi Code Flow Community
- Yanverse AI Assistant
- Multi-provider AI dengan fallback
- Knowledge base lokal berbasis markdown
- Google Sheets read-only untuk administrasi kas dan infokus
- Persistent memory berbasis SQLite
- Maintenance summary system
- Bot health check
- Help command per segmen
- Security notes dan backup notes

---

## Deskripsi Singkat

Yanverse membantu pengurus dan anggota Code Flow Community lewat WhatsApp. Bot ini dapat menjalankan command deterministic untuk kebutuhan organisasi, membaca knowledge base komunitas, menjawab pertanyaan lewat AI, membaca data administrasi dari Google Sheets secara read-only, serta menyimpan memory percakapan AI secara terbatas di SQLite.

Prinsip utama project ini:

- Command penting tetap deterministic dan tidak bergantung AI.
- Data administrasi Google Sheets hanya read-only.
- Secret, credential, database, dan session WhatsApp tidak boleh masuk Git.
- AI dipakai sebagai assistant, bukan pengganti kontrol admin.
- Fitur besar dikembangkan bertahap agar flow lama tetap aman.

---

## Fitur Utama

### WhatsApp Bot Berbasis Baileys

Bot memakai Baileys untuk terhubung ke WhatsApp. Bot dapat menerima pesan grup/private, membaca command, membalas pesan, dan menjalankan fitur organisasi Code Flow.

Fitur command lama tetap berjalan lewat handler utama, sementara fitur baru dipisahkan ke handler/service agar project lebih scalable.

### Yanverse AI Assistant

Yanverse adalah AI Assistant untuk Code Flow Community. Karakternya dibuat santai, teknikal seperlunya, membantu step-by-step, realistis, tidak terlalu formal, tidak toxic, tidak sok tahu, dan terasa seperti bagian dari komunitas.

Di grup, AI tidak membalas semua chat. AI hanya aktif jika:

1. AI sudah diaktifkan di grup dengan `.ai on`
2. Pesan diawali trigger grup

Trigger default:

```txt
yanverse,
```

Contoh:

```txt
yanverse, kamu siapa?
yanverse, jelaskan apa itu JavaScript
yanverse, command kas rekap dipakai gimana?
```

Di private chat, jika AI aktif, Yanverse bisa membalas tanpa trigger grup.

### Multi-Provider AI

Yanverse mendukung beberapa provider AI:

- Gemini
- Groq
- OpenRouter

Provider utama ditentukan lewat env `AI_PROVIDER`. Jika provider utama gagal karena quota, rate limit, atau API error, sistem akan mencoba provider fallback sesuai urutan `AI_FALLBACK_PROVIDERS`.

Contoh log server:

```txt
[AI] gemini gagal, fallback ke groq
[AI] provider=groq
```

`aiMessageHandler` tetap memanggil `aiService.generateReply()`, sehingga handler tidak perlu tahu provider mana yang sedang dipakai.

### Persona Yanverse

Persona Yanverse disimpan terpusat agar mudah diubah tanpa menyentuh banyak file. Persona mengatur gaya bicara, batasan, identitas, dan cara Yanverse menjawab pertanyaan.

Jika ingin menyesuaikan karakter Yanverse, cek file persona di module AI, lalu ubah prompt/persona dengan tetap menjaga batasan keamanan dan gaya komunitas.

### AI Settings

Command AI utama:

```txt
.ai on
.ai off
.ai memory clear
```

Di grup, `.ai on` dan `.ai off` hanya bisa dijalankan admin grup atau owner. Di private chat, user bisa mengaktifkan atau mematikan AI untuk chat pribadi.

### Persistent Memory SQLite

Memory Yanverse disimpan di SQLite agar tidak hilang saat bot restart. Memory tetap dibatasi agar tidak boros token.

Table yang digunakan:

```txt
ai_messages
```

Memory menyimpan history per chat dengan batas:

- `AI_MEMORY_MAX_MESSAGES`
- `AI_MEMORY_MAX_CHARS`

Jika SQLite error, service berusaha fallback agar bot tidak crash.

Command untuk membersihkan memory chat:

```txt
.ai memory clear
```

Akses:

- Grup: admin grup atau owner
- Private chat: user dapat membersihkan memory chat pribadinya

Catatan: data admin context seperti kas dan infokus tidak perlu disimpan mentah ke memory jangka panjang.

### Knowledge Base Markdown

Knowledge base disimpan di folder:

```txt
knowledge/
```

Isi knowledge dipakai agar Yanverse memahami konteks Code Flow Community, aturan, struktur, divisi, FAQ, command bot, dan kultur internal.

### Knowledge Retrieval

Yanverse tidak mengirim semua knowledge ke AI setiap kali menjawab. Sistem retrieval akan:

1. Membaca pertanyaan user
2. Mengambil keyword penting
3. Mencari section markdown yang relevan
4. Mengirim context yang cocok ke AI
5. Membatasi panjang context agar hemat token

Contoh log server:

```txt
[KNOWLEDGE] sections=commands/attendance.md#buka absen, faq.md#Cara mengaktifkan AI?
[KNOWLEDGE] no relevant context
```

### Knowledge Stats dan Search

Admin/owner dapat mengecek status knowledge base dari WhatsApp:

```txt
.knowledge stats
.knowledge search <keyword>
```

`.knowledge stats` menampilkan jumlah file, jumlah section, jumlah file command, jumlah file knowledge umum, kategori, dan status retrieval.

`.knowledge search <keyword>` mencari keyword di path file, heading, dan isi section, lalu menampilkan hasil ringkas tanpa membocorkan isi knowledge terlalu panjang.

### Google Sheets Read-Only

Yanverse memiliki integrasi Google Sheets untuk administrasi CFC secara read-only.

Data yang dibaca:

- Kas utama
- Kas anggota
- Inventaris/peminjaman infokus

Bot tidak mengedit, menghapus, atau menulis ke spreadsheet.

### Command Kas

Command kas hanya untuk admin grup atau owner.

```txt
.kas utama
.kas belum bayar
.kas status <nama>
.kas rekap
.kas rekap minggu <angka>
```

Fungsi ringkas:

- `.kas utama`: menampilkan saldo/total kas utama dan transaksi terakhir
- `.kas belum bayar`: menampilkan anggota yang belum lunas
- `.kas status <nama>`: mengecek status kas anggota tertentu
- `.kas rekap`: rekap kas anggota dari semua tab minggu
- `.kas rekap minggu <angka>`: detail rekap kas minggu tertentu dan daftar belum lunas

### Auto-Discover Tab Kas Anggota

Bot dapat mendeteksi tab kas anggota otomatis dari Google Sheets.

Nama tab yang didukung:

```txt
KAS ANGGOTA MINGGU <angka>
MINGGU <angka>
```

Contoh:

```txt
KAS ANGGOTA MINGGU 1
KAS ANGGOTA MINGGU 2
MINGGU 5
```

Jika bendahara menambahkan tab baru seperti `MINGGU 6`, bot bisa ikut membaca tanpa perlu hardcode range baru, selama nama tab sesuai pola.

### Command Infokus

Command infokus hanya untuk admin grup atau owner.

```txt
.infokus
.infokus aktif
.infokus riwayat
```

Fungsi ringkas:

- `.infokus`: menampilkan status infokus saat ini
- `.infokus aktif`: menampilkan peminjaman aktif/belum dikembalikan
- `.infokus riwayat`: menampilkan riwayat terakhir peminjaman/pengembalian, dibatasi agar tidak panjang

### Auto-Discover Tab Infokus

Bot dapat mendeteksi tab infokus otomatis berdasarkan nama tab yang mengandung kata:

- peminjaman
- pengembalian
- infokus
- inventaris
- riwayat

Jika auto-discover gagal, sistem fallback ke env `GOOGLE_SHEETS_INVENTORY_RANGES`. Jika masih kosong, sistem memakai fallback range default.

### Admin Context Read-Only untuk Yanverse

Yanverse dapat menjawab pertanyaan admin tentang kas dan infokus dengan mengambil context ringkas dari Google Sheets.

Contoh:

```txt
yanverse, saldo kas utama sekarang berapa?
yanverse, siapa aja yang belum bayar kas?
yanverse, siapa yang belum lunas minggu 4?
yanverse, status kas Abyan gimana?
yanverse, infokus lagi dipinjam siapa?
yanverse, riwayat infokus terakhir apa?
```

Akses data admin context:

- Grup: admin grup atau owner
- Private chat: owner

Jika user tidak punya akses, data administrasi tidak diinject ke AI.

Contoh log server:

```txt
[ADMIN_CONTEXT] type=kas_utama access=allowed
[ADMIN_CONTEXT] type=kas access=denied
```

### Maintenance Summary

Maintenance summary disimpan di:

```txt
data/maintenance.json
```

Contoh format aman:

```json
{
  "enabled": true,
  "version": "v2.0.0",
  "summary": [
    "Menambahkan Google Sheets integration read-only untuk administrasi CFC",
    "Menambahkan persistent memory Yanverse berbasis SQLite",
    "Menambahkan command .bot status untuk health check sistem"
  ]
}
```

Saat bot masuk maintenance atau hidup kembali, bot dapat mengirim pesan maintenance ke grup notice yang dikonfigurasi.

### Bot Status

Command:

```txt
.bot status
```

Menampilkan health check ringkas:

- AI provider utama
- fallback provider
- status API key tersedia atau belum
- status SQLite
- status table memory `ai_messages`
- statistik knowledge
- konfigurasi Google Sheets
- uptime
- Node.js version
- memory usage

Command ini hanya untuk admin/owner.

### Help Per Segmen

Command utama:

```txt
.help
```

Help per segmen:

```txt
.help umum
.help daftar
.help ai
.help absen
.help sesi
.help drive
.help kas
.help infokus
.help knowledge
.help bot
.help admin
```

Alias yang tersedia dapat mencakup topik seperti jadwal, absensi, dokumentasi, Yanverse, dan pengurus.

### Security dan Backup Notes

Project memiliki catatan keamanan dan backup:

```txt
SECURITY_NOTES.md
BACKUP_NOTES.md
```

Baca dua file tersebut sebelum deploy, commit, share project, atau pindah VPS.

---

## Struktur Folder

Struktur utama project:

```txt
whatssap-web/
├── assets/
├── config/
├── credentials/
├── data/
├── data_EXAMPLE/
├── docs/
├── handlers/
├── infrastructure/
├── knowledge/
├── lib/
├── parsers/
├── repositories/
├── services/
├── .env
├── .env.example
├── .gitignore
├── index.js
├── package.json
├── package-lock.json
├── SECURITY_NOTES.md
└── BACKUP_NOTES.md
```

Penjelasan folder/file:

- `config/`: konfigurasi project dari environment variable.
- `handlers/`: handler command dan handler message seperti AI, knowledge, kas, infokus, help, dan status bot.
- `services/`: service domain seperti AI, memory, Google Sheets, knowledge, attendance, maintenance, dan notification.
- `parsers/`: parser command agar input user lebih mudah diproses.
- `infrastructure/`: layer teknis seperti database SQLite.
- `knowledge/`: knowledge base markdown untuk Yanverse.
- `data/`: data runtime seperti SQLite, maintenance config, dan file JSON runtime. Folder ini tidak boleh masuk Git.
- `data_EXAMPLE/`: contoh data aman jika tersedia.
- `credentials/`: credential Google/API lokal. Folder ini tidak boleh masuk Git.
- `assets/`: asset bot seperti gambar atau media pendukung.
- `docs/`: dokumentasi tambahan jika tersedia.
- `repositories/`: layer akses data jika dipakai oleh fitur tertentu.
- `index.js`: entry point bot.
- `.env.example`: template environment variable aman.
- `SECURITY_NOTES.md`: catatan keamanan.
- `BACKUP_NOTES.md`: catatan backup dan restore.

---

## Knowledge Base

Knowledge base berada di folder:

```txt
knowledge/
```

Struktur knowledge saat ini:

```txt
knowledge/
├── commands/
│   ├── ai.md
│   ├── attendance.md
│   ├── drive.md
│   └── general.md
├── about_codeflow.md
├── ad_art.md
├── bot_philosophy.md
├── communication_style.md
├── community_values.md
├── divisions.md
├── events.md
├── faq.md
├── internal_culture.md
├── learning_system.md
├── organization_goals.md
├── project_guidelines.md
├── rules.md
└── structure.md
```

Peran file knowledge:

- `commands/ai.md`: dokumentasi command AI.
- `commands/attendance.md`: dokumentasi command absensi/kehadiran.
- `commands/drive.md`: dokumentasi command dokumentasi/Google Drive.
- `commands/general.md`: dokumentasi command umum.
- `about_codeflow.md`: pengenalan Code Flow Community.
- `ad_art.md`: aturan dasar/AD ART komunitas.
- `rules.md`: aturan komunitas.
- `faq.md`: pertanyaan umum.
- `structure.md`: struktur organisasi.
- `divisions.md`: informasi divisi.
- `events.md`: informasi kegiatan.
- `learning_system.md`: sistem pembelajaran.
- `internal_culture.md`: budaya internal.
- `community_values.md`: nilai komunitas.
- `organization_goals.md`: tujuan organisasi.
- `project_guidelines.md`: panduan project.
- `bot_philosophy.md`: filosofi bot.
- `communication_style.md`: gaya komunikasi.

---

## Command Penting

### AI

```txt
.ai on
.ai off
.ai memory clear
yanverse, <pertanyaan>
```

Keterangan:

- `.ai on`: mengaktifkan AI untuk grup/user.
- `.ai off`: menonaktifkan AI untuk grup/user.
- `.ai memory clear`: membersihkan memory AI untuk chat tersebut.
- `yanverse, <pertanyaan>`: memanggil Yanverse di grup saat AI aktif.

### Knowledge

```txt
.knowledge stats
.knowledge search <keyword>
```

Keterangan:

- `.knowledge stats`: cek statistik knowledge base.
- `.knowledge search <keyword>`: cari section knowledge dari WhatsApp.

### Kas

```txt
.kas utama
.kas belum bayar
.kas status <nama>
.kas rekap
.kas rekap minggu <angka>
```

Keterangan:

- `.kas utama`: cek saldo dan transaksi kas utama.
- `.kas belum bayar`: cek anggota yang belum lunas.
- `.kas status <nama>`: cek status kas berdasarkan nama anggota.
- `.kas rekap`: cek rekap kas semua minggu.
- `.kas rekap minggu <angka>`: cek detail minggu tertentu.

### Infokus

```txt
.infokus
.infokus aktif
.infokus riwayat
```

Keterangan:

- `.infokus`: cek status infokus saat ini.
- `.infokus aktif`: cek peminjaman aktif.
- `.infokus riwayat`: cek riwayat terakhir.

### Bot

```txt
.bot status
.help
.help ai
.help kas
.help infokus
.help knowledge
.help admin
```

Keterangan:

- `.bot status`: cek health check sistem.
- `.help`: tampilkan help utama.
- `.help <segmen>`: tampilkan help sesuai segmen.

---

## Environment Variables

Buat file `.env` berdasarkan `.env.example`.

Jangan commit `.env` asli. Contoh di bawah memakai placeholder aman, bukan value asli.

### AI Provider

```env
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDERS=groq,openrouter

GEMINI_API_KEY=isi_gemini_api_key_di_env_lokal
GEMINI_MODEL=gemini-2.5-flash

GROQ_API_KEY=isi_groq_api_key_di_env_lokal
GROQ_MODEL=llama-3.3-70b-versatile

OPENROUTER_API_KEY=isi_openrouter_api_key_di_env_lokal
OPENROUTER_MODEL=openrouter/free
```

### AI Settings

```env
AI_GROUP_TRIGGER_WORD=yanverse,
AI_REPLY_COOLDOWN_MS=5000
AI_MEMORY_MAX_MESSAGES=10
AI_MEMORY_MAX_CHARS=1000
AI_KNOWLEDGE_MAX_CONTEXT_CHARS=3500
AI_KNOWLEDGE_MAX_SECTIONS=5
DATABASE_PATH=data/bot.sqlite
```

### Google Drive

```env
GOOGLE_DRIVE_PARENT_FOLDER_ID=isi_folder_id_google_drive
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/google-drive-credentials.json
GOOGLE_DRIVE_TOKEN_PATH=credentials/google-drive-token.json
```

### Google Sheets

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=credentials/google-sheets-service-account.json
GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID=isi_spreadsheet_id_kas
GOOGLE_SHEETS_MAIN_CASH_RANGE='KAS UTAMA'!A:Z
GOOGLE_SHEETS_MEMBER_CASH_RANGES='KAS ANGGOTA MINGGU 1'!A:Z,'MINGGU 5'!A:Z
GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID=isi_spreadsheet_id_infokus
GOOGLE_SHEETS_INVENTORY_RANGES='PEMINJAMAN'!A:Z,'PENGEMBALIAN'!A:Z
```

Catatan:

- Kas anggota dan infokus sudah mendukung auto-discover tab.
- Env ranges tetap berguna sebagai fallback jika auto-discover gagal.
- Jangan isi README dengan spreadsheet ID asli jika dianggap sensitif.

### Bridge Internal

```env
BRIDGE_INTERNAL_URL=http://127.0.0.1:PORT_PLACEHOLDER
BRIDGE_INTERNAL_SECRET=isi_secret_random_di_env_lokal
```

### Admin dan Permission

```env
ADMIN_LID=lid_admin_utama
HADIR_LID=lid_admin_hadir
DOKUMENTASI_LID=lid_admin_dokumentasi
KOMUNIKASI_LID=lid_admin_komunikasi
PEMATERI_LID=lid_admin_pemateri
```

### Bot Runtime

```env
PAIRING_NUMBER=nomor_pairing_opsional
BOT_MAX_MESSAGE_AGE_SECONDS=120
BOT_NOTICE_GROUP_ID=jid_grup_notice_opsional
ABSEN_REMINDER_MINUTES=30
```

---

## Instalasi

Install dependency untuk development:

```bash
npm install
```

Untuk production/VPS, lebih disarankan:

```bash
npm ci --omit=dev
```

Pastikan Node.js sudah tersedia di server. Project memakai CommonJS dan dependency utama seperti Baileys, Google APIs, dotenv, better-sqlite3, dan provider AI.

---

## Menjalankan Bot

Jalankan mode lokal:

```bash
node index.js
```

Jika memakai PM2:

```bash
pm2 start index.js --name codeflow-bot
```

Restart bot:

```bash
pm2 restart codeflow-bot
```

Lihat log:

```bash
pm2 logs codeflow-bot
```

---

## Setup Google Sheets

Google Sheets digunakan untuk data administrasi seperti kas utama, kas anggota, dan infokus. Integrasi ini read-only.

Langkah ringkas:

1. Buka Google Cloud Console.
2. Buat project atau gunakan project yang sudah ada.
3. Enable Google Sheets API.
4. Buat Service Account.
5. Download JSON key service account.
6. Simpan file JSON ke:

```txt
credentials/google-sheets-service-account.json
```

7. Buka spreadsheet target.
8. Share spreadsheet ke `client_email` dari service account sebagai Viewer.
9. Ambil Spreadsheet ID dari URL:

```txt
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

10. Isi `.env`:

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=credentials/google-sheets-service-account.json
GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID=isi_spreadsheet_id_kas
GOOGLE_SHEETS_INVENTORY_SPREADSHEET_ID=isi_spreadsheet_id_infokus
```

11. Jalankan bot dan test:

```txt
.kas utama
.kas rekap
.infokus
```

Jika gagal membaca data, cek:

- Service account sudah di-share ke spreadsheet sebagai Viewer.
- Spreadsheet ID benar.
- Nama tab sesuai pola atau env range benar.
- Path credential benar.

---

## Setup Google Drive

Google Drive digunakan untuk fitur dokumentasi/upload file jika fitur tersebut diaktifkan.

Langkah ringkas:

1. Enable Google Drive API di Google Cloud Console.
2. Siapkan credential Google Drive.
3. Simpan credential/token di folder `credentials/`.
4. Isi `.env`:

```env
GOOGLE_DRIVE_PARENT_FOLDER_ID=isi_folder_id_google_drive
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/google-drive-credentials.json
GOOGLE_DRIVE_TOKEN_PATH=credentials/google-drive-token.json
```

5. Pastikan folder tujuan Drive bisa diakses oleh credential yang digunakan.

Jangan commit credential atau token Google Drive.

---

## Security

File/folder berikut tidak boleh masuk Git, zip publik, Discord publik, atau repository publik:

```txt
.env
credentials/
data/
.baileys_auth/
baileys_auth/
auth/
session/
sessions/
*.sqlite
*.db
google-drive-token.json
google-sheets-service-account.json
logs/
*.log
node_modules/
```

Alasannya:

- `.env` berisi API key, token, secret, ID admin, dan config private.
- `credentials/` berisi Google credential/token.
- `data/` bisa berisi database, data anggota, absensi, maintenance, dan SQLite.
- `.baileys_auth/` atau folder session lain berisi session WhatsApp.
- `logs/` dan `*.log` bisa berisi potongan pesan atau error runtime.
- `node_modules/` tidak perlu diupload karena bisa diinstall ulang.

Jika file sensitif terlanjur tracked Git:

```bash
git rm --cached <file>
```

Setelah itu, rotasi secret/token yang pernah bocor.

Baca juga:

```txt
SECURITY_NOTES.md
BACKUP_NOTES.md
```

---

## Backup

File/folder yang wajib dibackup secara private:

```txt
.env
credentials/
data/
.baileys_auth/
baileys_auth/
auth/
session/
sessions/
```

Saran backup:

1. Matikan bot dulu agar database dan session tidak sedang ditulis.
2. Backup `.env`, `credentials/`, `data/`, dan session WhatsApp.
3. Simpan backup di storage privat.
4. Jangan upload backup penuh ke publik.
5. Jangan backup `node_modules/`; install ulang dengan `npm ci --omit=dev`.

---

## Testing Manual

Setelah deploy atau update fitur, test command berikut:

```txt
.bot status
.help
.knowledge stats
.knowledge search medig
.kas utama
.kas rekap
.kas rekap minggu 4
.infokus
.infokus aktif
.infokus riwayat
.ai on
yanverse, kamu siapa?
yanverse, saldo kas utama sekarang berapa?
.ai memory clear
```

Expected umum:

- `.bot status` menampilkan status AI, SQLite, knowledge, Google Sheets config, dan runtime.
- `.help` menampilkan daftar segmen bantuan.
- `.knowledge stats` menampilkan statistik knowledge base.
- `.knowledge search medig` menampilkan hasil knowledge relevan jika ada.
- `.kas utama` dan `.kas rekap` hanya bisa diakses admin/owner.
- `.infokus` hanya bisa diakses admin/owner.
- `.ai on` mengaktifkan AI untuk chat/grup sesuai permission.
- `yanverse, kamu siapa?` dijawab dengan identitas Yanverse.
- `.ai memory clear` membersihkan memory chat tersebut.

Test akses non-admin untuk data administrasi:

```txt
yanverse, saldo kas utama sekarang berapa?
```

Expected:

```txt
Data administrasi hanya bisa diakses admin/pengurus.
```

Kalimat final bisa berbeda mengikuti persona, tapi data kas/infokus tidak boleh diberikan ke user tanpa akses.

---

## Roadmap

Rencana pengembangan berikutnya:

- Testing arc untuk semua command penting.
- Refactor `handlers/menu.js` agar lebih modular.
- Tool calling ringan untuk aksi tertentu.
- Dashboard monitoring.
- Better memory quality.
- Permission system lebih detail.
- Command audit otomatis.
- Validasi data admin yang lebih rapi.
- Dokumentasi onboarding untuk pengurus baru.

---

## Catatan Developer

Project ini berkembang dari bot command sederhana menjadi assistant organisasi untuk Code Flow Community. Karena itu, perubahan besar sebaiknya dilakukan bertahap.

Rekomendasi saat menambah fitur:

- Jangan ubah flow lama secara brutal.
- Pisahkan handler, parser, dan service jika fitur mulai besar.
- Jangan hardcode secret/API key di source code.
- Pastikan fitur admin punya permission check.
- Command yang menyentuh data organisasi sebaiknya deterministic.
- AI boleh membantu menjelaskan, tapi data write/edit harus dikontrol ketat.
- Jalankan `node --check` untuk file JS yang diubah.

---

## License

Project ini digunakan untuk kebutuhan internal Code Flow Community.

Jangan membagikan source code penuh ke publik jika masih berisi credential, session WhatsApp, database, `.env`, atau file runtime sensitif.