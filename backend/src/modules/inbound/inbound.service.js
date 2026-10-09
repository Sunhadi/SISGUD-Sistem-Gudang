const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { nextDocNumber } = require('../../utils/docNumber');
const { logAudit } = require('../../utils/audit');

// ---------------------------------------------------------------
// Helper transaksi
// ---------------------------------------------------------------

/** Ambil lokasi aktif pertama dengan tipe tertentu (staging/hold/reject) */
async function findLocationByType(client, type) {
  const res = await client.query(
    `SELECT id, code FROM locations WHERE type = $1 AND is_active = TRUE ORDER BY id LIMIT 1`,
    [type]
  );
  if (!res.rows[0]) {
    throw ApiError.badRequest(`Lokasi tipe '${type}' belum dibuat (jalankan seed)`);
  }
  return res.rows[0];
}

/** Upsert baris stok (memakai unique index ekspresi COALESCE(batch_no,'')) */
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

async function addTimeline(client, { orderType, orderId, stage, userId, note }) {
  await client.query(
    `INSERT INTO order_timeline (order_type, order_id, stage, user_id, note)
     VALUES ($1,$2,$3,$4,$5)`,
    [orderType, orderId, stage, userId ?? null, note ?? null]
  );
}

async function getInboundRow(client, id) {
  const res = await client.query('SELECT * FROM inbound_orders WHERE id = $1', [id]);
  if (!res.rows[0]) throw ApiError.notFound('Inbound order tidak ditemukan');
  return res.rows[0];
}

// ---------------------------------------------------------------
// CRUD & list
// ---------------------------------------------------------------

async function listInbound(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(io.doc_no ILIKE $${params.length} OR s.name ILIKE $${params.length})`);
  }
  if (query.status) {
    params.push(query.status);
    where.push(`io.status = $${params.length}`);
  }
  if (query.supplier_id) {
    params.push(query.supplier_id);
    where.push(`io.supplier_id = $${params.length}`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM inbound_orders io JOIN suppliers s ON s.id = io.supplier_id ${sqlWhere}`,
    params
  );
  const res = await pool.query(
    `SELECT io.id, io.doc_no, io.status, io.expected_at, io.note, io.created_at, io.updated_at,
            s.name AS supplier_name, io.created_by,
            (SELECT COALESCE(SUM(ii.qty_expected),0) FROM inbound_items ii WHERE ii.inbound_id = io.id)::int AS total_qty,
            (SELECT COUNT(*) FROM inbound_items ii WHERE ii.inbound_id = io.id)::int AS total_items
     FROM inbound_orders io
     LEFT JOIN suppliers s ON s.id = io.supplier_id
     ${sqlWhere}
     ORDER BY io.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getInbound(id) {
  const order = await pool.query(
    `SELECT io.*, s.name AS supplier_name, s.code AS supplier_code, u.name AS created_by_name
     FROM inbound_orders io
     LEFT JOIN suppliers s ON s.id = io.supplier_id
     LEFT JOIN users u ON u.id = io.created_by
     WHERE io.id = $1`,
    [id]
  );
  if (!order.rows[0]) throw ApiError.notFound('Inbound order tidak ditemukan');

  const items = await pool.query(
    `SELECT ii.*, i.sku, i.name AS item_name, i.uom, i.barcode
     FROM inbound_items ii JOIN items i ON i.id = ii.item_id
     WHERE ii.inbound_id = $1 ORDER BY ii.id`,
    [id]
  );
  return { ...order.rows[0], items: items.rows };
}

async function createInbound(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const docNo = await nextDocNumber(client, 'inbound_orders', 'IN');
    const res = await client.query(
      `INSERT INTO inbound_orders (doc_no, supplier_id, status, expected_at, note, created_by)
       VALUES ($1,$2,'draft',$3,$4,$5) RETURNING *`,
      [docNo, data.supplier_id ?? null, data.expected_at ?? null, data.note ?? null, userId]
    );
    const orderId = res.rows[0].id;

    for (const item of data.items) {
      await client.query(
        `INSERT INTO inbound_items (inbound_id, item_id, qty_expected, batch_no, expiry_date)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.item_id, item.qty_expected, item.batch_no ?? null, item.expiry_date ?? null]
      );
    }

    await addTimeline(client, { orderType: 'inbound', orderId, stage: 'created', userId, note: `PO/ASN ${docNo} dibuat` });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'create', entity: 'inbound_orders', entityId: orderId, detail: { doc_no: docNo } });
    return getInbound(orderId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Ubah hanya saat masih draft */
async function updateInbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getInboundRow(client, id);
    if (order.status !== 'draft') {
      throw ApiError.badRequest('Hanya order status draft yang bisa diubah');
    }

    const fields = [];
    const params = [];
    for (const key of ['supplier_id', 'expected_at', 'note']) {
      if (data[key] !== undefined) {
        params.push(data[key] ?? null);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (fields.length) {
      params.push(id);
      await client.query(
        `UPDATE inbound_orders SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`
      );
    }

    if (data.items) {
      await client.query('DELETE FROM inbound_items WHERE inbound_id = $1', [id]);
      for (const item of data.items) {
        await client.query(
          `INSERT INTO inbound_items (inbound_id, item_id, qty_expected, batch_no, expiry_date)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, item.item_id, item.qty_expected, item.batch_no ?? null, item.expiry_date ?? null]
        );
      }
    }

    await addTimeline(client, { orderType: 'inbound', orderId: id, stage: 'updated', userId, note: 'Draft diperbarui' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'update', entity: 'inbound_orders', entityId: id });
    return getInbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// RECEIVING
// ---------------------------------------------------------------

async function receiveInbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getInboundRow(client, id);
    if (!['draft', 'open', 'receiving'].includes(order.status)) {
      throw ApiError.badRequest(`Receiving tidak diizinkan pada status '${order.status}'`);
    }

    for (const input of data.items) {
      const res = await client.query(
        `SELECT * FROM inbound_items WHERE inbound_id = $1 AND item_id = $2 FOR UPDATE`,
        [id, input.item_id]
      );
      const line = res.rows[0];
      if (!line) throw ApiError.badRequest('Item tidak ada dalam order ini');

      const remaining = line.qty_expected - line.qty_received;
      if (input.qty_received > remaining) {
        throw ApiError.badRequest(
          `Qty diterima melebihi sisa PO (sisa: ${remaining})`
        );
      }
      await client.query(
        `UPDATE inbound_items SET qty_received = qty_received + $1 WHERE id = $2`,
        [input.qty_received, line.id]
      );
    }

    await client.query(`UPDATE inbound_orders SET status = 'receiving', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'inbound', orderId: id, stage: 'receiving', userId, note: 'Barang diterima (receiving)' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'receive', entity: 'inbound_orders', entityId: id });
    return getInbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// QC: lolos → staging (available) · hold → lokasi hold · reject → lokasi reject
// ---------------------------------------------------------------

async function qcInbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getInboundRow(client, id);
    if (!['receiving', 'qc'].includes(order.status)) {
      throw ApiError.badRequest('QC hanya bisa dilakukan setelah receiving');
    }

    const staging = await findLocationByType(client, 'staging');
    const holdLoc = await findLocationByType(client, 'hold');
    const rejectLoc = await findLocationByType(client, 'reject');

    for (const input of data.items) {
      const res = await client.query(
        `SELECT * FROM inbound_items WHERE inbound_id = $1 AND item_id = $2 FOR UPDATE`,
        [id, input.item_id]
      );
      const line = res.rows[0];
      if (!line) throw ApiError.badRequest('Item tidak ada dalam order ini');

      const decided = line.qty_accepted + line.qty_hold + line.qty_rejected;
      const total = input.qty_accepted + input.qty_hold + input.qty_rejected;
      if (decided + total !== line.qty_received) {
        throw ApiError.badRequest(
          `Jumlah QC (lolos+hold+reject) harus sama dengan qty diterima (${line.qty_received})`
        );
      }

      // Lolos → stok available di staging
      if (input.qty_accepted > 0) {
        await upsertStock(client, {
          itemId: line.item_id, locationId: staging.id, qty: input.qty_accepted,
          batchNo: line.batch_no, expiryDate: line.expiry_date, status: 'available',
        });
        await recordMovement(client, {
          itemId: line.item_id, toLoc: staging.id, qty: input.qty_accepted, type: 'inbound',
          batchNo: line.batch_no, refType: 'inbound', refId: id,
          note: `Receiving ${order.doc_no} (QC lolos)`, userId,
        });
      }
      // Hold → stok hold di lokasi hold
      if (input.qty_hold > 0) {
        await upsertStock(client, {
          itemId: line.item_id, locationId: holdLoc.id, qty: input.qty_hold,
          batchNo: line.batch_no, expiryDate: line.expiry_date, status: 'hold',
        });
        await recordMovement(client, {
          itemId: line.item_id, toLoc: holdLoc.id, qty: input.qty_hold, type: 'inbound',
          batchNo: line.batch_no, refType: 'inbound', refId: id,
          note: `QC hold — menunggu keputusan (${order.doc_no})`, userId,
        });
      }
      // Reject → stok rejected di lokasi reject
      if (input.qty_rejected > 0) {
        await upsertStock(client, {
          itemId: line.item_id, locationId: rejectLoc.id, qty: input.qty_rejected,
          batchNo: line.batch_no, expiryDate: line.expiry_date, status: 'rejected',
        });
        await recordMovement(client, {
          itemId: line.item_id, toLoc: rejectLoc.id, qty: input.qty_rejected, type: 'reject',
          batchNo: line.batch_no, refType: 'inbound', refId: id,
          note: `QC reject: ${input.reject_reason || 'tanpa alasan'} (${order.doc_no})`, userId,
        });
      }

      await client.query(
        `UPDATE inbound_items
         SET qty_accepted = qty_accepted + $1, qty_hold = qty_hold + $2,
             qty_rejected = qty_rejected + $3, reject_reason = COALESCE($4, reject_reason)
         WHERE id = $5`,
        [input.qty_accepted, input.qty_hold, input.qty_rejected, input.reject_reason ?? null, line.id]
      );
    }

    await client.query(`UPDATE inbound_orders SET status = 'qc', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'inbound', orderId: id, stage: 'qc', userId, note: 'QC selesai' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'qc', entity: 'inbound_orders', entityId: id });
    return getInbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// PUTAWAY: staging → lokasi storage (validasi kapasitas)
// ---------------------------------------------------------------

async function putawayInbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getInboundRow(client, id);
    if (!['qc', 'putaway'].includes(order.status)) {
      throw ApiError.badRequest('Putaway hanya bisa dilakukan setelah QC');
    }

    const lineRes = await client.query(
      `SELECT ii.*, i.is_batch, i.has_expiry FROM inbound_items ii
       JOIN items i ON i.id = ii.item_id
       WHERE ii.inbound_id = $1 AND ii.item_id = $2 FOR UPDATE`,
      [id, data.item_id]
    );
    const line = lineRes.rows[0];
    if (!line) throw ApiError.badRequest('Item tidak ada dalam order ini');

    if (line.qty_putaway + data.qty > line.qty_accepted) {
      throw ApiError.badRequest(`Qty putaway melebihi qty yang diterima/QC (sisa: ${line.qty_accepted - line.qty_putaway})`);
    }

    // Lokasi tujuan: aktif, tipe storage
    const locRes = await client.query(
      `SELECT * FROM locations WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
      [data.location_id]
    );
    const target = locRes.rows[0];
    if (!target) throw ApiError.notFound('Lokasi tujuan tidak ditemukan atau tidak aktif');
    if (target.type !== 'storage') {
      throw ApiError.badRequest('Lokasi tujuan putaway harus bertipe storage');
    }

    // Validasi kapasitas lokasi tujuan
    if (target.capacity != null) {
      const usedRes = await client.query(
        `SELECT COALESCE(SUM(qty), 0)::int AS used FROM stocks WHERE location_id = $1`,
        [target.id]
      );
      if (usedRes.rows[0].used + data.qty > target.capacity) {
        throw ApiError.badRequest(
          `Lokasi ${target.code} melebihi kapasitas (terpakai ${usedRes.rows[0].used}/${target.capacity})`
        );
      }
    }

    // Ambil stok dari staging (available) — batch sesuai bila barang ber-batch
    const stockRes = await client.query(
      `SELECT s.*, l.code AS loc_code FROM stocks s
       JOIN locations l ON l.id = s.location_id
       WHERE s.item_id = $1 AND s.status = 'available' AND l.type = 'staging'
         AND ($2::text IS NULL OR s.batch_no = $2)
       ORDER BY s.received_at
       FOR UPDATE`,
      [data.item_id, line.is_batch ? (data.batch_no ?? line.batch_no ?? null) : null]
    );

    let remaining = data.qty;
    let sourceLocId = null;
    let sourceLocCode = null;
    for (const row of stockRes.rows) {
      if (remaining <= 0) break;
      const take = Math.min(row.qty, remaining);
      sourceLocId = row.location_id;
      sourceLocCode = row.loc_code;

      if (take === row.qty) {
        await client.query(`DELETE FROM stocks WHERE id = $1`, [row.id]);
      } else {
        await client.query(`UPDATE stocks SET qty = qty - $1, updated_at = NOW() WHERE id = $2`, [take, row.id]);
      }
      remaining -= take;
    }
    if (remaining > 0) {
      throw ApiError.badRequest('Stok di staging tidak mencukupi untuk putaway ini');
    }

    // Masukkan ke lokasi tujuan
    await upsertStock(client, {
      itemId: data.item_id, locationId: target.id, qty: data.qty,
      batchNo: line.is_batch ? (data.batch_no ?? line.batch_no) : null,
      expiryDate: line.expiry_date, status: 'available',
    });
    await recordMovement(client, {
      itemId: data.item_id, fromLoc: sourceLocId, toLoc: target.id, qty: data.qty,
      type: 'putaway', batchNo: line.is_batch ? (data.batch_no ?? line.batch_no) : null,
      refType: 'inbound', refId: id,
      note: `Putaway ${order.doc_no}: ${sourceLocCode} → ${target.code}`, userId,
    });

    await client.query(
      `UPDATE inbound_items SET qty_putaway = qty_putaway + $1 WHERE id = $2`,
      [data.qty, line.id]
    );

    // Semua item lengkap? → completed
    const doneRes = await client.query(
      `SELECT BOOL_AND(qty_putaway >= qty_accepted) AS all_done FROM inbound_items WHERE inbound_id = $1`,
      [id]
    );
    const newStatus = doneRes.rows[0].all_done ? 'completed' : 'putaway';
    await client.query(`UPDATE inbound_orders SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
    await addTimeline(client, {
      orderType: 'inbound', orderId: id,
      stage: newStatus === 'completed' ? 'completed' : 'putaway', userId,
      note: `Putaway ${data.qty} ke ${target.code}`,
    });

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'putaway', entity: 'inbound_orders', entityId: id, detail: { item_id: data.item_id, location: target.code, qty: data.qty } });
    return getInbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// CANCEL & TIMELINE
// ---------------------------------------------------------------

async function cancelInbound(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getInboundRow(client, id);
    if (!['draft', 'open'].includes(order.status)) {
      throw ApiError.badRequest('Hanya order draft/open yang bisa dibatalkan');
    }
    await client.query(`UPDATE inbound_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'inbound', orderId: id, stage: 'cancelled', userId, note: 'Order dibatalkan' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'cancel', entity: 'inbound_orders', entityId: id });
    return getInbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getInboundTimeline(id, query) {
  const { page, limit, offset } = pageOpts(query);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM order_timeline WHERE order_type = 'inbound' AND order_id = $1`,
    [id]
  );
  const res = await pool.query(
    `SELECT t.*, u.name AS user_name
     FROM order_timeline t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.order_type = 'inbound' AND t.order_id = $1
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

module.exports = {
  listInbound, getInbound, createInbound, updateInbound,
  receiveInbound, qcInbound, putawayInbound, cancelInbound, getInboundTimeline,
};
