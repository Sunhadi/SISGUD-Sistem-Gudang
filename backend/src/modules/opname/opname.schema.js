const { z, optionalString, optionalInt, paginationQuery } = require('../../utils/zodHelpers');

exports.listQuery = paginationQuery.extend({
  status: optionalString(20),
  search: optionalString(100),
});

exports.createSchema = z.object({
  note: optionalString(500),
  // Bila tidak ada, seluruh stok aktif di-snapshot otomatis
  items: z.array(z.object({
    item_id: optionalInt(),
    location_id: optionalInt(),
  })).optional(),
});

exports.countSchema = z.object({
  items: z.array(z.object({
    item_id: z.number().int().min(1),
    location_id: z.number().int().min(1),
    qty_counted: z.number().int().min(0),
    note: optionalString(500),
  })).min(1),
});

exports.approveSchema = z.object({
  note: optionalString(500),
});
