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

// ============ 🟥 ROBLOX STALKER ============
// Pakai official Roblox API (gratis, tanpa key)
router.get('/stalk/roblox', checkKey, async (req, res) => {
  const username = (req.query.username || '').trim();
  if (!username) return res.status(400).json({ status: false, message: 'Kirim ?username=NAMA_ROBLOX' });
  try {
    // 1. Cari user ID dari username
    const lookup = await fetch(`https://users.roblox.com/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    }).then(r => r.json());
    const user = lookup.data && lookup.data[0];
    if (!user) return res.status(404).json({ status: false, message: 'Username tidak ditemukan' });

    // 2. Ambil detail profil + avatar + status (paralel)
    const [detail, avatar, friends] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${user.id}`).then(r => r.json()),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=180x180&format=Png&isCircular=false`).then(r => r.json()).catch(() => ({})),
      fetch(`https://friends.roblox.com/v1/users/${user.id}/friends/count`).then(r => r.json()).catch(() => ({})),
    ]);
    res.json({
      status: true,
      id: user.id,
      username: user.name,
      display_name: user.displayName,
      verified_badge: !!user.hasVerifiedBadge,
      bio: detail.description || '',
      dibuat: detail.created ? detail.created.substring(0, 10) : null,
      banned: !!detail.isBanned,
      jumlah_teman: friends.count ?? null,
      avatar: avatar.data && avatar.data[0] ? avatar.data[0].imageUrl : null,
      profil: `https://www.roblox.com/users/${user.id}/profile`,
    });
  } catch (e) {
    res.status(500).json({ status: false, message: 'Gagal ambil data Roblox' });
  }
});

module.exports = router;
