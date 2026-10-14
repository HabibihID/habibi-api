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
// Note: api.erdwpe.com sedang down, pakai alternatif

// Quotemaker via quotly (text -> image)
router.get('/maker/quote', checkKey, (req, res) => {
  const { text, name, avatar } = req.query;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=&name=&avatar=' });
  // Redirect ke canvas quote yang sudah ada
  res.redirect(`/api/canvas/quote?text=${encodeURIComponent(text)}&author=${encodeURIComponent(name || 'Anonim')}`);
});

module.exports = router;
