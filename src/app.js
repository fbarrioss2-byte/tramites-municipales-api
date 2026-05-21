require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');

const tramitesRoutes   = require('./routes/tramitesRoutes');
const documentosRoutes = require('./routes/documentosRoutes');
const catastroRoutes   = require('./routes/catastroRoutes');
const usuariosRoutes   = require('./routes/usuariosRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ── Seguridad ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — acepta peticiones desde el frontend en Vercel ──────────────
const originesPermitidos = [
  'https://tramites-municipales-fwh8.vercel.app',
  'https://tramites-municipales-api-production.up.railway.app', // <-- AGREGA ESTA LÍNEA
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, Thunder Client, Railway health checks)
    if (!origin || originesPermitidos.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado para: ${origin}`));
    }
  },
  methods:      ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'test' ? 'silent' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check para Railway ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── Rutas ─────────────────────────────────────────────────────────────
app.use('/api/tramites',   tramitesRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/catastro',   catastroRoutes);
app.use('/api/usuarios',   usuariosRoutes);

// ── 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error handler (4 parámetros, siempre al final) ────────────────────
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`🌐 CORS habilitado para: ${originesPermitidos.join(', ')}`);
  });
}

module.exports = app;
