const express = require('express');
const https = require('https');
const { checkKey } = require('../middleware/apikey');

const router = express.Router();

// Helper fetch JSON (ikutin redirect, support relatif)
function fetchJSON(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 3) return reject(new Error('Too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'HabibiAPI/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        return resolve(fetchJSON(next, depth + 1));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// 🕌 Jadwal sholat (Aladhan API)
router.get('/jadwal-sholat', checkKey, async (req, res) => {
  const kota = req.query.kota || 'Jakarta';
  try {
    const j = await fetchJSON(
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(kota)}&country=Indonesia&method=20`
    );
    const t = j.data.timings;
    res.json({
      status: true, kota,
      tanggal: j.data.date.readable,
      hijriah: j.data.date.hijri.date,
      jadwal: {
        imsak: t.Imsak, subuh: t.Fajr, terbit: t.Sunrise,
        dzuhur: t.Dhuhr, ashar: t.Asr,
        maghrib: t.Maghrib, isya: t.Isha
      }
    });
  } catch (e) {
    res.status(500).json({ status: false, message: 'Gagal ambil jadwal sholat' });
  }
});

// 📖 Daftar surah (Quran.com API)
router.get('/quran/surah', checkKey, async (req, res) => {
  try {
    const j = await fetchJSON('https://api.quran.com/api/v4/chapters?language=id');
    res.json({
      status: true,
      total: j.chapters.length,
      surah: j.chapters.map(s => ({
        nomor: s.id, nama: s.name_arabic, namaLatin: s.name_simple,
        jumlahAyat: s.verses_count,
        tempatTurun: s.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'
      }))
    });
  } catch (e) {
    res.status(500).json({ status: false, message: 'Gagal ambil daftar surah' });
  }
});

// 📖 Ayat per surah (arab + terjemahan Indonesia)
router.get('/quran/surah/:nomor', checkKey, async (req, res) => {
  try {
    const nomor = req.params.nomor;
    const [ch, vs] = await Promise.all([
      fetchJSON(`https://api.quran.com/api/v4/chapters/${nomor}?language=id`),
      fetchJSON(`https://api.quran.com/api/v4/verses/by_chapter/${nomor}?language=id&words=false&translations=33&fields=text_uthmani&per_page=300`)
    ]);
    res.json({
      status: true,
      surah: { nomor: ch.chapter.id, namaLatin: ch.chapter.name_simple, jumlahAyat: ch.chapter.verses_count },
      ayat: vs.verses.map(v => ({
        nomorAyat: v.verse_number,
        arab: v.text_uthmani,
        indonesia: v.translations[0] ? v.translations[0].text.replace(/<[^>]+>/g, '') : ''
      }))
    });
  } catch (e) {
    res.status(500).json({ status: false, message: 'Surah tidak ditemukan' });
  }
});

// 📅 Tanggal hijriah hari ini
router.get('/hijriah', checkKey, async (req, res) => {
  try {
    const now = new Date();
    const d = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
    const j = await fetchJSON(`https://api.aladhan.com/v1/gToH?date=${d}`);
    const h = j.data.hijri;
    res.json({
      status: true,
      masehi: d,
      hijriah: `${h.day} ${h.month.en} ${h.year} H`,
      hijriahId: `${h.day} ${h.month.ar} ${h.year} H`
    });
  } catch (e) {
    res.status(500).json({ status: false, message: 'Gagal konversi tanggal' });
  }
});

// 🤲 Doa harian (data lokal, anti blokir)
const DOA = [
  { judul: "Doa Sebelum Makan", arab: "اَللّٰهُمَّ بَارِكْ لَنَا فِيْمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ", latin: "Allahumma barik lana fima razaqtana waqina 'adzabannar", arti: "Ya Allah, berkahilah rezeki yang Engkau berikan kepada kami dan peliharalah kami dari siksa api neraka" },
  { judul: "Doa Sesudah Makan", arab: "اَلْحَمْدُ لِلّٰهِ الَّذِيْٓ اَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مِنَ الْمُسْلِمِيْنَ", latin: "Alhamdulillahilladzi ath'amana wasaqana waja'alana minal muslimin", arti: "Segala puji bagi Allah yang telah memberi kami makan dan minum serta menjadikan kami termasuk orang-orang Islam" },
  { judul: "Doa Sebelum Tidur", arab: "بِسْمِكَ اللّٰهُمَّ اَحْيَا وَاَمُوْتُ", latin: "Bismikallahumma ahya wa amut", arti: "Dengan nama-Mu ya Allah, aku hidup dan aku mati" },
  { judul: "Doa Bangun Tidur", arab: "اَلْحَمْدُ لِلّٰهِ الَّذِيْٓ اَحْيَانَا بَعْدَ مَآ اَمَاتَنَا وَاِلَيْهِ النُّشُوْرُ", latin: "Alhamdulillahilladzi ahyana ba'da ma amatana wa ilaihinnusyur", arti: "Segala puji bagi Allah yang telah menghidupkan kami setelah mematikan kami dan kepada-Nya kami kembali" },
  { judul: "Doa Masuk Masjid", arab: "اَللّٰهُمَّ افْتَحْ لِيْٓ اَبْوَابَ رَحْمَتِكَ", latin: "Allahummaftahli abwaba rahmatik", arti: "Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu" },
];
router.get('/doa', checkKey, (req, res) => {
  res.json({ status: true, total: DOA.length, doa: DOA });
});

// ✨ Asmaul Husna (data lokal, anti blokir)
const ASMAUL = [
  "Ar-Rahman (Maha Pengasih)", "Ar-Rahim (Maha Penyayang)", "Al-Malik (Maha Merajai)",
  "Al-Quddus (Maha Suci)", "As-Salam (Maha Sejahtera)", "Al-Mu'min (Maha Pemberi Keamanan)",
  "Al-Muhaimin (Maha Pemelihara)", "Al-Aziz (Maha Perkasa)", "Al-Jabbar (Maha Kuasa)",
  "Al-Mutakabbir (Maha Megah)"
];
router.get('/asmaul-husna', checkKey, (req, res) => {
  res.json({ status: true, catatan: "10 dari 99 — contoh", asmaulHusna: ASMAUL });
});

module.exports = router;
