const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

function fetchJSON(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 3) return reject(new Error('Too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJSON(new URL(res.headers.location, url).href, depth + 1));
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// ============ 🎮 GAME ============
router.get('/game/free', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://www.freetogame.com/api/games?platform=pc');
    res.json({
      status: true, total: j.length,
      games: j.slice(0, 20).map(g => ({
        id: g.id, title: g.title, genre: g.genre,
        platform: g.platform, thumbnail: g.thumbnail, gameUrl: g.game_url
      }))
    });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil data game' }); }
});

router.get('/game/detail/:id', checkKey, async (req, res) => {
  try {
    const g = await fetchJSON(`https://www.freetogame.com/api/game?id=${req.params.id}`);
    res.json({ status: true, title: g.title, genre: g.genre, description: g.description?.substring(0, 300), minimumRequirements: g.minimum_system_requirements });
  } catch (e) { res.status(500).json({ status: false, message: 'Game tidak ditemukan' }); }
});

// ============ 🌤️ CUACA ============
const KOTA = { jakarta: [-6.2, 106.8], bandung: [-6.9, 107.6], surabaya: [-7.25, 112.75], medan: [3.59, 98.67], semarang: [-6.99, 110.42], makassar: [-5.14, 119.42], denpasar: [-8.67, 115.21], yogyakarta: [-7.79, 110.36] };
const WCODE = { 0: 'Cerah', 1: 'Cerah Berawan', 2: 'Berawan', 3: 'Mendung', 45: 'Berkabut', 51: 'Gerimis', 61: 'Hujan Ringan', 63: 'Hujan', 65: 'Hujan Lebat', 71: 'Salju Ringan', 80: 'Hujan Rintik', 95: 'Badai Petir' };

router.get('/cuaca', checkKey, async (req, res) => {
  const kota = (req.query.kota || 'jakarta').toLowerCase();
  const loc = KOTA[kota] || KOTA.jakarta;
  try {
    const j = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${loc[0]}&longitude=${loc[1]}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FJakarta`);
    const c = j.current;
    res.json({ status: true, kota, suhu: c.temperature_2m + '°C', kondisi: WCODE[c.weather_code] || 'Unknown', kelembapan: c.relative_humidity_2m + '%', angin: c.wind_speed_10m + ' km/h' });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil cuaca' }); }
});

// ============ 😂 FUN ============
router.get('/fun/joke', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://official-joke-api.appspot.com/random_joke');
    res.json({ status: true, setup: j.setup, punchline: j.punchline });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil joke' }); }
});

router.get('/fun/quote', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://dummyjson.com/quotes/random');
    res.json({ status: true, quote: j.quote, author: j.author });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil quote' }); }
});

router.get('/fun/catfact', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://catfact.ninja/fact');
    res.json({ status: true, fact: j.fact });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil fact' }); }
});

// ============ 🛠️ TOOLS ============
router.get('/tools/qrcode', checkKey, async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=...' });
  // Redirect ke QR image (client langsung dapet gambar)
  res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`);
});

router.get('/tools/password', checkKey, (req, res) => {
  const len = Math.min(parseInt(req.query.length) || 12, 64);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < len; i++) pw += chars[crypto.randomInt(chars.length)];
  res.json({ status: true, password: pw, length: len });
});

router.get('/tools/base64', checkKey, (req, res) => {
  const { text, mode } = req.query;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=...&mode=encode/decode' });
  try {
    const result = mode === 'decode'
      ? Buffer.from(text, 'base64').toString('utf8')
      : Buffer.from(text).toString('base64');
    res.json({ status: true, mode: mode || 'encode', result });
  } catch (e) { res.status(400).json({ status: false, message: 'Format tidak valid' }); }
});

// ============ 🎨 CANVAS ============
router.get('/canvas/quote', checkKey, (req, res) => {
  const text = (req.query.text || 'Tetap semangat!').replace(/[<>&]/g, '').substring(0, 100);
  const author = (req.query.author || 'Habibi API').replace(/[<>&]/g, '').substring(0, 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a2e"/><stop offset="1" stop-color="#4a1a6e"/>
    </linearGradient></defs>
    <rect width="600" height="400" fill="url(#g)"/>
    <text x="300" y="40" font-size="28" text-anchor="middle" fill="#a855f7" font-family="sans-serif">❝</text>
    <foreignObject x="60" y="70" width="480" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-family:sans-serif;font-size:24px;text-align:center;">${text}</div></foreignObject>
    <text x="300" y="340" font-size="18" text-anchor="middle" fill="#a855f7" font-family="sans-serif">— ${author}</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

router.get('/canvas/welcome', checkKey, (req, res) => {
  const name = (req.query.name || 'User').replace(/[<>&]/g, '').substring(0, 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1a1a2e"/><stop offset="1" stop-color="#2d1a4e"/>
    </linearGradient></defs>
    <rect width="800" height="300" fill="url(#g)"/>
    <circle cx="130" cy="150" r="70" fill="#a855f7" opacity="0.3"/>
    <circle cx="130" cy="150" r="55" fill="#a855f7"/>
    <text x="130" y="170" font-size="50" text-anchor="middle" fill="#fff" font-family="sans-serif">${name.charAt(0).toUpperCase()}</text>
    <text x="230" y="130" font-size="22" fill="#888" font-family="sans-serif">SELAMAT DATANG</text>
    <text x="230" y="175" font-size="42" fill="#fff" font-family="sans-serif" font-weight="bold">${name}</text>
    <text x="230" y="210" font-size="16" fill="#a855f7" font-family="sans-serif">Habibi API • Member Baru</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

module.exports = router;
