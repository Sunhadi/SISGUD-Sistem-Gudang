const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');

// ---------------------------------------------------------------
// Helper
// ---------------------------------------------------------------

async function upsertStock(client, { itemId, locationId, qty, batchNo, expiryDate, status }) {
  await client.query(
    `INSERT INTO stocks (item_id, location_id, batch_no, expiry_date, status, qty)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (item_id, location_id, COALESCE(batch_no, ''), status)
     DO UPDATE SET qty = stocks.qty + EXCLUDED.qty, updated_at = NOW()`,
    [itemId, locationId, batchNo ?? null, expiryDate ?? null, status, qty]
  );
}

async function recordMovement(client, { itemId, fromLoc, toLoc, qty, type, batchNo, refType, refId, note, userId }) {
  await client.query(
    `INSERT INTO stock_movements (item_id, from_location, to_location, qty, type, batch_no, ref_type, ref_id, note, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [itemId, fromLoc ?? null, toLoc ?? null, qty, type, batchNo ?? null, refType ?? null, refId ?? null, note ?? null, userId ?? null]
  );
}

async function getLocationRow(client, id) {
  const res = await client.query(`SELECT * FROM locations WHERE id = $1 AND is_active = TRUE`, [id]);
  if (!res.rows[0]) throw ApiError.notFound('Lokasi tidak ditemukan atau tidak aktif');
  return res.rows[0];
}

// ---------------------------------------------------------------
// Daftar stok
// ---------------------------------------------------------------

async function listStocks(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = ['s.qty > 0'];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(i.sku ILIKE $${params.length} OR i.name ILIKE $${params.length})`);
  }
  if (query.item_id) { params.push(query.item_id); where.push(`s.item_id = $${params.length}`); }
  if (query.location_id) { params.push(query.location_id); where.push(`s.location_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`s.status = $${params.length}`); }
  if (query.batch_no) { params.push(query.batch_no); where.push(`s.batch_no = $${params.length}`); }

  const sqlWhere = `WHERE ${where.join(' AND ')}`;
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM stocks s JOIN items i ON i.id = s.item_id ${sqlWhere}`,
    params
  );
  const res = await pool.query(
    `SELECT s.id, s.item_id, i.sku, i.name, i.uom, i.barcode,
            s.location_id, l.code AS location_code, l.zone,
            s.batch_no, s.expiry_date, s.status, s.qty, s.received_at, s.updated_at
     FROM stocks s
     JOIN items i ON i.id = s.item_id
     JOIN locations l ON l.id = s.location_id
     ${sqlWhere}
     ORDER BY i.sku, s.location_id, s.received_at
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function stockSummary(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(i.sku ILIKE $${params.length} OR i.name ILIKE $${params.length})`);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM (
       SELECT i.id FROM items i LEFT JOIN stocks s ON s.item_id = i.id
       ${sqlWhere.replace(/WHERE/, 'WHERE')} GROUP BY i.id
     ) t`,
    params
  );
  const res = await pool.query(
    `SELECT i.id AS item_id, i.sku, i.name, i.uom, i.min_stock, i.barcode,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)::int AS qty_available,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'reserved'), 0)::int AS qty_reserved,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'hold'), 0)::int AS qty_hold,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'rejected'), 0)::int AS qty_rejected,
            COALESCE(SUM(s.qty), 0)::int AS qty_total,
            COUNT(DISTINCT s.location_id)::int AS location_count
     FROM items i LEFT JOIN stocks s ON s.item_id = i.id
     ${sqlWhere}
     GROUP BY i.id
     ORDER BY i.sku
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function listMovements(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];

  if (query.item_id) { params.push(query.item_id); where.push(`m.item_id = $${params.length}`); }
  if (query.location_id) {
    params.push(query.location_id);
    where.push(`(m.from_location = $${params.length} OR m.to_location = $${params.length})`);
  }
  if (query.type) { params.push(query.type); where.push(`m.type = $${params.length}`); }
  if (query.ref_type) { params.push(query.ref_type); where.push(`m.ref_type = $${params.length}`); }
  if (query.ref_id) { params.push(query.ref_id); where.push(`m.ref_id = $${params.length}`); }
  if (query.date_from) { params.push(query.date_from); where.push(`m.created_at::date >= $${params.length}`); }
  if (query.date_to) { params.push(query.date_to); where.push(`m.created_at::date <= $${params.length}`); }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM stock_movements m ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT m.*, i.sku, i.name AS item_name, i.uom,
            lf.code AS from_location_code, lt.code AS to_location_code,
            u.name AS user_name
     FROM stock_movements m
     JOIN items i ON i.id = m.item_id
     LEFT JOIN locations lf ON lf.id = m.from_location
     LEFT JOIN locations lt ON lt.id = m.to_location
     LEFT JOIN users u ON u.id = m.user_id
     ${sqlWhere}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function stockCard(itemId, query) {
  const { page, limit, offset } = pageOpts(query);
  const params = [itemId];
  const dateFilter = [];
  if (query.date_from) { params.push(query.date_from); dateFilter.push(`m.created_at::date >= $${params.length}`); }
  if (query.date_to) { params.push(query.date_to); dateFilter.push(`m.created_at::date <= $${params.length}`); }
  const sqlWhere = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

  const item = await pool.query(
    `SELECT i.*, COALESCE(SUM(s.qty) FILTER (WHERE s.status='available'),0)::int AS qty_available
     FROM items i LEFT JOIN stocks s ON s.item_id = i.id
     WHERE i.id = $1 GROUP BY i.id`,
    [itemId]
  );
  if (!item.rows[0]) throw ApiError.notFound('Barang tidak ditemukan');

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM stock_movements m WHERE m.item_id = $1 ${sqlWhere}`,
    params
  );
  const res = await pool.query(
    `SELECT m.*, lf.code AS from_location_code, lt.code AS to_location_code, u.name AS user_name
     FROM stock_movements m
     LEFT JOIN locations lf ON lf.id = m.from_location
     LEFT JOIN locations lt ON lt.id = m.to_location
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.item_id = $1 ${sqlWhere}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { item: item.rows[0], data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function lowStock() {
  const res = await pool.query(
    `SELECT i.id AS item_id, i.sku, i.name, i.uom, i.min_stock,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)::int AS qty_available
     FROM items i LEFT JOIN stocks s ON s.item_id = i.id
     WHERE i.is_active = TRUE
     GROUP BY i.id
     HAVING COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0) < i.min_stock
     ORDER BY (i.min_stock - COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)) DESC`
  );
  return res.rows;
}

async function expiring(days) {
  const res = await pool.query(
    `SELECT s.id, i.sku, i.name, i.uom, s.batch_no, s.expiry_date, s.qty,
            l.code AS location_code, s.status,
            (s.expiry_date - CURRENT_DATE)::int AS days_left
     FROM stocks s
     JOIN items i ON i.id = s.item_id
     JOIN locations l ON l.id = s.location_id
     WHERE s.expiry_date IS NOT NULL AND s.qty > 0
       AND s.expiry_date <= CURRENT_DATE + $1::int
     ORDER BY s.expiry_date`,
    [days]
  );
  return res.rows;
}

// ---------------------------------------------------------------
// TRANSFER (pindah lokasi) — blueprint 11.4
// ---------------------------------------------------------------

async function transferStock(data, userId) {
  if (data.from_location === data.to_location) {
    throw ApiError.badRequest('Lokasi asal dan tujuan tidak boleh sama');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const from = await getLocationRow(client, data.from_location);
    const to = await getLocationRow(client, data.to_location);

    // Ambil dari stok available (FIFO: oldest received first), kunci baris
    const res = await client.query(
      `SELECT * FROM stocks
       WHERE item_id = $1 AND location_id = $2 AND status = 'available'
         AND ($3::text IS NULL OR batch_no = $3)
       ORDER BY received_at
       FOR UPDATE`,
      [data.item_id, data.from_location, data.batch_no ?? null]
    );

    let remaining = data.qty;
    for (const row of res.rows) {
      if (remaining <= 0) break;
      const take = Math.min(row.qty, remaining);
      if (take === row.qty) {
        await client.query(`DELETE FROM stocks WHERE id = $1`, [row.id]);
      } else {
        await client.query(`UPDATE stocks SET qty = qty - $1, updated_at = NOW() WHERE id = $2`, [take, row.id]);
      }
      remaining -= take;
    }
    if (remaining > 0) {
      throw ApiError.badRequest(`Stok available di ${from.code} tidak mencukupi (kurang ${remaining})`);
    }

    // Masukkan ke lokasi tujuan
    await upsertStock(client, {
      itemId: data.item_id, locationId: data.to_location, qty: data.qty,
      batchNo: data.batch_no ?? null, expiryDate: null, status: 'available',
    });

    await recordMovement(client, {
      itemId: data.item_id, fromLoc: data.from_location, toLoc: data.to_location,
      qty: data.qty, type: 'transfer', batchNo: data.batch_no ?? null,
      note: data.note ?? `Transfer ${from.code} → ${to.code}`, userId,
    });

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'transfer', entity: 'stocks', detail: { ...data, from: from.code, to: to.code } });
    return { message: `Berhasil memindahkan ${data.qty} dari ${from.code} ke ${to.code}` };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// ADJUSTMENT (penyesuaian) — wajib alasan, admin/supervisor
// ---------------------------------------------------------------

async function adjustStock(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loc = await getLocationRow(client, data.location_id);

    // Hitung total stok di lokasi tersebut untuk item (semua status available).
    // Kunci baris dulu (FOR UPDATE tanpa aggregate — tidak diperbolehkan di PG).
    const cur = await client.query(
      `SELECT qty FROM stocks
       WHERE item_id = $1 AND location_id = $2 AND status = 'available'
         AND ($3::text IS NULL OR batch_no = $3)
       FOR UPDATE`,
      [data.item_id, data.location_id, data.batch_no ?? null]
    );
    const current = cur.rows.reduce((acc, r) => acc + Number(r.qty), 0);
    const diff = data.qty_new - current;
    if (diff === 0) throw ApiError.badRequest('Qty baru sama dengan stok saat ini, tidak ada perubahan');

    // Hapus baris available lama, tulis ulang sesuai qty_new
    await client.query(
      `DELETE FROM stocks WHERE item_id = $1 AND location_id = $2 AND status = 'available'
        AND ($3::text IS NULL OR batch_no = $3)`,
      [data.item_id, data.location_id, data.batch_no ?? null]
    );
    if (data.qty_new > 0) {
      // Ambil expiry dari barang bila ada di baris lama — disederhanakan: tidak dipakai ulang
      await upsertStock(client, {
        itemId: data.item_id, locationId: data.location_id, qty: data.qty_new,
        batchNo: data.batch_no ?? null, expiryDate: null, status: 'available',
      });
    }

    await recordMovement(client, {
      itemId: data.item_id, fromLoc: diff < 0 ? data.location_id : null,
      toLoc: diff > 0 ? data.location_id : null,
      qty: Math.abs(diff), type: 'adjustment', batchNo: data.batch_no ?? null,
      note: `Adjustment ${loc.code}: ${current} → ${data.qty_new}. Alasan: ${data.reason}`, userId,
    });

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'adjustment', entity: 'stocks', detail: { ...data, before: current } });
    return { message: `Stok disesuaikan dari ${current} menjadi ${data.qty_new}`, before: current, after: data.qty_new };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  listStocks, stockSummary, listMovements, stockCard, lowStock, expiring,
  transferStock, adjustStock,
};
