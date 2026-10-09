const { z } = require('zod');

/** Helper tipe zod yang sering dipakai */
const optionalString = (max = 255) => z.string().max(max).optional();

// Query params selalu berupa string → perlu coerce.
// z.coerce.number() aman untuk body JSON (angka tetap angka).
const optionalInt = () => z.coerce.number().int().optional();

// Boolean query: "true"/"false" → boolean. JSON boolean tetap diterima.
const optionalBool = () =>
  z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean().optional());

const optionalDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional();

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { z, optionalString, optionalInt, optionalBool, optionalDate, paginationQuery };
