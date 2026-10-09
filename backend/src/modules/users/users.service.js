const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');
const { publicUser, SALT_ROUNDS } = require('../auth/auth.service');

async function listUsers(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (query.role) {
    params.push(query.role);
    where.push(`role = $${params.length}`);
  }
  if (query.is_active !== undefined) {
    params.push(query.is_active);
    where.push(`is_active = $${params.length}`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM users ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT id, name, email, role, is_active, created_at, updated_at
     FROM users ${sqlWhere}
     ORDER BY id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

async function getUser(id) {
  const res = await pool.query(
    'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('User tidak ditemukan');
  return res.rows[0];
}

async function createUser(data, userId) {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  try {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at, updated_at`,
      [data.name, data.email, hash, data.role]
    );
    await logAudit(pool, { userId, action: 'create', entity: 'users', entityId: res.rows[0].id, detail: { name: data.name, role: data.role } });
    return res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Email sudah terdaftar');
    throw err;
  }
}

async function updateUser(id, data, userId) {
  const fields = [];
  const params = [];
  for (const key of ['name', 'email', 'role', 'is_active']) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  let updated;
  if (data.password !== undefined) {
    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    params.push(hash);
    fields.push(`password_hash = $${params.length}`);
  }
  if (!fields.length) return getUser(id);

  params.push(id);
  const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
               RETURNING id, name, email, role, is_active, created_at, updated_at`;
  try {
    const res = await pool.query(sql, params);
    if (!res.rows[0]) throw ApiError.notFound('User tidak ditemukan');
    updated = res.rows[0];
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('Email sudah terdaftar');
    if (err instanceof ApiError) throw err;
    throw err;
  }
  await logAudit(pool, { userId, action: 'update', entity: 'users', entityId: id, detail: Object.keys(data) });
  return updated;
}

/** Soft delete: nonaktifkan user (is_active = false) */
async function deactivateUser(id, userId) {
  const res = await pool.query(
    `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1
     RETURNING id, name, is_active`,
    [id]
  );
  if (!res.rows[0]) throw ApiError.notFound('User tidak ditemukan');
  await logAudit(pool, { userId, action: 'delete', entity: 'users', entityId: id });
  return res.rows[0];
}

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser, publicUser };
