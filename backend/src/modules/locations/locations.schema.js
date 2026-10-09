const { z, optionalString, optionalInt, paginationQuery } = require('../../utils/zodHelpers');

const LOC_TYPES = ['storage', 'receiving', 'staging', 'reject', 'hold'];

exports.listQuery = paginationQuery.extend({
  search: optionalString(100),
  zone: optionalString(20),
  type: z.enum(LOC_TYPES).optional(),
});

exports.createSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(50),
  zone: z.string().min(1).max(20),
  rack: optionalString(20),
  level: optionalString(20),
  bin: optionalString(20),
  type: z.enum(LOC_TYPES).default('storage'),
  capacity: optionalInt(),
  pos_x: optionalInt(),
  pos_y: optionalInt(),
  pos_z: optionalInt(),
});

exports.updateSchema = exports.createSchema.partial();
