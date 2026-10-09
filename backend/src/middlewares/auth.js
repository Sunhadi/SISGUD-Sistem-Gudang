const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError } = require('../utils/errors');

/** Verifikasi JWT dari header Authorization: Bearer <token> */
exports.auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next(ApiError.unauthorized('Token tidak ditemukan'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(ApiError.unauthorized('Token tidak valid atau kedaluwarsa'));
  }
};

/** Restriksi role: allow('admin', 'supervisor') */
exports.allow = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};
