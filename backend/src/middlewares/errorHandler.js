const { ZodError } = require('zod');
const { ApiError } = require('../utils/errors');

/** Error handler seragam: { success: false, message, errors } */
module.exports = function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, errors: err.errors || [] });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body JSON tidak valid', errors: [] });
  }
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat)', errors: [] });
  }

  res.status(500).json({ success: false, message: 'Terjadi kesalahan server', errors: [] });
};
