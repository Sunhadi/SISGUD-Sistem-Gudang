const { z, optionalString, optionalInt, optionalBool, paginationQuery } = require('../../utils/zodHelpers');

exports.listQuery = paginationQuery.extend({
  search: optionalString(100),
  category: optionalString(100),
  is_active: optionalBool(),
});

exports.createSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi').max(50),
  name: z.string().min(1, 'Nama wajib diisi').max(200),
  category: optionalString(100),
  uom: z.string().max(20).default('pcs'),
  length_cm: optionalInt(),
  width_cm: optionalInt(),
  height_cm: optionalInt(),
  weight_kg: optionalInt(),
  min_stock: z.coerce.number().int().min(0).default(0),
  barcode: optionalString(100),
  is_batch: optionalBool(),
  has_expiry: optionalBool(),
});

exports.updateSchema = exports.createSchema.partial();

exports.importSchema = z.object({
  // File Excel dikirim sebagai base64 agar tidak perlu dependency multipart tambahan
  file_base64: z.string().min(1, 'File wajib diisi'),
});
