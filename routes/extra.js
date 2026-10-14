const express = require('express');
const https = require('https');
const http = require('http');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

function fetchJSON(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 3) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJSON(new URL(res.headers.location, url).href, depth + 1));
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ 💰 CRYPTO ============
router.get('/crypto/harga', checkKey, async (req, res) => {
  const coin = (req.query.coin || 'bitcoin').toLowerCase();
  try {
    const j = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=idr,usd`);
    if (!j[coin]) return res.status(404).json({ status: false, message: 'Coin tidak ditemukan' });
    res.json({ status: true, coin, idr: 'Rp ' + j[coin].idr.toLocaleString('id-ID'), usd: '$' + j[coin].usd.toLocaleString() });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil harga crypto' }); }
});

// ============ 🔗 SHORTLINK (is.gd) ============
router.get('/shortlink', checkKey, async (req, res) => {
  if (!req.query.url) return res.status(400).json({ status: false, message: 'Kirim ?url=...' });
  try {
    const pendek = await new Promise((resolve, reject) => {
      https.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(req.query.url)}`,
        { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (r) => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => resolve(d.trim()));
        }).on('error', reject);
    });
    if (!pendek.startsWith('https://')) throw new Error('gagal');
    res.json({ status: true, asli: req.query.url, pendek });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal perpendek URL' }); }
});

// ============ 🌊 GEMPA BMKG ============
router.get('/gempa', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
    const g = j.Infogempa.gempa;
    res.json({ status: true, tanggal: g.Tanggal, jam: g.Jam, wilayah: g.Wilayah, magnitudo: g.Magnitude, kedalaman: g.Kedalaman, potensi: g.Potensi, map: 'https://data.bmkg.go.id/DataMKG/TEWS/' + g.Shakemap });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil data gempa' }); }
});

// ============ 🌐 TRANSLATE ============
router.get('/translate', checkKey, async (req, res) => {
  const { text, dari = 'id', ke = 'en' } = req.query;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=...&dari=id&ke=en' });
  try {
    const j = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${dari}|${ke}`);
    res.json({ status: true, dari, ke, asli: text, hasil: j.responseData.translatedText });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal translate' }); }
});

// ============ 📖 KAMUS INGGRIS ============
router.get('/kamus/:kata', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(req.params.kata)}`);
    const e = j[0];
    res.json({ status: true, kata: e.word, phonetic: e.phonetic, arti: e.meanings.slice(0, 3).map(m => ({ jenis: m.partOfSpeech, definisi: m.definitions[0]?.definition, contoh: m.definitions[0]?.example || '-' })) });
  } catch (e) { res.status(404).json({ status: false, message: 'Kata tidak ditemukan' }); }
});

// ============ 🖼️ MEME ============
router.get('/meme', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://meme-api.com/gimme');
    res.json({ status: true, judul: j.title, subreddit: j.subreddit, url: j.url });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil meme' }); }
});

// ============ 🐕🐱 HEWAN ============
router.get('/hewan/anjing', checkKey, async (req, res) => {
  try { const j = await fetchJSON('https://dog.ceo/api/breeds/image/random'); res.json({ status: true, url: j.message }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});
router.get('/hewan/kucing', checkKey, async (req, res) => {
  try { const j = await fetchJSON('https://api.thecatapi.com/v1/images/search'); res.json({ status: true, url: j[0].url }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});

// ============ 💡 SARAN & FAKTA ============
router.get('/saran', checkKey, async (req, res) => {
  try { const j = await fetchJSON('https://api.adviceslip.com/advice'); res.json({ status: true, saran: j.slip.advice }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});
router.get('/fakta-angka/:angka', checkKey, async (req, res) => {
  try {
    const t = await new Promise((resolve, reject) => {
      http.get(`http://numbersapi.com/${req.params.angka}`, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
      }).on('error', reject);
    });
    res.json({ status: true, angka: req.params.angka, fakta: t });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});

// ============ 👤 RANDOM USER ============
router.get('/random/user', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://randomuser.me/api/?inc=name,email,phone,picture,nat');
    const u = j.results[0];
    res.json({ status: true, nama: `${u.name.first} ${u.name.last}`, email: u.email, telepon: u.phone, negara: u.nat, foto: u.picture.large });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});

// ============ 🔮 TEBAK UMUR & GENDER ============
router.get('/tebak/umur', checkKey, async (req, res) => {
  if (!req.query.nama) return res.status(400).json({ status: false, message: 'Kirim ?nama=...' });
  try { const j = await fetchJSON(`https://api.agify.io?name=${encodeURIComponent(req.query.nama)}`); res.json({ status: true, nama: j.name, prediksiUmur: j.age, sampel: j.count }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});
router.get('/tebak/gender', checkKey, async (req, res) => {
  if (!req.query.nama) return res.status(400).json({ status: false, message: 'Kirim ?nama=...' });
  try { const j = await fetchJSON(`https://api.genderize.io?name=${encodeURIComponent(req.query.nama)}`); res.json({ status: true, nama: j.name, gender: j.gender, akurasi: Math.round(j.probability * 100) + '%' }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});

// ============ 📦 NPM & GITHUB ============
router.get('/npm/:package', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON(`https://registry.npmjs.org/${encodeURIComponent(req.params.package)}/latest`);
    res.json({ status: true, nama: j.name, versi: j.version, deskripsi: j.description, homepage: j.homepage });
  } catch (e) { res.status(404).json({ status: false, message: 'Package tidak ditemukan' }); }
});
router.get('/github/:username', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(req.params.username)}`);
    res.json({ status: true, username: j.login, nama: j.name, bio: j.bio, repos: j.public_repos, followers: j.followers, avatar: j.avatar_url });
  } catch (e) { res.status(404).json({ status: false, message: 'User tidak ditemukan' }); }
});

// ============ 🎲 AKTIVITAS RANDOM ============
router.get('/aktivitas', checkKey, async (req, res) => {
  try { const j = await fetchJSON('https://bored.api.lewagon.com/api/activity'); res.json({ status: true, aktivitas: j.activity, tipe: j.type, peserta: j.participants }); }
  catch (e) { res.status(500).json({ status: false, message: 'Gagal' }); }
});

module.exports = router;
