const express = require('express');
const https = require('https');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(new URL(res.headers.location, url).href));
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function fetchJSON(url) {
  return fetchText(url).then(t => JSON.parse(t));
}

// ============ 🤖 AI CHAT (trending!) ============
router.get('/ai/chat', checkKey, async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=...' });
  try {
    const answer = await fetchText(`https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai`);
    res.json({ status: true, tanya: text, jawab: answer.trim() });
  } catch (e) { res.status(500).json({ status: false, message: 'AI lagi sibuk, coba lagi' }); }
});

// ============ 🎨 AI IMAGE (trending!) ============
router.get('/ai/image', checkKey, (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) return res.status(400).json({ status: false, message: 'Kirim ?prompt=...' });
  const w = Math.min(parseInt(req.query.width) || 512, 1024);
  const h = Math.min(parseInt(req.query.height) || 512, 1024);
  // Redirect langsung ke gambar hasil AI
  res.redirect(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`);
});

// ============ 🎵 TIKTOK DOWNLOADER (trending!) ============
router.get('/download/tiktok', checkKey, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: false, message: 'Kirim ?url=link_tiktok' });
  try {
    const j = await fetchJSON(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    if (j.code !== 0) return res.status(400).json({ status: false, message: 'URL TikTok tidak valid' });
    const d = j.data;
    res.json({
      status: true,
      judul: d.title,
      author: d.author?.nickname || d.author?.unique_id,
      durasi: d.duration + ' detik',
      thumbnail: d.cover,
      musik: d.music_info?.title,
      video_nowm: d.play,           // tanpa watermark
      video_wm: d.wmplay,           // dengan watermark
      video_hd: d.hdplay,
    });
  } catch (e) { res.status(500).json({ status: false, message: 'Gagal ambil video TikTok' }); }
});

// ============ 🔊 TEXT TO SPEECH ============
router.get('/tools/tts', checkKey, (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).json({ status: false, message: 'Kirim ?text=...' });
  const lang = req.query.lang || 'id';
  if (text.length > 200) return res.status(400).json({ status: false, message: 'Maksimal 200 karakter' });
  res.redirect(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`);
});

// ============ 🟢 BRAT MAKER (meme trending!) ============
router.get('/canvas/brat', checkKey, async (req, res) => {
  const text = (req.query.text || 'brat').replace(/[<>&]/g, '').substring(0, 30);
  const format = (req.query.format || 'webp').toLowerCase();
  // Gaya brat ala bot: background putih, teks hitam Arial di atas, blur halus
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#FFFFFF"/>
    <foreignObject x="30" y="35" width="452" height="200">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;font-size:138px;color:#000;filter:blur(1.5px);text-align:left;line-height:1;white-space:nowrap;">${text}</div>
    </foreignObject>
  </svg>`;
  // Default webp (format stiker WA), ?format=svg buat SVG mentah
  if (format === 'svg') return res.set('Content-Type', 'image/svg+xml').send(svg);
  try {
    const sharp = require('sharp');
    const webp = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
    res.set('Content-Type', 'image/webp').send(webp);
  } catch (e) {
    res.set('Content-Type', 'image/svg+xml').send(svg);
  }
});

// ============ 🖼️ YOUTUBE THUMBNAIL ============
router.get('/download/yt-thumb', checkKey, (req, res) => {
  const url = req.query.url || '';
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (!m) return res.status(400).json({ status: false, message: 'Kirim URL YouTube valid' });
  res.redirect(`https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`);
});

module.exports = router;
