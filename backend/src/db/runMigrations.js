/**
 * Menjalankan semua file SQL di src/db/migrations secara berurutan.
 * Mencatat migrasi yang sudah dijalankan di tabel `schema_migrations`.
 */
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = (await pool.query('SELECT filename FROM schema_migrations')).rows.map(
    (r) => r.filename
  );

  for (const file of files) {
    if (applied.includes(file)) {
      console.log(`  skip  ${file} (sudah dijalankan)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Jalankan per statement (pisahkan ';')
      const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ok    ${file}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`  GAGAL ${file}:`, e.message);
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }
  console.log('Migrasi selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
