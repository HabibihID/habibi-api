// ============ 🔍 SEARCH ENGINE ============
// Catatan: TikTok search dihapus — tidak ada API gratis yang stabil
// (yt-dlp tidak support tiktoksearch, tikwm + TikTok web API ke-block Cloudflare/bot protection)
// TikTok download via URL tetap jalan di /api/download/tiktok
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const { execFile } = require('child_process');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const CACHE_TTL = 3600;

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
];

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0', ...headers } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function getCache(hash, cb) {
  const now = Math.floor(Date.now() / 1000);
  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return cb(null, data);
    }
    cb(null, null);
  });
}

function setCache(hash, data) {
  const now = Math.floor(Date.now() / 1000);
  db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
    [hash, JSON.stringify(data), now]);
}

// ============ 🎵 SEARCH MUSIK (iTunes API — gratis, ada preview 30 detik) ============
router.get('/search/musik', checkKey, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ status: false, message: 'Kirim ?q=judul_lagu' });
  const n = Math.min(parseInt(req.query.limit) || 10, 25);
  const hash = 'musik_' + crypto.createHash('sha256').update(q).digest('hex');

  getCache(hash, async (err, cached) => {
    if (cached) return res.json(cached);
    try {
      const j = await fetchJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=${n}&lang=id_id`);
      const results = (j.results || []).map(t => ({
        judul: t.trackName,
        artis: t.artistName,
        album: t.collectionName,
        genre: t.primaryGenreName,
        durasi: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) + ' detik' : null,
        artwork: t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '600x600') : null,
        preview: t.previewUrl || null,
        harga: t.trackPrice ? `${t.currency} ${t.trackPrice}` : null,
        link_apple: t.trackViewUrl,
      }));
      const out = { status: true, cached: false, query: q, total: results.length, results };
      setCache(hash, out);
      res.json(out);
    } catch (e) {
      res.status(502).json({ status: false, message: 'Gagal search musik' });
    }
  });
});

// ============ 🖼️ SEARCH GAMBAR / WALLPAPER (Wallhaven — gratis) ============
router.get('/search/gambar', checkKey, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ status: false, message: 'Kirim ?q=kata_kunci' });
  const n = Math.min(parseInt(req.query.limit) || 12, 24);
  const hash = 'gambar_' + crypto.createHash('sha256').update(q).digest('hex');

  getCache(hash, async (err, cached) => {
    if (cached) return res.json(cached);
    try {
      const j = await fetchJSON(`https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(q)}&sorting=relevance`);
      const results = (j.data || []).slice(0, n).map(w => ({
        id: w.id,
        resolusi: w.resolution,
        kategori: w.category,
        views: w.views,
        favorites: w.favorites,
        thumbnail: w.thumbs?.small,
        preview: w.thumbs?.large,
        full: w.path,
        link: w.url,
      }));
      const out = { status: true, cached: false, query: q, total: results.length, results };
      setCache(hash, out);
      res.json(out);
    } catch (e) {
      res.status(502).json({ status: false, message: 'Gagal search gambar' });
    }
  });
});

module.exports = router;
