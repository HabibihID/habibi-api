// === CONTOH ENDPOINT: download info (rawan blokir IP — baca pola amannya) ===
// Pola anti-blokir yang dipakai di sini:
//  1. Cache agresif: URL yang sama tidak di-hit ulang selama 1 jam (SQLite)
//  2. Satu panggilan yt-dlp per request, dengan timeout 30 detik
//  3. User-Agent dirotasi tiap request (kurangi jejak bot)
//  4. URL divalidasi + SSRF guard (tolak localhost/IP privat)
const express = require('express');
const crypto = require('crypto');
const { execFile } = require('child_process');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const CACHE_TTL = 3600; // 1 jam — URL sama tidak hit layanan luar lagi

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
];

function validUrl(u) {
  try {
    const p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return false;
    const h = p.hostname.toLowerCase();
    // SSRF guard: tolak target internal
    if (h === 'localhost' || h.endsWith('.localhost')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return false;
    const m = h.match(/^172\.(\d+)\./);
    if (m && +m[1] >= 16 && +m[1] <= 31) return false;
    return true;
  } catch { return false; }
}

function ytdlpJson(url) {
  return new Promise((resolve, reject) => {
    const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
    execFile('yt-dlp',
      ['--dump-json', '--no-playlist', '--no-warnings',
       '--socket-timeout', '12', '--user-agent', ua, url],
      { timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          if (err.code === 'ENOENT') return reject({ status: 503, message: 'yt-dlp belum terinstall di server. Install: pip install yt-dlp' });
          return reject({ status: 502, message: 'Gagal ambil info video: ' + String(err.message).slice(0, 200) });
        }
        try { resolve(JSON.parse(stdout)); }
        catch { reject({ status: 502, message: 'Respons yt-dlp tidak valid' }); }
      });
  });
}

function pickBest(j) {
  // Pilih direct URL mp4 yang ringan (<=720p) biar hemat bandwidth
  const fmts = (j.formats || []).filter(f => f.url && f.ext === 'mp4' && f.vcodec !== 'none');
  fmts.sort((a, b) => (a.height || 0) - (b.height || 0));
  const small = fmts.filter(f => (f.height || 0) <= 720);
  const pick = small[small.length - 1] || fmts[0];
  return pick ? { url: pick.url, quality: pick.height ? pick.height + 'p' : 'audio/video', ext: pick.ext } : null;
}

router.get('/download/info', checkKey, (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ status: false, message: 'Kirim ?url=link_video' });
  if (!validUrl(url)) return res.status(400).json({ status: false, message: 'URL tidak valid / tidak diizinkan' });

  const hash = crypto.createHash('sha256').update(url).digest('hex');
  const now = Math.floor(Date.now() / 1000);

  // 1. Cek cache dulu — URL sama = tanpa hit layanan luar sama sekali
  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return res.json(data);
    }
    // 2. Cache miss → 1x panggilan yt-dlp
    ytdlpJson(url).then(j => {
      const out = {
        status: true,
        cached: false,
        title: j.title,
        duration: j.duration,
        uploader: j.uploader || j.channel,
        thumbnail: j.thumbnail,
        webpage_url: j.webpage_url,
        source: j.extractor,
        download: pickBest(j),
      };
      db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
        [hash, JSON.stringify(out), now]);
      res.json(out);
    }).catch(e => {
      res.status(e.status || 500).json({ status: false, message: e.message || 'Error' });
    });
  });
});

module.exports = router;
