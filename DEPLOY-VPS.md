# Deploy Habibi API ke VPS 43.134.8.193

Siap jalan begitu kamu bilang "gas". Backend di port 3000, Nginx jadi
reverse proxy + SSL. Tidak bentrok dengan HABI API yang sudah jalan di
port 80/8080 — ini subdomain terpisah.

## 1. Subdomain → VPS

Tambah A record di DNS: `api.servercloud.my.id` → `43.134.8.193`
(ganti nama subdomain kalau mau yang lain — sesuaikan di langkah 3 & 4).
Cek propagasi: `nslookup api.servercloud.my.id`

## 2. Upload & jalankan di VPS

```bash
# upload habibi-api.zip ke VPS, lalu di VPS:
unzip habibi-api.zip -d ~/habibi-api && cd ~/habibi-api
npm install
# yt-dlp (dibutuhkan endpoint /api/download/info):
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
# jalan 24/7:
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
tetap membaca IP asli client dari header — aman di belakang proxy.

## 4. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d api.servercloud.my.id
```

## 5. Tes dari HP/laptop

```bash
curl -s https://api.servercloud.my.id/api/info | head -c 300
# tanpa apikey → 401
```

Docs web: `https://api.servercloud.my.id/docs`

## Kalau mau ganti port

```bash
PORT=4000 pm2 restart habibi-api --update-env
# + sesuaikan proxy_pass di nginx
```
