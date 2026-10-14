const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

// Generate API key baru (gratis, kuota 1000)
router.post('/key/generate', (req, res) => {
  const name = req.body.name || 'user';
  const key = 'HABI-' + crypto.randomBytes(12).toString('hex').toUpperCase();
  db.run('INSERT INTO keys (key, name) VALUES (?, ?)', [key, name], (err) => {
    if (err) return res.status(500).json({ status: false, message: 'Gagal bikin key' });
    res.json({ status: true, apikey: key, quota: 1000, message: 'Simpan key ini baik-baik!' });
  });
});

// Cek sisa kuota
router.get('/key/info', checkKey, (req, res) => {
  res.json({
    status: true,
    name: req.apiKey.name,
    quota: req.apiKey.quota,
    used: req.apiKey.used + 1,
    remaining: req.apiKey.quota - req.apiKey.used - 1
  });
});

// === CONTOH ENDPOINT: canvas (aman, proses lokal) ===
router.get('/canvas/text', checkKey, (req, res) => {
  const text = req.query.text || 'Halo!';
  // Balikin SVG simpel (di production bisa pake canvas lib)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
    <rect width="600" height="200" fill="#1a1a2e"/>
    <text x="300" y="115" font-size="42" text-anchor="middle" fill="#a855f7" font-family="sans-serif">${text.replace(/[<>&]/g, '')}</text>
  </svg>`;
  res.set('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// === CONTOH ENDPOINT: info ===
router.get('/info/time', checkKey, (req, res) => {
  res.json({ status: true, time: new Date().toISOString(), timezone: 'Asia/Jakarta' });
});

router.get('/info/echo', checkKey, (req, res) => {
  res.json({ status: true, echo: req.query.msg || 'kirim ?msg=...' });
});

module.exports = router;
