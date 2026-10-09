const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');
const exceljs = require('exceljs');

async function listItems(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = ['i.is_active = TRUE'];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(i.sku ILIKE $${params.length} OR i.name ILIKE $${params.length} OR i.barcode ILIKE $${params.length})`);
  }
  if (query.category) {
    params.push(query.category);
    where.push(`i.category ILIKE $${params.length}`);
  }
  if (query.is_active !== undefined) {
    params.push(query.is_active);
    where[0] = `i.is_active = $${params.length}`;
  }

  const sqlWhere = `WHERE ${where.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM items i ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT i.*, COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)::int AS qty_available
     FROM items i
     LEFT JOIN stocks s ON s.item_id = i.id
     ${sqlWhere}
     GROUP BY i.id
     ORDER BY i.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getItem(id) {
  const res = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  if (!res.rows[0]) throw ApiError.notFound('Barang tidak ditemukan');
  return res.rows[0];
}

async function createItem(data, userId) {
  try {
    const res = await pool.query(
      `INSERT INTO items (sku, name, category, uom, length_cm, width_cm, height_cm, weight_kg,
                         min_stock, barcode, is_batch, has_expiry)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [data.sku, data.name, data.category ?? null, data.uom ?? 'pcs',
       data.length_cm ?? null, data.width_cm ?? null, data.height_cm ?? null,
       data.weight_kg ?? null, data.min_stock ?? 0, data.barcode ?? null,
       data.is_batch ?? false, data.has_expiry ?? false]
    );
    await logAudit(pool, { userId, action: 'create', entity: 'items', entityId: res.rows[0].id, detail: { sku: data.sku } });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('SKU atau barcode sudah dipakai');
    throw err;
  }
}

async function updateItem(id, data, userId) {
  const fields = [];
  const params = [];
  for (const key of ['sku', 'name', 'category', 'uom', 'length_cm', 'width_cm',
    'height_cm', 'weight_kg', 'min_stock', 'barcode', 'is_batch', 'has_expiry', 'is_active']) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (!fields.length) return getItem(id);
  params.push(id);
  try {
    const res = await pool.query(
      `UPDATE items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!res.rows[0]) throw ApiError.notFound('Barang tidak ditemukan');
    await logAudit(pool, { userId, action: 'update', entity: 'items', entityId: id, detail: Object.keys(data) });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('SKU atau barcode sudah dipakai');
    if (err instanceof ApiError) throw err;
    throw err;
  }
}

/** Soft delete: nonaktifkan barang */
async function deactivateItem(id, userId) {
  const res = await pool.query(
    `UPDATE items SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id, sku, is_active`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('Barang tidak ditemukan');
  await logAudit(pool, { userId, action: 'delete', entity: 'items', entityId: id });
  return res.rows[0];
}

async function findByBarcode(code) {
  const res = await pool.query(
    `SELECT i.*, COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)::int AS qty_available
     FROM items i LEFT JOIN stocks s ON s.item_id = i.id
     WHERE i.barcode = $1 GROUP BY i.id`,
    [code]
  );
  if (!res.rows[0]) throw ApiError.notFound('Barang dengan barcode tersebut tidak ditemukan');
  return res.rows[0];
}

/** Import massal dari Excel (base64). Kolom: sku, name, category, uom, min_stock, barcode */
async function importItems(fileBase64, userId) {
  const buffer = Buffer.from(fileBase64, 'base64');
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw ApiError.badRequest('File Excel kosong');

  const rows = [];
  worksheet.eachRow((row, idx) => {
    if (idx === 1) return; // skip header
    const [sku, name, category, uom, minStock, barcode] = row.values.slice(1);
    if (!sku || !name) return;
    rows.push({
      sku: String(sku).trim(),
      name: String(name).trim(),
      category: category ? String(category).trim() : null,
      uom: uom ? String(uom).trim() : 'pcs',
      min_stock: minStock ? Number(minStock) : 0,
      barcode: barcode ? String(barcode).trim() : null,
    });
  });

  if (!rows.length) throw ApiError.badRequest('Tidak ada baris valid di file Excel');

  const inserted = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      try {
        const res = await client.query(
          `INSERT INTO items (sku, name, category, uom, min_stock, barcode)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, sku, name`,
          [r.sku, r.name, r.category, r.uom, r.min_stock, r.barcode]
        );
        inserted.push(res.rows[0]);
      } catch (err) {
        if (err.code !== '23505') throw err;
        // Lewati baris duplikat (SKU/barkode sudah ada)
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await logAudit(pool, { userId, action: 'import', entity: 'items', detail: { count: inserted.length } });
  return { inserted_count: inserted.length, rows: inserted };
}

async function exportItemsExcel() {
  const res = await pool.query(
    `SELECT i.sku, i.name, i.category, i.uom, i.length_cm, i.width_cm, i.height_cm,
            i.weight_kg, i.min_stock, i.barcode, i.is_batch, i.has_expiry,
            COALESCE(SUM(s.qty) FILTER (WHERE s.status = 'available'), 0)::int AS qty_available
     FROM items i LEFT JOIN stocks s ON s.item_id = i.id
     WHERE i.is_active = TRUE GROUP BY i.id ORDER BY i.sku`
  );

  const workbook = new exceljs.Workbook();
  const sheet = workbook.addWorksheet('Barang');
  sheet.columns = [
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Nama', key: 'name', width: 40 },
    { header: 'Kategori', key: 'category', width: 20 },
    { header: 'Satuan', key: 'uom', width: 10 },
    { header: 'Stok Available', key: 'qty_available', width: 16 },
    { header: 'Stok Minimum', key: 'min_stock', width: 14 },
    { header: 'Barcode', key: 'barcode', width: 22 },
    { header: 'Batch', key: 'is_batch', width: 9 },
    { header: 'Expired', key: 'has_expiry', width: 9 },
    { header: 'Berat (kg)', key: 'weight_kg', width: 12 },
  ];
  res.rows.forEach((r) => sheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  listItems, getItem, createItem, updateItem, deactivateItem,
  findByBarcode, importItems, exportItemsExcel,
};
