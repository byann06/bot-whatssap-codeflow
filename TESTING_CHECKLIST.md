# Yanverse Testing Checklist

Checklist ini dipakai sebelum deploy atau setelah update besar pada bot Code Flow / Yanverse. Fokusnya memastikan fitur utama masih hidup tanpa membuka data sensitif ke publik.

Gunakan checklist ini di environment testing atau grup testing dulu sebelum production.

---

## 0. Persiapan

- [ ] Pastikan `.env` sudah terisi di server/lokal dan tidak dikirim ke Git.
- [ ] Pastikan `credentials/` tersedia jika ingin test Google Sheets/Drive.
- [ ] Pastikan `data/` tersedia jika ingin test memory, attendance, dan data runtime lama.
- [ ] Pastikan session WhatsApp berada di folder auth/session yang benar.
- [ ] Jalankan smoke test lokal:

```bash
npm run smoke:test
```

Expected:

- Tidak ada API eksternal yang terpanggil.
- Tidak ada secret/token yang tampil di console.
- Output berisi PASS/WARN/FAIL ringkas.

---

## 1. Bot Basic

### 1.1 Start Bot

- [ ] Jalankan:

```bash
node index.js
```

Expected:

- Bot start tanpa error fatal.
- Jika session belum ada, QR/pairing muncul dengan normal.
- Jika session sudah ada, bot reconnect tanpa meminta QR baru.

### 1.2 QR/Session WhatsApp Aman

- [ ] Pastikan folder session/auth WhatsApp tidak ikut Git.
- [ ] Pastikan session tidak dishare ke grup publik.
- [ ] Restart bot sekali.

Expected:

- Bot tetap login jika session valid.
- Tidak ada session credential yang tampil di chat user.

### 1.3 Help Utama

Input:

```txt
.help
```

Expected:

- Bot menampilkan help utama.
- Daftar segmen help muncul, misalnya AI, kas, infokus, knowledge, admin, bot.

### 1.4 Bot Status

Input:

```txt
.bot status
```

Expected:

- Admin/owner mendapatkan status AI, SQLite, knowledge, Google Sheets config, uptime, Node version, dan memory usage.
- Non-admin di grup ditolak.
- Tidak ada API key/token/credential yang tampil.

---

## 2. AI

### 2.1 Aktifkan AI

Input admin grup:

```txt
.ai on
```

Expected:

- Bot mengaktifkan AI untuk grup.
- Status tersimpan di SQLite.

### 2.2 Nonaktifkan AI

Input admin grup:

```txt
.ai off
```

Expected:

- Bot menonaktifkan AI untuk grup.
- Setelah off, pesan trigger AI tidak dibalas.

### 2.3 Identitas Yanverse

Input setelah `.ai on`:

```txt
yanverse, kamu siapa?
```

Expected:

- Yanverse menjawab sebagai AI Assistant Code Flow Community.
- Gaya bahasa santai, membantu, tidak terlalu formal.

### 2.4 Trigger Grup

Input di grup saat AI aktif:

```txt
halo bot
```

Expected:

- AI diam karena tidak ada trigger.

Input:

```txt
yanverse, halo bot
```

Expected:

- AI membalas.
- Kata trigger `yanverse,` tidak ikut dianggap sebagai isi prompt utama.

### 2.5 Cooldown

Input:

```txt
yanverse, test 1
yanverse, test 2
```

Kirim sangat cepat dalam satu chat.

Expected:

- Bot tidak spam reply.
- Salah satu request bisa diskip/ditahan sesuai cooldown.

### 2.6 Provider Fallback

Setup testing:

- [ ] Isi provider utama dengan API key invalid atau kosong di environment testing.
- [ ] Isi fallback provider dengan API key valid.

Input:

```txt
yanverse, jelaskan closure secara singkat
```

Expected:

- Bot mencoba provider utama.
- Jika gagal, bot fallback ke provider berikutnya.
- Console menampilkan log seperti:

```txt
[AI] gemini gagal, fallback ke groq
[AI] provider=groq
```

Catatan: jangan test fallback terlalu sering agar quota hemat.

### 2.7 Persona Tidak Memakai Sapaan Terlarang

Input:

```txt
yanverse, kasih motivasi belajar coding
```

Expected:

- Jawaban tidak memakai sapaan seperti `bro`, `sis`, `bang`, `kak`, `dek`, atau `bos`.
- Jawaban tetap santai dan tidak toxic.

---

## 3. Persistent Memory

### 3.1 Simpan Memory

Input:

```txt
yanverse, ingat namaku Abyan Testing
```

Expected:

- Yanverse merespons bahwa informasi dipahami.
- Pesan user dan assistant tersimpan di SQLite table `ai_messages`.

### 3.2 Restart Bot

- [ ] Matikan bot.
- [ ] Jalankan ulang:

```bash
node index.js
```

Input:

```txt
yanverse, tadi namaku siapa?
```

Expected:

- Yanverse masih bisa mengingat konteks jika belum melewati batas memory.

### 3.3 Clear Memory

Input:

```txt
.ai memory clear
```

Expected:

- Bot membalas:

```txt
Memory Yanverse untuk chat ini sudah dibersihkan.
```

Input ulang:

```txt
yanverse, tadi namaku siapa?
```

Expected:

- Yanverse tidak lagi mengandalkan memory lama untuk chat tersebut.

---

## 4. Knowledge

### 4.1 Knowledge Stats

Input:

```txt
.knowledge stats
```

Expected:

- Admin/owner melihat jumlah knowledge files, sections, command files, general files, categories, dan status OK.
- Non-admin ditolak.

### 4.2 Knowledge Search

Input:

```txt
.knowledge search medig
```

Expected:

- Bot menampilkan maksimal 5 hasil.
- Setiap hasil berisi file, section, dan snippet pendek.
- Tidak menampilkan isi file penuh.

### 4.3 Knowledge Retrieval MEDIG

Input:

```txt
yanverse, MEDIG tugasnya apa?
```

Expected:

- Yanverse menjawab berdasarkan knowledge lokal tentang MEDIG.
- Console menampilkan log `[KNOWLEDGE] sections=...` jika context ditemukan.

### 4.4 Knowledge Retrieval Learning System

Input:

```txt
yanverse, learning by teaching itu apa?
```

Expected:

- Yanverse menjelaskan berdasarkan knowledge lokal jika section relevan tersedia.
- Jika knowledge tidak relevan, Yanverse tetap menjawab umum tanpa halu berlebihan.

---

## 5. Google Sheets - Kas

Catatan: semua command kas harus read-only dan hanya untuk admin/owner.

### 5.1 Kas Utama

Input:

```txt
.kas utama
```

Expected:

- Menampilkan saldo/total kas terbaru.
- Menampilkan transaksi terakhir secara ringkas.
- Tidak menampilkan credential atau spreadsheet ID.

### 5.2 Kas Belum Bayar

Input:

```txt
.kas belum bayar
```

Expected:

- Menampilkan daftar anggota yang belum lunas.
- Output dibatasi agar tidak terlalu panjang.

### 5.3 Status Kas Anggota

Input:

```txt
.kas status <nama>
```

Contoh:

```txt
.kas status Abyan
```

Expected:

- Menampilkan status kas anggota yang cocok.
- Jika tidak ditemukan, bot memberi pesan tidak ditemukan.

### 5.4 Rekap Kas Semua Minggu

Input:

```txt
.kas rekap
```

Expected:

- Menampilkan rekap per minggu/tab.
- Ada total keseluruhan di bagian bawah.

### 5.5 Rekap Kas Minggu Tertentu

Input:

```txt
.kas rekap minggu <angka>
```

Contoh:

```txt
.kas rekap minggu 4
```

Expected:

- Menampilkan ringkasan minggu tersebut.
- Menampilkan daftar belum lunas maksimal 20 nama.
- Jika minggu tidak ditemukan, bot memberi pesan data tidak ditemukan.

---

## 6. Google Sheets - Infokus

Catatan: semua command infokus harus read-only dan hanya untuk admin/owner.

### 6.1 Status Infokus

Input:

```txt
.infokus
```

Expected:

- Jika ada peminjaman aktif, tampilkan nama peminjam, tanggal pinjam, kegiatan/keperluan, status, dan catatan jika ada.
- Jika tidak ada peminjaman aktif, tampilkan bahwa infokus sedang tidak dipinjam.

### 6.2 Infokus Aktif

Input:

```txt
.infokus aktif
```

Expected:

- Hanya menampilkan peminjaman yang belum dikembalikan.

### 6.3 Riwayat Infokus

Input:

```txt
.infokus riwayat
```

Expected:

- Menampilkan maksimal 5 riwayat terakhir.
- Tidak menampilkan data terlalu panjang.

---

## 7. Admin Context AI

### 7.1 Admin Tanya Saldo Kas

Input admin/owner:

```txt
yanverse, saldo kas utama sekarang berapa?
```

Expected:

- Yanverse menjawab berdasarkan data ringkas Google Sheets.
- Console menampilkan log:

```txt
[ADMIN_CONTEXT] type=kas_utama access=allowed
```

### 7.2 Admin Tanya Belum Lunas Minggu 4

Input admin/owner:

```txt
yanverse, siapa belum lunas minggu 4?
```

Expected:

- Yanverse menjawab berdasarkan rekap minggu 4.
- Data dibatasi, tidak mengirim seluruh spreadsheet.

### 7.3 Non-Admin Tanya Data Kas

Input non-admin:

```txt
yanverse, saldo kas utama sekarang berapa?
```

Expected:

- Yanverse tidak memberikan data kas.
- Bot/AI memberi jawaban umum bahwa data administrasi hanya untuk admin/pengurus.
- Console menampilkan log:

```txt
[ADMIN_CONTEXT] type=kas access=denied
```

---

## 8. Security

### 8.1 `.env` Tidak Tracked

Command lokal:

```bash
git ls-files .env
```

Expected:

- Tidak ada output.

### 8.2 `credentials/` Tidak Tracked

Command lokal:

```bash
git ls-files credentials
```

Expected:

- Tidak ada output.

### 8.3 `data/` Tidak Tracked

Command lokal:

```bash
git ls-files data
```

Expected:

- Tidak ada output.

### 8.4 `.env.example` Aman

- [ ] Pastikan `.env.example` hanya berisi placeholder.
- [ ] Tidak ada API key asli.
- [ ] Tidak ada private key.
- [ ] Tidak ada token Google/WhatsApp.
- [ ] Tidak ada bridge secret asli.

### 8.5 Git Status Sebelum Commit

Command lokal:

```bash
git status --short
```

Expected:

- Tidak ada `.env`, `credentials/`, `data/`, `.baileys_auth/`, SQLite, database, log, atau token yang masuk daftar commit.

---

## 9. Catatan Deploy

Sebelum deploy production:

- [ ] Jalankan `npm run smoke:test`.
- [ ] Jalankan `.bot status` dari WhatsApp.
- [ ] Test minimal `.help`, `.ai on`, `yanverse, kamu siapa?`, `.knowledge stats`, `.kas utama`, dan `.infokus`.
- [ ] Pastikan folder backup private tersedia.
- [ ] Pastikan tidak ada secret di Git status.