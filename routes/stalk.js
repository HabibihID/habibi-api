const express = require('express');
const https = require('https');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const BASE = 'https://api.isan.eu.org/nickname';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// Helper generik: proxy ke isan.eu.org dengan format seragam
function gameStalk(path, needZone = false) {
  return async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ status: false, message: 'Kirim ?id=PLAYER_ID' });
    const zone = req.query.zone;
    if (needZone && !zone) return res.status(400).json({ status: false, message: 'Kirim ?id=PLAYER_ID&zone=ZONE_ID' });
    try {
      let url = `${BASE}/${path}?id=${encodeURIComponent(id)}`;
      if (zone) url += `&zone=${encodeURIComponent(zone)}`;
      const j = await fetchJSON(url);
      if (!j.success) return res.status(404).json({ status: false, message: j.message || 'ID tidak ditemukan' });
      res.json({ status: true, game: j.game, id: j.id, nickname: j.name, server: j.server, negara: j.country });
    } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil data' }); }
  };
}

// ============ 🎮 GAME STALKER ============
router.get('/stalk/ff', checkKey, gameStalk('ff'));                    // Free Fire
router.get('/stalk/ml', checkKey, gameStalk('ml', true));              // Mobile Legends (+zone)
router.get('/stalk/aov', checkKey, gameStalk('aov'));                  // Arena of Valor
router.get('/stalk/codm', checkKey, gameStalk('cod'));                 // Call of Duty Mobile
router.get('/stalk/gi', checkKey, gameStalk('gi'));                    // Genshin Impact
router.get('/stalk/hsr', checkKey, gameStalk('hsr'));                  // Honkai Star Rail
router.get('/stalk/zzz', checkKey, gameStalk('zzz'));                 // Zenless Zone Zero
router.get('/stalk/valo', checkKey, gameStalk('valo'));                // Valorant
router.get('/stalk/pb', checkKey, gameStalk('pb'));                    // Point Blank
router.get('/stalk/sausageman', checkKey, gameStalk('sm'));           // Sausage Man
router.get('/stalk/supersus', checkKey, gameStalk('sus'));             // Super Sus
router.get('/stalk/aethergazer', checkKey, gameStalk('ag'));           // Aether Gazer
router.get('/stalk/pgr', checkKey, gameStalk('pgr'));                  // Punishing Gray Raven
router.get('/stalk/lifeafter', checkKey, gameStalk('la', true));       // LifeAfter (+zone)
router.get('/stalk/hi3', checkKey, gameStalk('hi'));                   // Honkai Impact 3rd

module.exports = router;
