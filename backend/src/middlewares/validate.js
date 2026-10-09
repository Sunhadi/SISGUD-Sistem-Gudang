const { ApiError } = require('../utils/errors');

/**
 * Validasi input dengan zod.
 * validate({ body: schema, query: schema, params: schema })
 */
exports.validate = (schemas = {}) => (req, res, next) => {
  const errors = [];
  for (const [key, schema] of Object.entries(schemas)) {
    if (!schema) continue;
    const parsed = schema.safeParse(req[key]);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ path: `${key}.${issue.path.join('.')}`, message: issue.message });
      }
    } else {
      req[key] = parsed.data;
    }
  }
  if (errors.length) return next(ApiError.badRequest('Validasi gagal', errors));
  next();
};
