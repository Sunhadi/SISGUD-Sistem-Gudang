const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { nextDocNumber } = require('../../utils/docNumber');
const { logAudit } = require('../../utils/audit');

// ---------------------------------------------------------------
// Helper transaksi
// ---------------------------------------------------------------

async function getOutboundRow(client, id) {
  const res = await client.query('SELECT * FROM outbound_orders WHERE id = $1', [id]);
  if (!res.rows[0]) throw ApiError.notFound('Outbound order tidak ditemukan');
  return res.rows[0];
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

/**
 * Ambil stok available untuk alokasi.
 * Urutan: FEFO (expiry terdekat dulu) lalu FIFO (received_at).
 * Barang tanpa expiry diurutkan pakai received_at saja.
 */
async function pickAvailableStocks(client, itemId, qtyNeeded) {
  const res = await client.query(
    `SELECT * FROM stocks
     WHERE item_id = $1 AND status = 'available' AND qty > 0
     ORDER BY expiry_date NULLS LAST, received_at
     FOR UPDATE`,
    [itemId]
  );

  const picked = [];
  let remaining = qtyNeeded;
  for (const row of res.rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.qty, remaining);
    picked.push({ ...row, take });
    remaining -= take;
  }
  return { picked, remaining };
}

// ---------------------------------------------------------------
// CRUD & list
// ---------------------------------------------------------------

async function listOutbound(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(oo.doc_no ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  if (query.status) { params.push(query.status); where.push(`oo.status = $${params.length}`); }
  if (query.customer_id) { params.push(query.customer_id); where.push(`oo.customer_id = $${params.length}`); }
  if (query.priority) { params.push(query.priority); where.push(`oo.priority = $${params.length}`); }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM outbound_orders oo JOIN customers c ON c.id = oo.customer_id ${sqlWhere}`,
    params
  );
  const res = await pool.query(
    `SELECT oo.id, oo.doc_no, oo.status, oo.due_date, oo.priority, oo.note,
            oo.created_at, oo.updated_at, c.name AS customer_name, oo.created_by,
            (SELECT COALESCE(SUM(oi.qty_ordered),0) FROM outbound_items oi WHERE oi.outbound_id = oo.id)::int AS total_qty,
            (SELECT COUNT(*) FROM outbound_items oi WHERE oi.outbound_id = oo.id)::int AS total_items
     FROM outbound_orders oo
     LEFT JOIN customers c ON c.id = oo.customer_id
     ${sqlWhere}
     ORDER BY oo.priority ASC, oo.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getOutbound(id) {
  const order = await pool.query(
    `SELECT oo.*, c.name AS customer_name, c.code AS customer_code, u.name AS created_by_name
     FROM outbound_orders oo
     LEFT JOIN customers c ON c.id = oo.customer_id
     LEFT JOIN users u ON u.id = oo.created_by
     WHERE oo.id = $1`,
    [id]
  );
  if (!order.rows[0]) throw ApiError.notFound('Outbound order tidak ditemukan');

  const items = await pool.query(
    `SELECT oi.*, i.sku, i.name AS item_name, i.uom, i.barcode
     FROM outbound_items oi JOIN items i ON i.id = oi.item_id
     WHERE oi.outbound_id = $1 ORDER BY oi.id`,
    [id]
  );
  return { ...order.rows[0], items: items.rows };
}

async function createOutbound(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cegah item duplikat dalam satu order
    const seen = new Set();
    for (const it of data.items) {
      if (seen.has(it.item_id)) throw ApiError.badRequest(`Item id ${it.item_id} muncul dua kali`);
      seen.add(it.item_id);
    }

    const docNo = await nextDocNumber(client, 'outbound_orders', 'OUT');
    const res = await client.query(
      `INSERT INTO outbound_orders (doc_no, customer_id, status, due_date, priority, note, created_by)
       VALUES ($1,$2,'draft',$3,$4,$5,$6) RETURNING *`,
      [docNo, data.customer_id ?? null, data.due_date ?? null, data.priority ?? 3, data.note ?? null, userId]
    );
    const orderId = res.rows[0].id;

    for (const item of data.items) {
      await client.query(
        `INSERT INTO outbound_items (outbound_id, item_id, qty_ordered) VALUES ($1,$2,$3)`,
        [orderId, item.item_id, item.qty_ordered]
      );
    }

    await addTimeline(client, { orderType: 'outbound', orderId, stage: 'created', userId, note: `SO ${docNo} dibuat` });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'create', entity: 'outbound_orders', entityId: orderId, detail: { doc_no: docNo } });
    return getOutbound(orderId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Ubah hanya saat masih draft */
async function updateOutbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (order.status !== 'draft') {
      throw ApiError.badRequest('Hanya order status draft yang bisa diubah');
    }

    const fields = [];
    const params = [];
    for (const key of ['customer_id', 'due_date', 'priority', 'note']) {
      if (data[key] !== undefined) {
        params.push(data[key] ?? null);
        fields.push(`${key} = $${params.length}`);
      }
    }
    if (fields.length) {
      params.push(id);
      await client.query(`UPDATE outbound_orders SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`);
    }

    if (data.items) {
      const seen = new Set();
      for (const it of data.items) {
        if (seen.has(it.item_id)) throw ApiError.badRequest(`Item id ${it.item_id} muncul dua kali`);
        seen.add(it.item_id);
      }
      await client.query('DELETE FROM outbound_items WHERE outbound_id = $1', [id]);
      for (const item of data.items) {
        await client.query(
          `INSERT INTO outbound_items (outbound_id, item_id, qty_ordered) VALUES ($1,$2,$3)`,
          [id, item.item_id, item.qty_ordered]
        );
      }
    }

    await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'updated', userId, note: 'Draft diperbarui' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'update', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// ALOKASI (FIFO/FEFO): available → reserved + buat tugas picking
// ---------------------------------------------------------------

async function allocateOutbound(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (order.status !== 'draft') {
      throw ApiError.badRequest(`Alokasi hanya untuk order draft (saat ini: ${order.status})`);
    }

    const items = await client.query(
      `SELECT * FROM outbound_items WHERE outbound_id = $1 FOR UPDATE`,
      [id]
    );
    if (items.rowCount === 0) throw ApiError.badRequest('Order tidak punya item');

    for (const line of items.rows) {
      const { picked, remaining } = await pickAvailableStocks(client, line.item_id, line.qty_ordered);
      if (remaining > 0) {
        const itemRes = await client.query(`SELECT sku FROM items WHERE id = $1`, [line.item_id]);
        throw ApiError.badRequest(
          `Stok tidak mencukupi untuk ${itemRes.rows[0].sku} (kurang ${remaining})`
        );
      }

      // Pindahkan available → reserved (status berubah, lokasi sama)
      for (const src of picked) {
        if (src.take === src.qty) {
          await client.query(`DELETE FROM stocks WHERE id = $1`, [src.id]);
        } else {
          await client.query(`UPDATE stocks SET qty = qty - $1, updated_at = NOW() WHERE id = $2`, [src.take, src.id]);
        }
        await client.query(
          `INSERT INTO stocks (item_id, location_id, batch_no, expiry_date, status, qty, received_at)
           VALUES ($1,$2,$3,$4,'reserved',$5,NOW())
           ON CONFLICT (item_id, location_id, COALESCE(batch_no, ''), status)
           DO UPDATE SET qty = stocks.qty + EXCLUDED.qty, updated_at = NOW()`,
          [line.item_id, src.location_id, src.batch_no ?? null, src.expiry_date ?? null, src.take]
        );

        // Satu tugas picking per baris sumber
        await client.query(
          `INSERT INTO picking_tasks (outbound_id, item_id, location_id, batch_no, qty_plan)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, line.item_id, src.location_id, src.batch_no ?? null, src.take]
        );
      }

      await client.query(
        `UPDATE outbound_items SET qty_allocated = qty_ordered WHERE id = $1`,
        [line.id]
      );
    }

    await client.query(`UPDATE outbound_orders SET status = 'allocated', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'allocated', userId, note: 'Stok dialokasikan (FIFO/FEFO)' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'allocate', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getPickingTasks(id) {
  // Cek keberadaan order
  const check = await pool.query(`SELECT id FROM outbound_orders WHERE id = $1`, [id]);
  if (!check.rows[0]) throw ApiError.notFound('Outbound order tidak ditemukan');

  const res = await pool.query(
    `SELECT pt.*, i.sku, i.name AS item_name, i.uom, l.code AS location_code
     FROM picking_tasks pt
     JOIN items i ON i.id = pt.item_id
     JOIN locations l ON l.id = pt.location_id
     WHERE pt.outbound_id = $1
     ORDER BY pt.id`,
    [id]
  );
  return res.rows;
}

// ---------------------------------------------------------------
// PICKING: konfirmasi per tugas (scan lokasi + barang)
// ---------------------------------------------------------------

async function pickOutbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (!['allocated', 'picking'].includes(order.status)) {
      throw ApiError.badRequest(`Picking tidak diizinkan pada status '${order.status}'`);
    }

    const taskIds = data.tasks.map((t) => t.task_id);
    const res = await client.query(
      `SELECT * FROM picking_tasks WHERE outbound_id = $1 AND id = ANY($2::int[]) FOR UPDATE`,
      [id, taskIds]
    );
    if (res.rowCount !== new Set(taskIds).size) {
      throw ApiError.badRequest('Satu atau lebih tugas picking tidak ditemukan pada order ini');
    }

    const byId = new Map(res.rows.map((r) => [r.id, r]));
    for (const input of data.tasks) {
      const task = byId.get(input.task_id);
      const remaining = task.qty_plan - task.qty_picked;
      if (input.qty_picked > remaining) {
        throw ApiError.badRequest(`Qty picking melebihi rencana (sisa: ${remaining})`);
      }
      const done = task.qty_picked + input.qty_picked >= task.qty_plan;
      await client.query(
        `UPDATE picking_tasks SET qty_picked = qty_picked + $1,
           status = $2::varchar, picked_by = $3,
           picked_at = CASE WHEN $2::varchar = 'done' THEN NOW() ELSE picked_at END
         WHERE id = $4`,
        [input.qty_picked, done ? 'done' : 'pending', userId, task.id]
      );

      await client.query(
        `UPDATE outbound_items SET qty_picked = qty_picked + $1 WHERE outbound_id = $2 AND item_id = $3`,
        [input.qty_picked, id, task.item_id]
      );
    }

    await client.query(`UPDATE outbound_orders SET status = 'picking', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'picking', userId, note: 'Picking berjalan' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'pick', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// PACKING: verifikasi hasil picking
// ---------------------------------------------------------------

async function packOutbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (!['picking', 'packing'].includes(order.status)) {
      throw ApiError.badRequest(`Packing tidak diizinkan pada status '${order.status}'`);
    }

    for (const input of data.items) {
      const res = await client.query(
        `SELECT * FROM outbound_items WHERE outbound_id = $1 AND item_id = $2 FOR UPDATE`,
        [id, input.item_id]
      );
      const line = res.rows[0];
      if (!line) throw ApiError.badRequest('Item tidak ada dalam order ini');
      if (input.qty_packed > line.qty_picked) {
        throw ApiError.badRequest(`Qty packed melebihi hasil picking (picked: ${line.qty_picked})`);
      }
      await client.query(
        `UPDATE outbound_items SET qty_packed = qty_packed + $1 WHERE id = $2`,
        [input.qty_packed, line.id]
      );
    }

    await client.query(`UPDATE outbound_orders SET status = 'packing', updated_at = NOW() WHERE id = $1`, [id]);

    // Semua item packed penuh? → siap kirim
    const done = await client.query(
      `SELECT BOOL_AND(qty_packed >= qty_ordered) AS all_done FROM outbound_items WHERE outbound_id = $1`,
      [id]
    );
    if (done.rows[0].all_done) {
      await client.query(`UPDATE outbound_orders SET status = 'ready_to_ship', updated_at = NOW() WHERE id = $1`, [id]);
      await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'packed', userId, note: 'Packing selesai, siap kirim' });
    } else {
      await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'packing', userId, note: 'Packing berjalan' });
    }

    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'pack', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// SHIPPING: stok reserved dikeluarkan, catat mutasi 'outbound'
// ---------------------------------------------------------------

async function shipOutbound(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (order.status !== 'ready_to_ship') {
      throw ApiError.badRequest(`Order harus berstatus siap kirim (saat ini: ${order.status})`);
    }

    const items = await client.query(
      `SELECT * FROM outbound_items WHERE outbound_id = $1 FOR UPDATE`,
      [id]
    );
    for (const line of items.rows) {
      if (line.qty_packed < line.qty_ordered) {
        throw ApiError.badRequest('Ada item yang belum ter-pack penuh');
      }
    }

    // Keluarkan stok reserved per item+lokasi+batch
    const reserved = await client.query(
      `SELECT s.* FROM stocks s
       JOIN outbound_items oi ON oi.item_id = s.item_id AND oi.outbound_id = $1
       WHERE s.status = 'reserved' AND s.qty > 0
       FOR UPDATE`,
      [id]
    );
    if (reserved.rowCount === 0) {
      throw ApiError.badRequest('Tidak ada stok reserved untuk dikirim');
    }

    for (const row of reserved.rows) {
      await client.query(`DELETE FROM stocks WHERE id = $1`, [row.id]);
      await recordMovement(client, {
        itemId: row.item_id, fromLoc: row.location_id, qty: row.qty,
        type: 'outbound', batchNo: row.batch_no,
        refType: 'outbound', refId: id,
        note: `Pengiriman ${order.doc_no} dari ${row.location_id}`, userId,
      });

      await client.query(
        `UPDATE outbound_items SET qty_shipped = qty_shipped + $1
         WHERE outbound_id = $2 AND item_id = $3`,
        [row.qty, id, row.item_id]
      );
    }

    await client.query(`UPDATE outbound_orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'shipped', userId, note: data.note ?? 'Dikirim' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'ship', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// CANCEL: lepas alokasi (reserved → available), hapus tugas picking
// ---------------------------------------------------------------

async function cancelOutbound(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await getOutboundRow(client, id);
    if (!['draft', 'allocated'].includes(order.status)) {
      throw ApiError.badRequest('Hanya order draft/allocated yang bisa dibatalkan');
    }

    if (order.status === 'allocated') {
      // Kembalikan reserved → available
      const reserved = await client.query(
        `SELECT * FROM stocks WHERE status = 'reserved'
         AND item_id IN (SELECT item_id FROM outbound_items WHERE outbound_id = $1)
         FOR UPDATE`,
        [id]
      );
      for (const row of reserved.rows) {
        await client.query(
          `INSERT INTO stocks (item_id, location_id, batch_no, expiry_date, status, qty)
           VALUES ($1,$2,$3,$4,'available',$5)
           ON CONFLICT (item_id, location_id, COALESCE(batch_no, ''), status)
           DO UPDATE SET qty = stocks.qty + EXCLUDED.qty, updated_at = NOW()`,
          [row.item_id, row.location_id, row.batch_no ?? null, row.expiry_date ?? null, row.qty]
        );
        await client.query(`DELETE FROM stocks WHERE id = $1`, [row.id]);
      }
      await client.query(`DELETE FROM picking_tasks WHERE outbound_id = $1`, [id]);
    }

    await client.query(
      `UPDATE outbound_items SET qty_allocated = 0 WHERE outbound_id = $1`,
      [id]
    );
    await client.query(`UPDATE outbound_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    await addTimeline(client, { orderType: 'outbound', orderId: id, stage: 'cancelled', userId, note: 'Order dibatalkan, alokasi dilepas' });
    await client.query('COMMIT');
    await logAudit(pool, { userId, action: 'cancel', entity: 'outbound_orders', entityId: id });
    return getOutbound(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getOutboundTimeline(id, query) {
  const check = await pool.query(`SELECT id FROM outbound_orders WHERE id = $1`, [id]);
  if (!check.rows[0]) throw ApiError.notFound('Outbound order tidak ditemukan');

  const { page, limit, offset } = pageOpts(query);
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM order_timeline WHERE order_type = 'outbound' AND order_id = $1`,
    [id]
  );
  const res = await pool.query(
    `SELECT t.*, u.name AS user_name
     FROM order_timeline t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.order_type = 'outbound' AND t.order_id = $1
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

module.exports = {
  listOutbound, getOutbound, createOutbound, updateOutbound,
  allocateOutbound, getPickingTasks, pickOutbound, packOutbound,
  shipOutbound, cancelOutbound, getOutboundTimeline,
};
