const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
try { require('dotenv').config(); } catch (e) {}
const apiRoutes = require('./routes/api');
const islamiRoutes = require('./routes/islami');
const lainnyaRoutes = require('./routes/lainnya');
const extraRoutes = require('./routes/extra');
const downloadRoutes = require('./routes/download');
const trendingRoutes = require('./routes/trending');
const stalkRoutes = require('./routes/stalk');
const searchRoutes = require('./routes/search');
const threadsRoutes = require('./routes/threads');
const makerRoutes = require('./routes/maker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// CORS buat frontend Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key, X-Admin-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rate limit: 100 req / 15 menit per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { status: false, message: 'Kebanyakan request! Tunggu 15 menit.' }
});
app.use('/api/', limiter);

// Routes
app.use('/api', apiRoutes);
app.use('/api/islami', islamiRoutes);
app.use('/api', lainnyaRoutes);
app.use('/api', extraRoutes);
app.use('/api', downloadRoutes);
app.use('/api', trendingRoutes);
app.use('/api', stalkRoutes);
app.use('/api', searchRoutes);
app.use('/api', threadsRoutes);
app.use('/api', makerRoutes);
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/stats', (req, res) => res.sendFile(path.join(__dirname, 'public/stats.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/landing.html')));

// 404
app.use((req, res) => res.status(404).json({ status: false, message: 'Endpoint tidak ditemukan' }));

app.listen(PORT, () => {
  console.log(`🚀 Habibi API jalan di http://localhost:${PORT}`);
  console.log(`📖 Docs: http://localhost:${PORT}/docs`);
});
