// src/app.js
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const moduleAccess = require('./middleware/moduleAccess');
const logger = require('./utils/logger');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isLoopbackIp = (ip = '') => {
  const normalizedIp = ip.replace('::ffff:', '');
  return normalizedIp === '127.0.0.1' || normalizedIp === '::1' || normalizedIp === 'localhost';
};

// Route imports
const authRoutes         = require('./routes/auth');
const patientRoutes      = require('./routes/patients');
const appointmentRoutes  = require('./routes/appointments');
const emrRoutes          = require('./routes/emr');
const bedRoutes          = require('./routes/beds');
const icuRoutes          = require('./routes/icu');
const otRoutes           = require('./routes/ot');
const emergencyRoutes    = require('./routes/emergency');
const radiologyRoutes    = require('./routes/radiology');
const pharmacyRoutes     = require('./routes/pharmacy');
const billingRoutes      = require('./routes/billing');
const inventoryRoutes    = require('./routes/inventory');
const staffRoutes        = require('./routes/staff');
const ambulanceRoutes    = require('./routes/ambulance');
const dietaryRoutes      = require('./routes/dietary');
const complianceRoutes   = require('./routes/compliance');
const analyticsRoutes    = require('./routes/analytics');
const dashboardRoutes    = require('./routes/dashboard');
const superAdminRoutes   = require('./routes/superadmin');
const communicationRoutes = require('./routes/communication');
const mortuaryRoutes     = require('./routes/mortuary');
const medicineStackRoutes = require('./routes/medicineStacks');
const barcodeRoutes      = require('./routes/barcode');

const app = express();
app.set('trust proxy', 1);
// ── Security ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().toLowerCase())
  .filter(Boolean);

allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174');
}

app.use(cors({
  origin: (origin, callback) => {
if (!origin) return callback(null, true);

const normalizedOrigin = origin.toLowerCase();

if (
  allowedOrigins.includes(normalizedOrigin) ||
  normalizedOrigin.endsWith('.trycloudflare.com')
) {
  return callback(null, true);
}
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Hospital-ID', 'X-Request-ID'],
  maxAge: 86400,
}));

// ── Rate Limiting ─────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 1000),
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter auth rate limiting
const authRateLimitMax = parsePositiveInt(
  process.env.AUTH_RATE_LIMIT_MAX,
  process.env.NODE_ENV === 'production' ? 50 : 200
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  skip: (req) => isLoopbackIp(req.ip),
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// ── Body Parsing & Compression ────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Static Files (uploads) ────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MediCore HMS API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.get('/api/server-url', (req, res) => {
  res.json({
    url: process.env.PUBLIC_SERVER_URL || process.env.CLOUDFLARE_URL || `${req.protocol}://${req.get('host')}`
  });
});

const API = '/api';
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/patients`,      auth, moduleAccess('PATIENTS'), patientRoutes);
app.use(`${API}/appointments`,  auth, moduleAccess('APPOINTMENTS'), appointmentRoutes);
app.use(`${API}/emr`,           auth, moduleAccess('EMR'), emrRoutes);
app.use(`${API}/beds`,          auth, moduleAccess('BEDS'), bedRoutes);
app.use(`${API}/icu`,           auth, moduleAccess('ICU'), icuRoutes);
app.use(`${API}/ot`,            auth, moduleAccess('OT'), otRoutes);
app.use(`${API}/emergency`,     auth, moduleAccess('EMERGENCY'), emergencyRoutes);
app.use(`${API}/radiology`,     auth, moduleAccess('RADIOLOGY'), radiologyRoutes);
app.use(`${API}/pharmacy`,      auth, moduleAccess('PHARMACY'), pharmacyRoutes);
app.use(`${API}/billing`,       auth, moduleAccess('BILLING'), billingRoutes);
app.use(`${API}/inventory`,     auth, moduleAccess('INVENTORY'), inventoryRoutes);
app.use(`${API}/staff`,         auth, moduleAccess('STAFF'), staffRoutes);
app.use(`${API}/ambulance`,     auth, moduleAccess('AMBULANCE'), ambulanceRoutes);
app.use(`${API}/dietary`,       auth, moduleAccess('DIETARY'), dietaryRoutes);
app.use(`${API}/compliance`,    auth, moduleAccess('COMPLIANCE'), complianceRoutes);
app.use(`${API}/analytics`,     auth, moduleAccess('ANALYTICS'), analyticsRoutes);
app.use(`${API}/dashboard`,     auth, moduleAccess('DASHBOARD'), dashboardRoutes);
app.use(`${API}/superadmin`,    superAdminRoutes);
app.use(`${API}/communication`, auth, moduleAccess('COMMUNICATION'), communicationRoutes);
app.use(`${API}/mortuary`,      auth, moduleAccess('MORTUARY'), mortuaryRoutes);
app.use(`${API}/medicine-stacks`, auth, moduleAccess('MEDICINE_STACKS'), medicineStackRoutes);
app.use(`${API}/barcode`,       barcodeRoutes);
// ── React Production Build ────────────────────────────────────
const frontendPath = path.resolve(__dirname, '../../frontend/dist');

app.use(express.static(frontendPath, {
  index: false,
  extensions: ['html']
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
});
// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
