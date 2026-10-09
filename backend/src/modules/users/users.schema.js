const { z, optionalString, optionalInt, optionalBool, paginationQuery } = require('../../utils/zodHelpers');

const ROLES = ['admin', 'supervisor', 'operator_inbound', 'operator_outbound', 'viewer'];

exports.listQuery = z.object({
  search: optionalString(100),
  role: z.enum(ROLES).optional(),
  is_active: optionalBool(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

exports.createSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(ROLES, 'Role tidak valid'),
});

exports.updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional(),
  is_active: optionalBool(),
  password: z.string().min(6).optional(),
});
