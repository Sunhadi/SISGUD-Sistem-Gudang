const { z, optionalString, optionalInt, optionalDate, paginationQuery } = require('../../utils/zodHelpers');

exports.listQuery = paginationQuery.extend({
  search: optionalString(100),
  status: optionalString(20),
  customer_id: optionalInt(),
  priority: optionalInt(),
});

exports.createSchema = z.object({
  customer_id: optionalInt(),
  due_date: optionalDate(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  note: optionalString(500),
  items: z.array(z.object({
    item_id: z.number().int().min(1, 'item_id wajib diisi'),
    qty_ordered: z.number().int().min(1, 'qty_ordered minimal 1'),
  })).min(1, 'Minimal 1 item'),
});

exports.updateSchema = z.object({
  customer_id: optionalInt(),
  due_date: optionalDate(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  note: optionalString(500),
  items: z.array(z.object({
    item_id: z.number().int().min(1),
    qty_ordered: z.number().int().min(1),
  })).min(1).optional(),
});

exports.pickSchema = z.object({
  tasks: z.array(z.object({
    task_id: z.number().int().min(1),
    qty_picked: z.number().int().min(1, 'qty_picked minimal 1'),
  })).min(1),
});

exports.packSchema = z.object({
  items: z.array(z.object({
    item_id: z.number().int().min(1),
    qty_packed: z.number().int().min(0),
  })).min(1),
});

exports.shipSchema = z.object({
  note: optionalString(500),
});

exports.timelineQuery = paginationQuery;
