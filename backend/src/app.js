require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const morgan       = require('morgan');
const passport     = require('./config/passport');
const logger       = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// ─── Route modules ───────────────────────────────────────────────
const authRoutes     = require('./modules/auth/auth.routes');
const usersRoutes    = require('./modules/users/users.routes');
const coursesRoutes  = require('./modules/courses/courses.routes');
const progressRoutes = require('./modules/progress/progress.routes');
const ordersRoutes   = require('./modules/orders/orders.routes');
const trackingRoutes   = require('./modules/tracking/tracking.routes');
const adminRoutes      = require('./modules/admin/admin.routes');
const documentsRoutes  = require('./modules/documents/documents.routes');

const app = express();

// ─── Security & compression ──────────────────────────────────────
app.use(helmet());
app.use(compression());
app.set('trust proxy', 1);

// ─── CORS ────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── Body parsers ────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Passport ────────────────────────────────────────────────────
app.use(passport.initialize());

// ─── Health check (no rate limit) ───────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ─── API Routes ──────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth',     authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/courses',  coursesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/orders',   ordersRoutes);
app.use('/api/track',     trackingRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/documents', documentsRoutes);

// ─── 404 handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler (must be last) ─────────────────────────
app.use(errorHandler);

module.exports = app;
