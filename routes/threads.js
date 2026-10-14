// ============ 🧵 THREADS DOWNLOADER (Puppeteer + headless Chrome) ============
// Threads tidak punya API publik & yt-dlp tidak support.
// Satu-satunya cara: buka pakai browser beneran, ambil video dari halamannya.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();
const CACHE_TTL = 3600;

let browser = null;
async function getBrowser() {
  if (browser) return browser;
  const puppeteer = require('puppeteer');
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-crashpad', '--no-first-run', '--no-zygote',
    ],
  });
  return browser;
}

// Ambil video URL dari halaman Threads
async function scrapeThreads(url) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Tunggu konten muncul
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const out = { videos: [], images: [], text: '', author: '' };

      // Cari video elements
      document.querySelectorAll('video').forEach(v => {
        if (v.src) out.videos.push(v.src);
        v.querySelectorAll('source').forEach(s => { if (s.src) out.videos.push(s.src); });
      });

      // Cari di JSON-LD / script tags
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const j = JSON.parse(s.textContent);
          const items = Array.isArray(j) ? j : [j];
          items.forEach(it => {
            if (it.video && it.video.contentUrl) out.videos.push(it.video.contentUrl);
            if (it.image) {
              const imgs = Array.isArray(it.image) ? it.image : [it.image];
              imgs.forEach(i => out.images.push(typeof i === 'string' ? i : i.url));
            }
            if (it.articleBody) out.text = it.articleBody;
            if (it.author && it.author.name) out.author = it.author.name;
          });
        } catch {}
      });

      // Cari video URL di seluruh HTML (fallback)
      const html = document.documentElement.innerHTML;
      const matches = html.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/g) || [];
      matches.forEach(m => { if (!out.videos.includes(m)) out.videos.push(m); });

      // Author dari meta
      const authorMeta = document.querySelector('meta[property="og:title"]');
      if (authorMeta && !out.author) out.author = authorMeta.content.split(' ')[0];

      const descMeta = document.querySelector('meta[property="og:description"]');
      if (descMeta && !out.text) out.text = descMeta.content;

      const imgMeta = document.querySelector('meta[property="og:image"]');
      if (imgMeta) out.images.unshift(imgMeta.content);

      return out;
    });

    // Filter & dedup video URLs
    data.videos = [...new Set(data.videos)].filter(v =>
      v.includes('.mp4') || v.includes('video') || v.includes('fbcdn')
    ).slice(0, 5);
    data.images = [...new Set(data.images)].slice(0, 5);

    return data;
  } finally {
    await page.close();
  }
}

router.get('/download/threads', checkKey, async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url) return res.status(400).json({ status: false, message: 'Kirim ?url=link_threads' });
  if (!/threads\.(com|net)/i.test(url)) {
    return res.status(400).json({ status: false, message: 'URL bukan Threads' });
  }

  const hash = 'threads_' + crypto.createHash('sha256').update(url).digest('hex');
  const now = Math.floor(Date.now() / 1000);

  db.get('SELECT data, created_at FROM dl_cache WHERE url_hash = ?', [hash], async (err, row) => {
    if (row && (now - row.created_at) < CACHE_TTL) {
      const data = JSON.parse(row.data);
      data.cached = true;
      return res.json(data);
    }
    try {
      const data = await scrapeThreads(url);
      const out = {
        status: true, cached: false, platform: 'Threads',
        author: data.author || null,
        text: data.text ? data.text.substring(0, 500) : null,
        videos: data.videos,
        images: data.images,
        video: data.videos[0] || null,
        note: data.videos.length ? null : 'Tidak ada video di post ini (mungkin foto/teks saja)',
      };
      db.run('INSERT OR REPLACE INTO dl_cache (url_hash, data, created_at) VALUES (?, ?, ?)',
        [hash, JSON.stringify(out), now]);
      res.json(out);
    } catch (e) {
      res.status(502).json({ status: false, message: 'Gagal buka halaman Threads: ' + String(e.message).slice(0, 150) });
    }
  });
});

module.exports = router;
