const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

// Generate API key baru (gratis, kuota 1000)
router.post('/key/generate', (req, res) => {
  const name = req.body.name || 'user';
  const key = 'HABI-' + crypto.randomBytes(12).toString('hex').toUpperCase();
  db.run('INSERT INTO keys (key, name, tier, quota) VALUES (?, ?, ?, ?)', [key, name, 'free', 1000], (err) => {
    if (err) return res.status(500).json({ status: false, message: 'Gagal bikin key' });
    res.json({ status: true, apikey: key, tier: 'free', quota: 1000, message: 'Simpan key ini baik-baik!' });
  });
});

// Cek sisa kuota
router.get('/key/info', checkKey, (req, res) => {
  res.json({
    status: true,
    name: req.apiKey.name,
    tier: req.apiKey.tier || 'free',
    quota: req.apiKey.quota,
    used: req.apiKey.used + 1,
    remaining: req.apiKey.quota - req.apiKey.used - 1
  });
});

// === ADMIN: upgrade/downgrade tier (butuh ADMIN_KEY di env) ===
router.post('/admin/upgrade', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.body.admin_key;
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ status: false, message: 'Admin key salah' });
  }
  const { apikey, tier } = req.body;
  if (!apikey || !['free', 'premium'].includes(tier)) {
    return res.status(400).json({ status: false, message: 'Kirim apikey + tier (free/premium)' });
  }
  const quota = tier === 'premium' ? 100000 : 1000;
  db.run('UPDATE keys SET tier = ?, quota = ?, used = 0 WHERE key = ?', [tier, quota, apikey], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ status: false, message: 'API key tidak ditemukan' });
    res.json({ status: true, apikey, tier, quota, message: `Key diupgrade ke ${tier}` });
  });
});

// === ADMIN: list semua keys ===
router.get('/admin/keys', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ status: false, message: 'Admin key salah' });
  }
  db.all('SELECT key, name, tier, quota, used, created_at FROM keys ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ status: false, message: 'Gagal' });
    res.json({ status: true, total: rows.length, keys: rows });
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
