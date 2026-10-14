# 🚀 Habibi API — Template REST API Lengkap

## Cara jalanin
```bash
cd habibi-api
npm install
node server.js
```
Buka: http://localhost:3000/docs

## Fitur yang udah jadi
- ✅ Generate API key (POST /api/key/generate)
- ✅ Cek kuota (GET /api/key/info)
- ✅ Validasi key otomatis di semua endpoint
- ✅ Rate limit 100 req/15 menit per IP
- ✅ Logging semua request ke database
- ✅ Halaman dokumentasi web
- ✅ Contoh endpoint canvas (gambar teks SVG)
- ✅ Contoh endpoint info
- ✅ Contoh endpoint download info — TikTok/YouTube/IG via yt-dlp, **dengan cache 1 jam** (anti-blokir IP)

## Endpoint download (butuh yt-dlp di server)

```bash
pip install yt-dlp
# atau: sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
```

`GET /api/download/info?url=LINK_VIDEO&apikey=KEY` → judul, durasi, thumbnail, link download langsung (mp4 ≤720p biar hemat bandwidth).

Kenapa aman dari blokir IP (pola yang dipakai di `routes/download.js`):
1. **Cache 1 jam** — URL yang sama tidak hit YouTube/TikTok ulang sama sekali
2. **1x panggilan per request** + timeout 30 detik (tidak dihajar terus)
3. **User-Agent dirotasi** tiap request (kurangi jejak bot)
4. **SSRF guard** — URL localhost/IP privat ditolak

## Struktur
```
habibi-api/
├── server.js              # Entry point
├── db.js                  # SQLite (keys + logs + dl_cache)
├── routes/api.js          # Endpoint API umum (key, canvas, info)
├── routes/download.js     # Endpoint download info (yt-dlp + cache)
├── middleware/apikey.js   # Validasi key + catat kuota
└── public/index.html      # Landing + dokumentasi
```

## Cara tambah endpoint baru
Di `routes/api.js`:
```js
router.get('/namafitur', checkKey, (req, res) => {
  res.json({ status: true, data: '...' });
});
```

## Deploy ke VPS
```bash
# Install PM2 biar jalan 24/7
npm i -g pm2
pm2 start server.js --name habibi-api
pm2 startup && pm2 save

# Nginx reverse proxy + SSL via certbot
# Arahkan domain api.kamu.com ke VPS
```
