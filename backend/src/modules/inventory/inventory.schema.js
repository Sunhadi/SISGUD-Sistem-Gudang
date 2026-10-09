const { z, optionalString, optionalInt, optionalDate, paginationQuery } = require('../../utils/zodHelpers');

exports.stocksQuery = paginationQuery.extend({
  search: optionalString(100),
  item_id: optionalInt(),
  location_id: optionalInt(),
  status: optionalString(20),
  batch_no: optionalString(50),
});

exports.movementsQuery = paginationQuery.extend({
  item_id: optionalInt(),
  location_id: optionalInt(),
  type: optionalString(20),
  ref_type: optionalString(30),
  ref_id: optionalInt(),
  date_from: optionalDate(),
  date_to: optionalDate(),
});

exports.transferSchema = z.object({
  item_id: z.number().int().min(1),
  from_location: z.number().int().min(1),
  to_location: z.number().int().min(1),
  qty: z.number().int().min(1, 'qty minimal 1'),
  batch_no: optionalString(50),
  note: optionalString(500),
});

exports.adjustmentSchema = z.object({
  item_id: z.number().int().min(1),
  location_id: z.number().int().min(1),
  qty_new: z.number().int().min(0, 'qty_new tidak boleh negatif'),
  reason: z.string().min(1, 'Alasan wajib diisi').max(500),
  batch_no: optionalString(50),
});

exports.stockCardQuery = paginationQuery.extend({
  date_from: optionalDate(),
  date_to: optionalDate(),
});

exports.lowStockQuery = paginationQuery;
exports.expiringQuery = paginationQuery.extend({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

exports.summaryQuery = paginationQuery.extend({
  search: optionalString(100),
});
