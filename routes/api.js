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

// === WEBHOOK: set URL notifikasi kuota ===
router.post('/key/webhook', checkKey, (req, res) => {
  const { webhook_url } = req.body;
  if (webhook_url && !/^https?:\/\/.+/.test(webhook_url)) {
    return res.status(400).json({ status: false, message: 'URL webhook tidak valid' });
  }
  db.run('UPDATE keys SET webhook_url = ?, webhook_80_sent = 0, webhook_95_sent = 0 WHERE key = ?',
    [webhook_url || null, req.apiKey.key], (err) => {
      if (err) return res.status(500).json({ status: false, message: 'Gagal' });
      res.json({ status: true, webhook_url: webhook_url || null,
        message: webhook_url ? 'Webhook aktif! Notifikasi dikirim saat kuota 80% & 95%.' : 'Webhook dimatikan.' });
    });
});

// === STATISTIK PUBLIK ===
router.get('/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total_keys FROM keys', [], (err, k) => {
    db.get('SELECT COUNT(*) as total_req FROM logs', [], (err2, l) => {
      db.get(`SELECT COUNT(DISTINCT DATE(created_at)) as hari_aktif FROM logs`, [], (err3, h) => {
        db.all(`SELECT endpoint, COUNT(*) as hits FROM logs GROUP BY endpoint ORDER BY hits DESC LIMIT 10`, [], (err4, top) => {
          db.all(`SELECT DATE(created_at) as tgl, COUNT(*) as req FROM logs WHERE created_at >= DATE('now','-7 days') GROUP BY tgl ORDER BY tgl`, [], (err5, weekly) => {
            res.json({
              status: true,
              total_keys: k?.total_keys || 0,
              total_requests: l?.total_req || 0,
              hari_aktif: h?.hari_aktif || 0,
              top_endpoints: (top || []).map(t => ({ endpoint: t.endpoint, hits: t.hits })),
              seminggu_terakhir: (weekly || []).map(w => ({ tanggal: w.tgl, request: w.req })),
            });
          });
        });
      });
    });
  });
});
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
