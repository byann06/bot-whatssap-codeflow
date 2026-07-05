# Attendance Commands

## hadir
Digunakan anggota untuk mencatat kehadiran saat sesi absen sedang dibuka.

Format:
hadir

Catatan:
- hanya bisa digunakan saat admin membuka absen
- wajib digunakan di grup utama kegiatan
- jika anggota tidak bisa hadir, gunakan izin dengan alasan

## izin
Digunakan anggota untuk mengajukan izin jika tidak bisa hadir.

Format:
izin, sakit
izin | ada urusan keluarga
izin ada urusan keluarga

Catatan:
- alasan izin wajib diisi
- izin boleh dikirim di grup atau chat pribadi bot
- anggota tetap tercatat di rekap

## buka absen
Digunakan admin untuk membuka sesi absensi.

Format:
buka absen
buka absen,pertemuan ketiga

Catatan:
- biasanya hanya digunakan admin atau pengurus tertentu
- saat absen dibuka, bot akan mengingatkan anggota untuk mengisi hadir/izin
- jika jadwal punya jam tutup, bot akan menutup absen otomatis

## tutup absen
Digunakan admin untuk menutup sesi absensi dan membuat rekap.

Format:
tutup absen

## daftar hadir
Digunakan admin untuk melihat daftar hadir anggota.

Format:
daftar hadir
daftar hadir 21-05-2026

## daftar izin
Digunakan admin untuk melihat daftar anggota yang izin.

Format:
daftar izin
daftar izin 21-05-2026

## buat jadwal
Digunakan admin untuk membuat jadwal absensi atau pertemuan.

Format:
buat jadwal,21-05-2026,13.00-17.00,pertemuan ketiga

## lihat jadwal
Digunakan admin untuk melihat semua jadwal absensi.

Format:
lihat jadwal
liat jadwal

## hapus jadwal
Digunakan admin untuk menghapus jadwal tertentu.

Format:
hapus jadwal,1

## ubah jadwal
Digunakan admin untuk mengubah data jadwal.

Format:
ubah jadwal,1,jam,13.00
ubah jadwal,1,nama,pertemuan 4
