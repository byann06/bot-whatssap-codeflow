# Backup Notes

Backup bot Code Flow / Yanverse harus memisahkan source code dan data runtime. Source code boleh masuk Git, tapi data rahasia dan session runtime wajib dibackup manual secara privat.

## Wajib Dibackup Manual

- `.env`
- `credentials/`
- `data/`
- `.baileys_auth/`
- `baileys_auth/` jika dipakai
- `auth/`, `session/`, atau `sessions/` jika dipakai oleh runtime

## Jangan Dibackup ke Publik

- `node_modules/`
- `logs/`
- file `*.log`
- file backup zip/rar yang berisi `.env`, credential, database, atau session WhatsApp

## Cara Backup Aman

1. Matikan bot dulu agar database dan session tidak sedang ditulis.
2. Copy `.env`, `credentials/`, `data/`, dan folder auth/session WhatsApp ke storage privat.
3. Simpan backup dengan nama tanggal, contoh `backup-yanverse-2026-05-31.zip`.
4. Jika backup disimpan cloud, gunakan akun privat dan jangan buat link publik.

## Cara Restore

1. Clone/pull source code project.
2. Jalankan `npm ci --omit=dev` di server production.
3. Restore `.env`, `credentials/`, `data/`, dan folder auth/session WhatsApp ke lokasi yang sama.
4. Jalankan bot dan cek command seperti `.bot status`, `.help`, dan command admin yang penting.

## Catatan

Jangan upload backup penuh project ke GitHub, Discord, Google Drive publik, atau tempat yang bisa diakses anggota umum. Backup penuh biasanya berisi session WhatsApp dan credential Google yang cukup untuk mengambil alih bot.
