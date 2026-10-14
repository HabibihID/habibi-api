// === CONTOH ENDPOINT: download info (rawan blokir IP — baca pola amannya) ===
// Pola anti-blokir yang dipakai di sini:
//  1. Cache agresif: URL yang sama tidak di-hit ulang selama 1 jam (SQLite)
//  2. Satu panggilan yt-dlp per request, dengan timeout 30 detik
//  3. User-Agent dirotasi tiap request (kurangi jejak bot)
//  4. URL divalidasi + SSRF guard (tolak localhost/IP privat)
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const { execFile } = require('child_process');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const CACHE_TTL = 3600; // 1 jam — URL sama tidak hit layanan luar lagi

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
];

function validUrl(u) {
  try {
    const p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return false;
    const h = p.hostname.toLowerCase();
    // SSRF guard: tolak target internal
    if (h === 'localhost' || h.endsWith('.localhost')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return false;
    const m = h.match(/^172\.(\d+)\./);
    if (m && +m[1] >= 16 && +m[1] <= 31) return false;
    return true;
  } catch { return false; }
}

function ytdlpJson(url) {
  return new Promise((resolve, reject) => {
    const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
    execFile('yt-dlp',
      ['--dump-json', '--no-playlist', '--no-warnings',
       '--socket-timeout', '12', '--user-agent', ua, url],
      { timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          if (err.code === 'ENOENT') return reject({ status: 503, message: 'yt-dlp belum terinstall di server. Install: pip install yt-dlp' });
          return reject({ status: 502, message: 'Gagal ambil info video: ' + String(err.message).slice(0, 200) });
        }
        try { resolve(JSON.parse(stdout)); }
        catch { reject({ status: 502, message: 'Respons yt-dlp tidak valid' }); }
      });
  });
}

function pickBest(j) {
  // Pilih direct URL mp4 yang ringan (<=720p) biar hemat bandwidth
  const fmts = (j.formats || []).filter(f => f.url && f.ext === 'mp4' && f.vcodec !== 'none');
  fmts.sort((a, b) => (a.height || 0) - (b.height || 0));
  const small = fmts.filter(f => (f.height || 0) <= 720);
  const pick = small[small.length - 1] || fmts[0];
  return pick ? { url: pick.url, quality: pick.height ? pick.height + 'p' : 'audio/video', ext: pick.ext } : null;
}

router.get('/download/info', checkKey, (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ status: false, message: 'Kirim ?url=link_video' });
  if (!validUrl(url)) return res.status(400).json({ status: false, message: 'URL tidak valid / tidak diizinkan' });

  const hash = crypto.createHash('sha256').update(url).digest('hex');
  const now = Math.floor(Date.now() / 1000);

  // 1. Cek cache dulu — URL sama = tanpa hit layanan luar sama sekali
  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return res.json(data);
    }
    // 2. Cache miss → 1x panggilan yt-dlp
    ytdlpJson(url).then(j => {
      const out = {
        status: true,
        cached: false,
        title: j.title,
        duration: j.duration,
        uploader: j.uploader || j.channel,
        thumbnail: j.thumbnail,
        webpage_url: j.webpage_url,
        source: j.extractor,
        download: pickBest(j),
      };
      db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
        [hash, JSON.stringify(out), now]);
      res.json(out);
    }).catch(e => {
      res.status(e.status || 500).json({ status: false, message: e.message || 'Error' });
    });
  });
});

// ============ DOWNLOADER PER-PLATFORM (yt-dlp backend) ============
// Daftar platform yang didukung penuh via yt-dlp
const PLATFORMS = {
  youtube:   { name: 'YouTube',   match: /(youtube\.com|youtu\.be)/ },
  facebook:  { name: 'Facebook',  match: /(facebook\.com|fb\.watch)/ },
  instagram: { name: 'Instagram', match: /(instagram\.com)/ },
  twitter:   { name: 'Twitter/X', match: /(twitter\.com|x\.com)/ },
  douyin:    { name: 'Douyin',    match: /(douyin\.com|v\.douyin\.com)/ },
  dailymotion: { name: 'Dailymotion', match: /(dailymotion\.com|dai\.ly)/ },
  vimeo:     { name: 'Vimeo',     match: /(vimeo\.com)/ },
  twitch:    { name: 'Twitch',    match: /(twitch\.tv)/ },
  reddit:    { name: 'Reddit',    match: /(reddit\.com)/ },
  pinterest: { name: 'Pinterest', match: /(pinterest\.com|pin\.it)/ },
  soundcloud:{ name: 'SoundCloud', match: /(soundcloud\.com)/ },
  capcut:    { name: 'CapCut',    match: /(capcut\.com)/ },
};

function platformDownload(platformKey) {
  const pf = PLATFORMS[platformKey];
  return (req, res) => {
    const url = (req.query.url || '').trim();
    if (!url) return res.status(400).json({ status: false, message: `Kirim ?url=link_${pf.name}` });
    if (!validUrl(url)) return res.status(400).json({ status: false, message: 'URL tidak valid' });
    if (!pf.match.test(url)) return res.status(400).json({ status: false, message: `URL bukan ${pf.name}` });

    const hash = 'pf_' + crypto.createHash('sha256').update(url).digest('hex');
    const now = Math.floor(Date.now() / 1000);

    db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
      if (row && (now - row.created_at) < CACHE_TTL) {
        const data = JSON.parse(row.data);
        data.cached = true;
        return res.json(data);
      }
      ytdlpJson(url).then(j => {
        // Semua format video yang tersedia
        const formats = (j.formats || [])
          .filter(f => f.url && f.ext === 'mp4' && f.vcodec !== 'none')
          .map(f => ({ quality: (f.height || 0) + 'p', size: f.filesize ? Math.round(f.filesize/1024/1024)+'MB' : '?', url: f.url }))
          .sort((a, b) => parseInt(b.quality) - parseInt(a.quality))
          .slice(0, 8);
        // Audio only
        const audios = (j.formats || [])
          .filter(f => f.url && f.acodec !== 'none' && f.vcodec === 'none')
          .slice(0, 3)
          .map(f => ({ ext: f.ext, bitrate: f.abr ? Math.round(f.abr)+'kbps' : '?', url: f.url }));
        const out = {
          status: true, cached: false, platform: pf.name,
          title: j.title, duration: j.duration,
          uploader: j.uploader || j.channel,
          thumbnail: j.thumbnail, webpage_url: j.webpage_url,
          formats, audio: audios,
          best: formats[0] || null,
        };
        db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
          [hash, JSON.stringify(out), now]);
        res.json(out);
      }).catch(e => {
        res.status(e.status || 500).json({ status: false, message: e.message || 'Gagal ambil video' });
      });
    });
  };
}

for (const key of Object.keys(PLATFORMS)) {
  router.get(`/download/${key}`, checkKey, platformDownload(key));
}

// ============ 🔍 YOUTUBE SEARCH (play) ============
router.get('/download/yt-search', checkKey, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ status: false, message: 'Kirim ?q=kata_kunci' });
  const n = Math.min(parseInt(req.query.limit) || 10, 20);

  const hash = 'ytsearch_' + crypto.createHash('sha256').update(q).digest('hex');
  const now = Math.floor(Date.now() / 1000);

  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return res.json(data);
    }
    const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
    execFile('yt-dlp',
      ['--dump-json', '--flat-playlist', '--no-warnings',
       '--socket-timeout', '12', '--user-agent', ua,
       `ytsearch${n}:${q}`],
      { timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return res.status(502).json({ status: false, message: 'Gagal search YouTube' });
        try {
          const results = stdout.trim().split('\n')
            .filter(Boolean)
            .map(l => JSON.parse(l))
            .map(v => ({
              id: v.id,
              judul: v.title,
              durasi: v.duration,
              uploader: v.uploader,
              thumbnail: v.thumbnail,
              url: v.webpage_url || `https://youtu.be/${v.id}`,
              dl_mp4: `/api/download/youtube?url=${encodeURIComponent(v.webpage_url || `https://youtu.be/${v.id}`)}`,
              dl_mp3: `/api/download/mp3?url=${encodeURIComponent(v.webpage_url || `https://youtu.be/${v.id}`)}`,
            }));
          const out = { status: true, cached: false, query: q, total: results.length, results };
          db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
            [hash, JSON.stringify(out), now]);
          res.json(out);
        } catch { res.status(502).json({ status: false, message: 'Gagal parse hasil' }); }
      });
  });
});

// ============ 🕵️ STALKER ============
// Catatan: YouTube channel stalk dihapus — YouTube memblokir akses bot ke halaman channel.
// TikTok/IG stalk juga tidak ada API gratis yang stabil saat ini.

// GitHub Stalk (lengkap)
router.get('/stalk/github', checkKey, async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ status: false, message: 'Kirim ?username=' });
  try {
    const [u, repos] = await Promise.all([
      fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`),
      fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=5&sort=updated`),
    ]);
    res.json({
      status: true,
      username: u.login, nama: u.name, bio: u.bio,
      avatar: u.avatar_url, lokasi: u.location, blog: u.blog,
      repos: u.public_repos, followers: u.followers, following: u.following,
      dibuat: u.created_at?.substring(0, 10),
      repo_terbaru: repos.map(r => ({ nama: r.name, bahasa: r.language, stars: r.stargazers_count })),
    });
  } catch (e) { res.status(404).json({ status: false, message: 'User tidak ditemukan' }); }
});
router.get('/download/mp3', checkKey, (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ status: false, message: 'Kirim ?url=link_video' });
  if (!validUrl(url)) return res.status(400).json({ status: false, message: 'URL tidak valid' });

  const hash = 'mp3_' + crypto.createHash('sha256').update(url).digest('hex');
  const now = Math.floor(Date.now() / 1000);

  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return res.json(data);
    }
    ytdlpJson(url).then(j => {
      const audios = (j.formats || [])
        .filter(f => f.url && f.acodec !== 'none' && f.vcodec === 'none')
        .map(f => ({
          ext: f.ext,
          bitrate: f.abr ? Math.round(f.abr) + 'kbps' : '?',
          size: f.filesize ? Math.round(f.filesize/1024/1024*100)/100 + 'MB' : '?',
          url: f.url,
        }))
        .sort((a, b) => parseInt(b.bitrate) - parseInt(a.bitrate));
      const out = {
        status: true, cached: false,
        title: j.title, uploader: j.uploader || j.channel,
        thumbnail: j.thumbnail, duration: j.duration,
        audio_list: audios,
        best_audio: audios[0] || null,
        note: 'Direct URL audio (m4a/webm/opus). Untuk MP3 murni, convert via ffmpeg.',
      };
      db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
        [hash, JSON.stringify(out), now]);
      res.json(out);
    }).catch(e => {
      res.status(e.status || 500).json({ status: false, message: e.message || 'Gagal' });
    });
  });
});

module.exports = router;
