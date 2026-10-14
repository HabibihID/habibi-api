const db = require('../db');

// Validasi API key + catat pemakaian
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
    db.run('UPDATE keys SET used = used + 1 WHERE key = ?', [key]);
    db.run('INSERT INTO logs (key, endpoint, ip) VALUES (?, ?, ?)',
      [key, req.path, req.ip]);
    req.apiKey = row;
    next();
  });
}

module.exports = { checkKey };
