# Deploy Habibi API ke VPS baru 94.237.76.19 (akun UpCloud habibihid)

VPS khusus API (bukan numpang di VPS lama): 1 CPU / 1 GB RAM / 20 GB,
Ubuntu 24.04, sg-sin1 Singapore, hostname api.servercloud.my.id.
Status: provisioning selesai — port 22 sudah terbuka (dicek 13:03 WIB, 14 Okt).

SSH: `ssh -i ~/workspace/ssh-keys/upcloud/upcloud root@94.237.76.19`
(kunci private `habibi-upcloud-sg`, salinannya ada di workspace — chmod 600).

## 1. DNS di Cloudflare

Tambah A record di zone `servercloud.my.id`:
- Name: `api` → IPv4: `94.237.76.19`
- Proxy: matikan dulu (awan abu-abu) supaya certbot gampang, nyalakan lagi setelah SSL jalan.

Cek propagasi: `nslookup api.servercloud.my.id` harus jawab 94.237.76.19.
(Catatan: tadi pagi record ini masih mengarah ke IP lain — wajib diganti.)

## 2. Siapkan server (sekali jalan, copy-paste)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx unzip

# Firewall
sudo ufw allow 22,80,443/tcp && sudo ufw --force enable

# Upload habibi-api.zip (36 KB, build 14 Okt 12:40 WIB — 41 endpoint, 10 kategori)
# dari laptop: scp -i <key> ~/workspace/your_files/habibi-api.zip root@94.237.76.19:~/
# lalu di VPS:
unzip ~/habibi-api.zip -d ~/habibi-api && cd ~/habibi-api && npm install

# yt-dlp (dibutuhkan endpoint /api/download/info)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp

# jalan 24/7
sudo npm i -g pm2
pm2 start server.js --name habibi-api
pm2 startup && pm2 save
```

## 3. Nginx reverse proxy

`/etc/nginx/sites-available/habibi-api`:
```nginx
server {
    listen 80;
    server_name api.servercloud.my.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/habibi-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Catatan: `server.js` sudah `app.set('trust proxy', 1)`, jadi rate-limit
(100 req/15 menit) tetap membaca IP asli client di belakang proxy.

## 4. SSL + proxy Cloudflare ON

```bash
sudo certbot --nginx -d api.servercloud.my.id
```
Setelah sertifikat aktif: di Cloudflare nyalakan proxy (awan oranye) →
IP asli VPS kesembunyiin + proteksi WAF.

## 5. Tes

```bash
curl -s https://api.servercloud.my.id/ | head -c 200          # landing page
curl -s https://api.servercloud.my.id/api/info/time           # tanpa key → 401
```
Docs: `https://api.servercloud.my.id/docs`

## Catatan

- Database SQLite mulai fresh di VPS (key lokal di laptop tidak ikut).
  User daftar key baru lewat form di halaman `/docs`.
- Beban RAM ringan: proses Node ~80–150 MB, masih longgar di 1 GB.
- File lama `DEPLOY-VPS.md` adalah rencana numpang di VPS 43.134.8.193 —
  sudah digantikan dokumen ini karena user bikin VPS khusus API.
