/**
 * Menjalankan seed (data awal). Password user di-hash dengan bcrypt.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const HASHES = {
  admin: 'admin123',
  supervisor: 'supervisor123',
  inbound: 'inbound123',
  outbound: 'outbound123',
  viewer: 'viewer123',
};

async function main() {
  let sql = fs.readFileSync(path.join(__dirname, 'seeds', '001_seed.sql'), 'utf8');

  // Hash password default
  for (const [key, plain] of Object.entries(HASHES)) {
    const hash = await bcrypt.hash(plain, 10);
    sql = sql.replaceAll(`__HASH_${key.toUpperCase()}__`, hash);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query('COMMIT');
    console.log('Seed berhasil dimasukkan.');
    console.log('Akun: admin@wms.local / admin123 (dan role lain sesuai README)');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Gagal seed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
