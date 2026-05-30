# Security Notes

Project bot Code Flow / Yanverse punya file runtime dan credential yang tidak boleh diupload ke Git, dibagikan ke publik, atau dimasukkan ke zip publik.

## Jangan Upload File Ini

- `.env`
- `credentials/`
- `.baileys_auth/`
- `baileys_auth/`
- `auth/`
- `session/`
- `sessions/`
- `data/`
- `*.sqlite`
- `*.db`
- `google-drive-token.json`
- `google-sheets-service-account.json`
- `token.json`
- `logs/`
- `*.log`

## Isi Sensitif

File/folder di atas bisa berisi API key, Google credential, Google Drive token, WhatsApp session, database runtime, data anggota, absensi, atau log runtime.

## Cara Restore Aman

1. Clone atau pull source code dari Git.
2. Buat `.env` baru dari `.env.example`.
3. Isi secret/API key hanya di `.env` lokal atau environment VPS.
4. Restore folder `credentials/` dari backup private.
5. Restore `data/` dan `.baileys_auth/` dari backup private jika ingin mempertahankan database/session lama.
6. Jalankan `npm ci --omit=dev` di server.

## Peringatan

Jangan share zip project penuh ke publik kalau masih berisi `.env`, `credentials/`, `data/`, atau `.baileys_auth/`.

Kalau file sensitif terlanjur tracked Git, jangan hapus history sembarangan. Minimal hentikan tracking dengan:

`git rm --cached <file>`

Lalu rotasi secret/token yang terlanjur bocor.
