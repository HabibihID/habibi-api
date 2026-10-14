// ============ 🎨 EPHOTO360 & TEXT EFFECT MAKER ============
// Via api.siputzx.my.id (proxy ephoto360, gratis, tanpa captcha)
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const CACHE_TTL = 86400; // 1 hari

// Daftar effect ephoto360 populer
const EFFECTS = {
  glitch: 'https://ephoto360.com/glitch-text-effect-with-new-layer-189.html',
  neon: 'https://ephoto360.com/neon-light-text-effect-online-882.html',
  gold: 'https://ephoto360.com/golden-text-effect-842.html',
  fire: 'https://ephoto360.com/advanced-glow-effects-74.html',
  matrix: 'https://ephoto360.com/matrix-text-effect-154.html',
  thunder: 'https://ephoto360.com/thunder-text-effect-online-888.html',
  galaxy: 'https://ephoto360.com/galaxy-text-effect-456.html',
  graffiti: 'https://ephoto360.com/graffiti-text-effect-751.html',
  retro: 'https://ephoto360.com/retro-text-effect-468.html',
  blood: 'https://ephoto360.com/blood-text-effect-454.html',
  ice: 'https://ephoto360.com/ice-text-effect-452.html',
  horror: 'https://ephoto360.com/horror-text-effect-online-883.html',
  blackpink: 'https://ephoto360.com/blackpink-text-effect-810.html',
  joker: 'https://ephoto360.com/joker-text-effect-816.html',
  harrypotter: 'https://ephoto360.com/harry-potter-text-effect-815.html',
  pubg: 'https://ephoto360.com/pubg-text-effect-807.html',
  freefire: 'https://ephoto360.com/free-fire-text-effect-809.html',
  amongus: 'https://ephoto360.com/among-us-text-effect-814.html',
  sand: 'https://ephoto360.com/write-text-on-sand-beach-online-1001.html',
  water: 'https://ephoto360.com/create-water-effect-text-online-1008.html',
};

function ephotoRoute(effectKey) {
  return async (req, res) => {
    const text = (req.query.text || '').trim();
    const text2 = (req.query.text2 || '').trim();
    if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=tulisanmu' });
    if (text.length > 30) return res.status(400).json({ status: false, message: 'Maksimal 30 karakter' });

    // Proxy via siputzx (handle captcha ephoto360)
    const apiUrl = `https://api.siputzx.my.id/api/m/ephoto360?url=${encodeURIComponent(EFFECTS[effectKey])}&text1=${encodeURIComponent(text)}${text2 ? `&text2=${encodeURIComponent(text2)}` : ''}`;

    // Redirect langsung ke hasil (gambar)
    res.redirect(apiUrl);
  };
}

for (const key of Object.keys(EFFECTS)) {
  router.get(`/ephoto/${key}`, checkKey, ephotoRoute(key));
}

router.get('/ephoto/list', checkKey, (req, res) => {
  res.json({
    status: true,
    total: Object.keys(EFFECTS).length,
    effects: Object.keys(EFFECTS).map(k => ({ name: k, endpoint: `/api/ephoto/${k}?text=tulisanmu` })),
  });
});

// ============ 🛠️ MAKER LAINNYA ============
// Semua pakai SVG (ringan, tanpa library tambahan)

// TTP — Text to Picture dengan style
router.get('/maker/ttp', checkKey, (req, res) => {
  const text = (req.query.text || '').replace(/[<>&]/g, '').substring(0, 50);
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=' });
  const bg = (req.query.bg || 'a855f7').replace(/[^a-fA-F0-9]/g, '').substring(0, 6) || 'a855f7';
  const fg = (req.query.fg || 'ffffff').replace(/[^a-fA-F0-9]/g, '').substring(0, 6) || 'ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${bg}"/><stop offset="1" stop-color="#${bg}99"/>
    </linearGradient></defs>
    <rect width="512" height="512" rx="40" fill="url(#g)"/>
    <foreignObject x="40" y="150" width="432" height="212">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:48px;font-weight:bold;color:#${fg};text-align:center;word-wrap:break-word;">${text}</div>
    </foreignObject>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

// ATTP — Animated Text (SVG animation, cocok buat stiker)
router.get('/maker/attp', checkKey, (req, res) => {
  const text = (req.query.text || '').replace(/[<>&]/g, '').substring(0, 30);
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=' });
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#a855f7', '#22c55e'];
  const c1 = colors[text.length % colors.length];
  const c2 = colors[(text.length + 3) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"><animate attributeName="stop-color" values="${c1};${c2};${c1}" dur="2s" repeatCount="indefinite"/></stop>
        <stop offset="100%" stop-color="${c2}"><animate attributeName="stop-color" values="${c2};${c1};${c2}" dur="2s" repeatCount="indefinite"/></stop>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="40" fill="#1a1a2e"/>
    <text x="256" y="270" font-family="Arial,sans-serif" font-size="64" font-weight="bold" text-anchor="middle" fill="url(#ag)">${text}
      <animate attributeName="font-size" values="64;72;64" dur="1.5s" repeatCount="indefinite"/>
    </text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

// Emoji Mix — via Google EmojiKitchen
router.get('/maker/emojimix', checkKey, (req, res) => {
  const { emoji1, emoji2 } = req.query;
  if (!emoji1 || !emoji2) return res.status(400).json({ status: false, message: 'Kirim ?emoji1=😀&emoji2=😎' });
  const cp = (e) => {
    const codes = [];
    for (const ch of e) {
      const c = ch.codePointAt(0).toString(16);
      codes.push('u' + c);
    }
    return codes.join('_');
  };
  // EmojiKitchen URL pattern
  const url = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/${cp(emoji1)}/${cp(emoji1)}_${cp(emoji2)}.png`;
  res.redirect(url);
});

// Sticker text — teks dengan outline (cocok buat stiker WA)
router.get('/maker/sticker', checkKey, (req, res) => {
  const text = (req.query.text || '').replace(/[<>&]/g, '').substring(0, 30);
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=' });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="none"/>
    <text x="256" y="280" font-family="Arial,sans-serif" font-size="80" font-weight="900" text-anchor="middle"
      fill="white" stroke="#a855f7" stroke-width="8" paint-order="stroke">${text}</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

// Nulis — efek tulisan tangan di buku
router.get('/maker/nulis', checkKey, (req, res) => {
  const text = (req.query.text || '').replace(/[<>&]/g, '').substring(0, 200);
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=' });
  const lines = [];
  const words = text.split(' ');
  let line = '';
  words.forEach(w => {
    if ((line + ' ' + w).length > 35) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  });
  if (line) lines.push(line);
  const textEls = lines.slice(0, 8).map((l, i) =>
    `<text x="60" y="${120 + i * 45}" font-family="cursive" font-size="28" fill="#1e3a5f">${l}</text>`
  ).join('');
  // Garis buku
  let rules = '';
  for (let i = 0; i < 10; i++) {
    rules += `<line x1="40" y1="${100 + i * 45}" x2="560" y2="${100 + i * 45}" stroke="#e0e0e0" stroke-width="1"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="550">
    <rect width="600" height="550" fill="white"/>
    <line x1="50" y1="0" x2="50" y2="550" stroke="#ff9999" stroke-width="2"/>
    ${rules}${textEls}
  </svg>`;
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

module.exports = router;
