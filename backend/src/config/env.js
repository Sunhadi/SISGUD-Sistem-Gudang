const path = require('path');

// Saat testing, muat .env.test bila ada (database khusus jest + supertest)
const envFile = process.env.NODE_ENV === 'test' ? '../../.env.test' : '../../.env';
require('dotenv').config({ path: path.resolve(__dirname, envFile) });

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  console.warn(`PERINGATAN: variabel env tidak lengkap: ${missing.join(', ')}`);
}

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.NODE_ENV === 'test'
    ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  env: process.env.NODE_ENV || 'development',
};
