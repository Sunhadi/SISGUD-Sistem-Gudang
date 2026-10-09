require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Keamanan & parsing
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '10mb' })); // cukup untuk import Excel base64
app.use(morgan('dev'));

// Rate limit global yang wajar (login punya limiter khusus lebih ketat)
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check (tanpa auth)
app.get('/api/v1/health', (req, res) => res.json({ success: true, data: 'ok' }));

// Routes
app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
app.use('/api/v1/users', require('./modules/users/users.routes'));
app.use('/api/v1/items', require('./modules/items/items.routes'));
app.use('/api/v1/locations', require('./modules/locations/locations.routes'));
app.use('/api/v1/suppliers', require('./modules/suppliers/suppliers.routes'));
app.use('/api/v1/customers', require('./modules/customers/customers.routes'));
app.use('/api/v1/inbound', require('./modules/inbound/inbound.routes'));
app.use('/api/v1/inventory', require('./modules/inventory/inventory.routes'));
app.use('/api/v1/opname', require('./modules/opname/opname.routes'));
app.use('/api/v1/outbound', require('./modules/outbound/outbound.routes'));
app.use('/api/v1/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api/v1/reports', require('./modules/reports/reports.routes'));

// 404 untuk route API yang tidak terdaftar
app.use('/api/', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan', errors: [] });
});

// Error handler seragam (harus terakhir)
app.use(errorHandler);

module.exports = app;
