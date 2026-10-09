const { z, optionalString, optionalInt, optionalDate, paginationQuery } = require('../../utils/zodHelpers');

exports.listQuery = paginationQuery.extend({
  search: optionalString(100),
  status: optionalString(20),
  supplier_id: optionalInt(),
});

const itemLine = z.object({
  item_id: z.number().int().min(1, 'item_id wajib diisi'),
  qty_expected: z.number().int().min(1, 'qty_expected minimal 1'),
  batch_no: optionalString(50),
  expiry_date: optionalDate(),
});

exports.createSchema = z.object({
  supplier_id: optionalInt(),
  expected_at: optionalDate(),
  note: optionalString(500),
  items: z.array(itemLine).min(1, 'Minimal 1 item'),
});

exports.updateSchema = z.object({
  supplier_id: optionalInt(),
  expected_at: optionalDate(),
  note: optionalString(500),
  items: z.array(itemLine).min(1).optional(),
});

exports.receiveSchema = z.object({
  items: z.array(z.object({
    item_id: z.number().int().min(1),
    qty_received: z.number().int().min(1, 'qty_received minimal 1'),
  })).min(1),
});

exports.qcSchema = z.object({
  items: z.array(z.object({
    item_id: z.number().int().min(1),
    qty_accepted: z.coerce.number().int().min(0).default(0),
    qty_hold: z.coerce.number().int().min(0).default(0),
    qty_rejected: z.coerce.number().int().min(0).default(0),
    reject_reason: optionalString(500),
  })).min(1),
});

exports.putawaySchema = z.object({
  item_id: z.number().int().min(1),
  location_id: z.number().int().min(1),
  qty: z.number().int().min(1, 'qty minimal 1'),
  batch_no: optionalString(50),
});

exports.timelineQuery = paginationQuery;
