const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { ApiError } = require('../../utils/errors');
const { logAudit } = require('../../utils/audit');

const SALT_ROUNDS = 10;

function publicUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

async function login({ email, password }, ip) {
  const res = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );
  const user = res.rows[0];
  if (!user) throw ApiError.unauthorized('Email atau password salah');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw ApiError.unauthorized('Email atau password salah');

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  await logAudit(pool, {
    userId: user.id, action: 'login', entity: 'auth', entityId: String(user.id), ip,
  });
  return { token, user: publicUser(user) };
}

async function logout(userId, ip) {
  await logAudit(pool, { userId, action: 'logout', entity: 'auth', entityId: String(userId), ip });
  return true;
}

async function getMe(userId) {
  const res = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
  if (!res.rows[0]) throw ApiError.unauthorized('User tidak aktif atau tidak ditemukan');
  return publicUser(res.rows[0]);
}

async function changePassword(userId, { old_password, new_password }) {
  const res = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!res.rows[0]) throw ApiError.notFound('User tidak ditemukan');

  const match = await bcrypt.compare(old_password, res.rows[0].password_hash);
  if (!match) throw ApiError.badRequest('Password lama salah');

  const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
  await logAudit(pool, { userId, action: 'change_password', entity: 'users', entityId: String(userId) });
  return true;
}

module.exports = { login, logout, getMe, changePassword, publicUser, SALT_ROUNDS };
