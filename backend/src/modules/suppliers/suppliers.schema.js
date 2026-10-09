const { z, optionalString, paginationQuery } = require('../../utils/zodHelpers');

const base = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(30),
  name: z.string().min(1, 'Nama wajib diisi').max(150),
  phone: optionalString(30),
  address: optionalString(500),
});

exports.listQuery = paginationQuery.extend({
  search: optionalString(100),
});
exports.createSchema = base;
exports.updateSchema = base.partial();
