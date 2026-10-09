const pool = require('../config/db');

/**
 * Catat aksi ke audit_logs.
 * @param {import('pg').Pool|import('pg').PoolClient} client - pool atau client transaction
 */
async function logAudit(client, { userId, action, entity, entityId, detail, ip }) {
  const c = client || pool;
  try {
    await c.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entity, entityId != null ? String(entityId) : null, detail || {}, ip || null]
    );
  } catch (err) {
    // Audit tidak boleh menggagalkan transaksi utama
    console.error('Gagal menulis audit log:', err.message);
  }
}

module.exports = { logAudit };
