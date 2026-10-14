const db = require('../db');
const https = require('https');
const http = require('http');

// Kirim webhook notifikasi (fire-and-forget)
function sendWebhook(url, payload) {
  try {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(payload);
    const req = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, 'User-Agent': 'HabibiAPI-Webhook/1.0' },
      timeout: 5000,
    });
    req.on('error', () => {});
    req.write(data);
    req.end();
  } catch (e) {}
}

// Validasi API key + catat pemakaian + webhook kuota
function checkKey(req, res, next) {
  const key = req.query.apikey || req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ status: false, message: 'API key wajib! Daftar di /docs' });
  }
  db.get('SELECT * FROM keys WHERE key = ?', [key], (err, row) => {
    if (err || !row) {
      return res.status(403).json({ status: false, message: 'API key tidak valid' });
    }
    if (row.used >= row.quota) {
      return res.status(429).json({ status: false, message: 'Kuota habis! Hubungi admin' });
    }
    const newUsed = row.used + 1;
    db.run('UPDATE keys SET used = ? WHERE key = ?', [newUsed, key]);
    db.run('INSERT INTO logs (key, endpoint, ip) VALUES (?, ?, ?)',
      [key, req.path, req.ip]);

    // 🔔 Webhook: kirim notifikasi saat kuota 80% dan 95%
    const pct = Math.round(newUsed / row.quota * 100);
    if (row.webhook_url) {
      if (pct >= 80 && !row.webhook_80_sent) {
        db.run('UPDATE keys SET webhook_80_sent = 1 WHERE key = ?', [key]);
        sendWebhook(row.webhook_url, {
          event: 'quota_warning', level: 80,
          apikey: key.slice(0, 12) + '...', tier: row.tier,
          used: newUsed, quota: row.quota, percent: pct,
          message: `Kuota API ${pct}% terpakai (${newUsed}/${row.quota})`,
        });
      } else if (pct >= 95 && !row.webhook_95_sent) {
        db.run('UPDATE keys SET webhook_95_sent = 1 WHERE key = ?', [key]);
        sendWebhook(row.webhook_url, {
          event: 'quota_critical', level: 95,
          apikey: key.slice(0, 12) + '...', tier: row.tier,
          used: newUsed, quota: row.quota, percent: pct,
          message: `Kuota API hampir habis! ${pct}% terpakai (${newUsed}/${row.quota})`,
        });
      }
    }

    req.apiKey = { ...row, used: newUsed };
    next();
  });
}

module.exports = { checkKey, sendWebhook };
