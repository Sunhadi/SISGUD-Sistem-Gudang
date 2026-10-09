const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');

async function listLocations(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = ['l.is_active = TRUE'];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(l.code ILIKE $${params.length} OR l.zone ILIKE $${params.length})`);
  }
  if (query.zone) {
    params.push(query.zone);
    where.push(`l.zone = $${params.length}`);
  }
  if (query.type) {
    params.push(query.type);
    where.push(`l.type = $${params.length}`);
  }

  const sqlWhere = `WHERE ${where.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM locations l ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT l.*, COALESCE(SUM(s.qty), 0)::int AS qty_used
     FROM locations l LEFT JOIN stocks s ON s.location_id = l.id
     ${sqlWhere}
     GROUP BY l.id ORDER BY l.code
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getLocation(id) {
  const res = await pool.query(
    `SELECT l.*, COALESCE(SUM(s.qty), 0)::int AS qty_used
     FROM locations l LEFT JOIN stocks s ON s.location_id = l.id
     WHERE l.id = $1 GROUP BY l.id`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('Lokasi tidak ditemukan');
  return res.rows[0];
}

async function createLocation(data, userId) {
  try {
    const res = await pool.query(
      `INSERT INTO locations (code, zone, rack, level, bin, type, capacity, pos_x, pos_y, pos_z)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.code, data.zone, data.rack ?? null, data.level ?? null, data.bin ?? null,
       data.type ?? 'storage', data.capacity ?? null,
       data.pos_x ?? null, data.pos_y ?? null, data.pos_z ?? null]
    );
    await logAudit(pool, { userId, action: 'create', entity: 'locations', entityId: res.rows[0].id, detail: { code: data.code } });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Kode lokasi sudah dipakai');
    throw err;
  }
}

async function updateLocation(id, data, userId) {
  const fields = [];
  const params = [];
  for (const key of ['code', 'zone', 'rack', 'level', 'bin', 'type',
    'capacity', 'pos_x', 'pos_y', 'pos_z', 'is_active']) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (!fields.length) return getLocation(id);
  params.push(id);
  try {
    const res = await pool.query(
      `UPDATE locations SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!res.rows[0]) throw ApiError.notFound('Lokasi tidak ditemukan');
    await logAudit(pool, { userId, action: 'update', entity: 'locations', entityId: id, detail: Object.keys(data) });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Kode lokasi sudah dipakai');
    if (err instanceof ApiError) throw err;
    throw err;
  }
}

async function deactivateLocation(id, userId) {
  // Cegah nonaktifkan lokasi yang masih berisi stok
  const used = await pool.query(
    `SELECT COALESCE(SUM(qty), 0)::int AS total FROM stocks WHERE location_id = $1`,
    [id]
  );
  if (used.rows[0].total > 0) {
    throw ApiError.badRequest('Lokasi masih berisi stok, kosongkan dulu sebelum nonaktif');
  }
  const res = await pool.query(
    `UPDATE locations SET is_active = FALSE WHERE id = $1 RETURNING id, code, is_active`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('Lokasi tidak ditemukan');
  await logAudit(pool, { userId, action: 'delete', entity: 'locations', entityId: id });
  return res.rows[0];
}

async function findByCode(code) {
  const res = await pool.query('SELECT * FROM locations WHERE code = $1 AND is_active = TRUE', [code]);
  if (!res.rows[0]) throw ApiError.notFound('Lokasi tidak ditemukan');
  return res.rows[0];
}

async function getLocationStocks(id) {
  const res = await pool.query(
    `SELECT s.id, i.sku, i.name, i.uom, s.batch_no, s.expiry_date, s.status, s.qty
     FROM stocks s JOIN items i ON i.id = s.item_id
     WHERE s.location_id = $1 AND s.qty > 0 ORDER BY i.sku`,
    [id]
  );
  return res.rows;
}

module.exports = {
  listLocations, getLocation, createLocation, updateLocation,
  deactivateLocation, findByCode, getLocationStocks,
};
