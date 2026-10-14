const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'habibi.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    name TEXT,
    tier TEXT DEFAULT 'free',
    quota INTEGER DEFAULT 1000,
    used INTEGER DEFAULT 0,
    webhook_url TEXT,
    webhook_80_sent INTEGER DEFAULT 0,
    webhook_95_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Migrasi: tambah kolom tier kalau DB lama belum punya
  db.run(`ALTER TABLE keys ADD COLUMN tier TEXT DEFAULT 'free'`, () => {});
  // Webhook notifikasi kuota
  db.run(`ALTER TABLE keys ADD COLUMN webhook_url TEXT`, () => {});
  db.run(`ALTER TABLE keys ADD COLUMN webhook_80_sent INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE keys ADD COLUMN webhook_95_sent INTEGER DEFAULT 0`, () => {});
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
