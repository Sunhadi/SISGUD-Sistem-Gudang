const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');

const ENTITY = 'suppliers';

async function list(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = ['is_active = TRUE'];
  const params = [];
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }
  const sqlWhere = `WHERE ${where.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM ${ENTITY} ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT * FROM ${ENTITY} ${sqlWhere} ORDER BY name
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function get(id) {
  const res = await pool.query(`SELECT * FROM ${ENTITY} WHERE id = $1`, [id]);
  if (!res.rows[0]) throw ApiError.notFound('Supplier tidak ditemukan');
  return res.rows[0];
}

async function create(data, userId) {
  try {
    const res = await pool.query(
      `INSERT INTO ${ENTITY} (code, name, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.code, data.name, data.phone ?? null, data.address ?? null]
    );
    await logAudit(pool, { userId, action: 'create', entity: ENTITY, entityId: res.rows[0].id, detail: { name: data.name } });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Kode supplier sudah dipakai');
    throw err;
  }
}

async function update(id, data, userId) {
  const fields = [];
  const params = [];
  for (const key of ['code', 'name', 'phone', 'address', 'is_active']) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (!fields.length) return get(id);
  params.push(id);
  try {
    const res = await pool.query(
      `UPDATE ${ENTITY} SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!res.rows[0]) throw ApiError.notFound('Supplier tidak ditemukan');
    await logAudit(pool, { userId, action: 'update', entity: ENTITY, entityId: id, detail: Object.keys(data) });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Kode supplier sudah dipakai');
    if (err instanceof ApiError) throw err;
    throw err;
  }
}

async function remove(id, userId) {
  const res = await pool.query(
    `UPDATE ${ENTITY} SET is_active = FALSE WHERE id = $1 RETURNING id, code, is_active`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('Supplier tidak ditemukan');
  await logAudit(pool, { userId, action: 'delete', entity: ENTITY, entityId: id });
  return res.rows[0];
}

module.exports = { list, get, create, update, remove };
