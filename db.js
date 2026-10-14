const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'habibi.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    name TEXT,
    quota INTEGER DEFAULT 1000,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    endpoint TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Cache hasil download: url_hash -> JSON, TTL dicek di kode (1 jam)
  db.run(`CREATE TABLE IF NOT EXISTS dl_cache (
    url_hash TEXT PRIMARY KEY,
    data TEXT,
    created_at INTEGER
  )`);
});

module.exports = db;
