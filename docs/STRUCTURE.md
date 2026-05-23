# Struktur Project

Project ini dipisah berdasarkan tanggung jawab supaya fitur baru tidak selalu ditumpuk ke `handlers/menu.js`.

## Entry Point

- `index.js`
  - koneksi Baileys
  - wrapping message WhatsApp menjadi interface bot
  - lifecycle bot, termasuk notifikasi maintenance

## Handler

- `handlers/menu.js`
  - router command WhatsApp
  - mengatur alur balasan dan permission command
  - sebaiknya hanya memanggil parser/service, bukan menyimpan logic besar fitur baru

- `handlers/drive.js`
  - integrasi Google Drive dokumentasi

## Config

- `config/index.js`
  - path file/folder project
  - role admin dari `.env`
  - setting notifikasi bot
  - key internal attendance
  - nilai enum seperti role anggota/pengurus

## Repository

- `repositories/members.js`
  - baca/tulis `data/members.json`

- `repositories/attendance.js`
  - baca/tulis `data/attendance.json`

Repository hanya bertugas akses data. Logic command tetap di handler/service.

## Library

- `lib/jsonFile.js`
  - helper umum baca/tulis JSON
  - dipakai repository supaya akses file konsisten

- `lib/dateTime.js`
  - helper tanggal/jam WIB
  - normalisasi input tanggal dan jam command

## Parsers

- `parsers/attendanceParser.js`
  - parsing command absen/jadwal/izin/daftar hadir
  - tidak membaca/menulis data

## Services

- `services/notification.js`
  - kirim notifikasi grup
  - dipakai `index.js` dan `handlers/menu.js`

- `services/attendanceService.js`
  - logic absen: sesi, buka/tutup, hadir, izin, hapus hadir/izin, rekap, jadwal
  - memakai repository attendance/members

## Arah Refactor Berikutnya

Prioritas refactor berikutnya:

1. Pindahkan parser daftar/member ke `parsers/registerParser.js`.
2. Pindahkan logic member/LID ke `services/memberService.js` dan `lib/identity.js`.
3. Pindahkan teks balasan panjang ke `messages/`.
4. Pecah `handlers/menu.js` menjadi handler kecil seperti `attendanceHandler`, `registerHandler`, `documentationHandler`, dan `pemateriHandler`.