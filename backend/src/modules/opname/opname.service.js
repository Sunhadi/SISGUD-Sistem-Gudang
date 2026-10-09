const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { nextDocNumber } = require('../../utils/docNumber');
const { logAudit } = require('../../utils/audit');

async function listOpname(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(s.doc_no ILIKE $${params.length} OR s.note ILIKE $${params.length})`);
  }
  if (query.status) {
    params.push(query.status);
    where.push(`s.status = $${params.length}`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM stock_opname_sessions s ${sqlWhere}`,
    params
  );
  const res = await pool.query(
    `SELECT s.id, s.doc_no, s.status, s.note, s.created_at, s.approved_at,
            u.name AS created_by_name, ua.name AS approved_by_name,
            (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.session_id = s.id)::int AS total_items,
            (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.session_id = s.id AND oi.qty_counted IS NOT NULL)::int AS counted_items
     FROM stock_opname_sessions s
     LEFT JOIN users u ON u.id = s.created_by
     LEFT JOIN users ua ON ua.id = s.approved_by
     ${sqlWhere}
     ORDER BY s.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getOpname(id) {
  const res = await pool.query(
    `SELECT s.*, u.name AS created_by_name, ua.name AS approved_by_name
     FROM stock_opname_sessions s
     LEFT JOIN users u ON u.id = s.created_by
     LEFT JOIN users ua ON ua.id = s.approved_by
     WHERE s.id = $1`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('Sesi opname tidak ditemukan');

  const items = await pool.query(
    `SELECT oi.*, i.sku, i.name AS item_name, i.uom, l.code AS location_code
     FROM stock_opname_items oi
     JOIN items i ON i.id = oi.item_id
     JOIN locations l ON l.id = oi.location_id
     WHERE oi.session_id = $1
     ORDER BY oi.id`,
    [id]
  );
  const session = res.rows[0];
  session.items = items.rows;

  // Ringkasan selisih
  const diff = items.rows.filter((r) => r.qty_counted != null && r.qty_counted !== r.qty_system);
  session.diff_count = diff.length;
  session.diff_total = diff.reduce((acc, r) => acc + Math.abs(r.qty_counted - r.qty_system), 0);
  return session;
}

async function createOpname(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const docNo = await nextDocNumber(client, 'stock_opname_sessions', 'OP');
    const res = await client.query(
      `INSERT INTO stock_opname_sessions (doc_no, status, note, created_by)
       VALUES ($1, 'draft', $2, $3) RETURNING id`,
      [docNo, data.note ?? null, userId]
    );
    const sessionId = res.rows[0].id;

    if (data.items && data.items.length) {
      // Snapshot eksplisit: ambil qty sistem saat ini
      for (const it of data.items) {
        const stock = await client.query(
          `SELECT COALESCE(SUM(qty), 0)::int AS total FROM stocks
           WHERE item_id = $1 AND location_id = $2 AND status = 'available'`,
          [it.item_id, it.location_id]
        );
        await client.query(
          `INSERT INTO stock_opname_items (session_id, item_id, location_id, qty_system)
           VALUES ($1,$2,$3,$4)`,
          [sessionId, it.item_id, it.location_id, stock.rows[0].total]
        );
      }
    } else {
      // Snapshot seluruh stok aktif
      const all = await client.query(
        `SELECT item_id, location_id, SUM(qty)::int AS total FROM stocks
         WHERE qty > 0 GROUP BY item_id, location_id`
      );
      for (const row of all.rows) {
        await client.query(
          `INSERT INTO stock_opname_items (session_id, item_id, location_id, qty_system)
           VALUES ($1,$2,$3,$4)`,
          [sessionId, row.item_id, row.location_id, row.total]
        );
      }
    }

    const inserted = await client.query(
      `SELECT COUNT(*)::int AS total FROM stock_opname_items WHERE session_id = $1`,
      [sessionId]
    );
    if (inserted.rows[0].total === 0) {
      throw ApiError.badRequest('Tidak ada stok untuk diopname');
    }

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'create', entity: 'stock_opname_sessions', entityId: sessionId, detail: { doc_no: docNo } });
    return getOpname(sessionId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function countOpname(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await client.query(
      `SELECT * FROM stock_opname_sessions WHERE id = $1`,
      [id]
    );
    if (!session.rows[0]) throw ApiError.notFound('Sesi opname tidak ditemukan');
    if (!['draft', 'counting'].includes(session.rows[0].status)) {
      throw ApiError.badRequest(`Sesi sudah berstatus '${session.rows[0].status}'`);
    }

    for (const input of data.items) {
      const res = await client.query(
        `UPDATE stock_opname_items
         SET qty_counted = $1, note = COALESCE($2, note)
         WHERE session_id = $3 AND item_id = $4 AND location_id = $5
         RETURNING id`,
        [input.qty_counted, input.note ?? null, id, input.item_id, input.location_id]
      );
      if (res.rowCount === 0) {
        throw ApiError.badRequest('Item tidak ada dalam sesi ini');
      }
    }

    await client.query(
      `UPDATE stock_opname_sessions SET status = 'counting' WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'count', entity: 'stock_opname_sessions', entityId: id });
    return getOpname(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function submitOpname(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await client.query(`SELECT * FROM stock_opname_sessions WHERE id = $1`, [id]);
    if (!session.rows[0]) throw ApiError.notFound('Sesi opname tidak ditemukan');
    if (session.rows[0].status !== 'counting') {
      throw ApiError.badRequest('Sesi harus berstatus counting sebelum dikirim');
    }

    const unchecked = await client.query(
      `SELECT COUNT(*)::int AS total FROM stock_opname_items
       WHERE session_id = $1 AND qty_counted IS NULL`,
      [id]
    );
    if (unchecked.rows[0].total > 0) {
      throw ApiError.badRequest(`${unchecked.rows[0].total} item belum dihitung`);
    }

    await client.query(`UPDATE stock_opname_sessions SET status = 'review' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'submit', entity: 'stock_opname_sessions', entityId: id });
    return getOpname(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Approve supervisor: selisih → adjustment otomatis tercatat di stock_movements (type 'opname') */
async function approveOpname(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await client.query(`SELECT * FROM stock_opname_sessions WHERE id = $1 FOR UPDATE`, [id]);
    if (!session.rows[0]) throw ApiError.notFound('Sesi opname tidak ditemukan');
    if (session.rows[0].status !== 'review') {
      throw ApiError.badRequest('Sesi harus berstatus review untuk di-approve');
    }

    const items = await client.query(
      `SELECT * FROM stock_opname_items WHERE session_id = $1 FOR UPDATE`,
      [id]
    );

    for (const it of items.rows) {
      if (it.qty_counted == null) throw ApiError.badRequest('Ada item yang belum dihitung');
      const diff = it.qty_counted - it.qty_system;
      if (diff === 0) continue;

      // Sesuaikan stok available di lokasi tersebut
      await client.query(
        `DELETE FROM stocks WHERE item_id = $1 AND location_id = $2 AND status = 'available'`,
        [it.item_id, it.location_id]
      );
      if (it.qty_counted > 0) {
        await client.query(
          `INSERT INTO stocks (item_id, location_id, status, qty)
           VALUES ($1, $2, 'available', $3)
           ON CONFLICT (item_id, location_id, COALESCE(batch_no, ''), status)
           DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
          [it.item_id, it.location_id, it.qty_counted]
        );
      }

      // Catat mutasi: type 'opname'
      await client.query(
        `INSERT INTO stock_movements (item_id, from_location, to_location, qty, type, ref_type, ref_id, note, user_id)
         VALUES ($1, $2, $3, $4, 'opname', 'opname', $5, $6, $7)`,
        [
          it.item_id,
          diff < 0 ? it.location_id : null,
          diff > 0 ? it.location_id : null,
          Math.abs(diff),
          id,
          `Opname ${session.rows[0].doc_no}: ${it.qty_system} → ${it.qty_counted}${data.note ? ' — ' + data.note : ''}`,
          userId,
        ]
      );
    }

    await client.query(
      `UPDATE stock_opname_sessions
       SET status = 'approved', approved_by = $1, approved_at = NOW(),
           note = COALESCE($2, note)
       WHERE id = $3`,
      [userId, data.note ?? null, id]
    );

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'approve', entity: 'stock_opname_sessions', entityId: id });
    return getOpname(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Batalkan sesi (belum approved) */
async function cancelOpname(id, userId) {
  const res = await pool.query(
    `UPDATE stock_opname_sessions SET status = 'cancelled'
     WHERE id = $1 AND status IN ('draft','counting','review')
     RETURNING id, doc_no, status`,
    [id]
  );
  if (!res.rows[0]) {
    throw ApiError.badRequest('Sesi tidak ditemukan atau sudah approved');
  }
  await logAudit(pool, { userId, action: 'cancel', entity: 'stock_opname_sessions', entityId: id });
  return res.rows[0];
}

module.exports = {
  listOpname,
  getOpname,
  createOpname,
  countOpname,
  submitOpname,
  approveOpname,
  cancelOpname,
};
