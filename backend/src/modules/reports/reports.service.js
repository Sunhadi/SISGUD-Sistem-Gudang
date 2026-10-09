const pool = require('../../config/db');
const { ApiError } = require('../../utils/errors');
const { pageOpts, metaOf } = require('../../utils/pagination');

/** Aging stok: usia stok per barang (batch) */
async function stockAging(daysBuckets = [7, 30, 90, 180]) {
  const res = await pool.query(
    `SELECT s.item_id, i.sku, i.name, i.uom,
            s.location_id, l.code AS location_code,
            s.batch_no, s.expiry_date, s.qty, s.received_at,
            (CURRENT_DATE - s.received_at::date)::int AS age_days,
            CASE
              WHEN (CURRENT_DATE - s.received_at::date) <= $1 THEN '0-7 hari'
              WHEN (CURRENT_DATE - s.received_at::date) <= $2 THEN '8-30 hari'
              WHEN (CURRENT_DATE - s.received_at::date) <= $3 THEN '31-90 hari'
              WHEN (CURRENT_DATE - s.received_at::date) <= $4 THEN '91-180 hari'
              ELSE '>180 hari'
            END AS age_bucket
     FROM stocks s
     JOIN items i ON i.id = s.item_id
     JOIN locations l ON l.id = s.location_id
     WHERE s.qty > 0
     ORDER BY age_days DESC`,
    daysBuckets
  );
  return res.rows;
}

/** Aktivitas harian: jumlah mutasi & qty per hari */
async function dailyActivity(dateFrom, dateTo) {
  const params = [];
  const where = [];
  if (dateFrom) { params.push(dateFrom); where.push(`m.created_at::date >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); where.push(`m.created_at::date <= $${params.length}`); }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT m.created_at::date AS date,
            COUNT(*)::int AS total_movements,
            COALESCE(SUM(m.qty) FILTER (WHERE m.type IN ('inbound','putaway','adjustment')), 0)::int AS qty_in,
            COALESCE(SUM(m.qty) FILTER (WHERE m.type IN ('outbound','transfer','reject')), 0)::int AS qty_out,
            COUNT(DISTINCT m.user_id)::int AS active_users
     FROM stock_movements m
     ${sqlWhere}
     GROUP BY m.created_at::date
     ORDER BY m.created_at::date DESC`,
    params
  );
  return res.rows;
}

/** Akurasi opname per sesi */
async function opnameAccuracy() {
  const res = await pool.query(
    `SELECT s.id, s.doc_no, s.status, s.created_at, s.approved_at,
            u.name AS created_by_name, ua.name AS approved_by_name,
            COUNT(oi.id)::int AS total_items,
            COUNT(oi.id) FILTER (WHERE oi.qty_counted IS NOT NULL)::int AS counted_items,
            COUNT(oi.id) FILTER (WHERE oi.qty_counted IS NOT NULL AND oi.qty_counted <> oi.qty_system)::int AS diff_items,
            COALESCE(SUM(ABS(oi.qty_counted - oi.qty_system)) FILTER (WHERE oi.qty_counted IS NOT NULL), 0)::int AS total_diff_qty
     FROM stock_opname_sessions s
     LEFT JOIN stock_opname_items oi ON oi.session_id = s.id
     LEFT JOIN users u ON u.id = s.created_by
     LEFT JOIN users ua ON ua.id = s.approved_by
     GROUP BY s.id, u.name, ua.name
     ORDER BY s.id DESC`
  );
  return res.rows;
}

/** Mutasi harian (untuk laporan + export) */
async function movementsReport(query) {
  const { page, limit, offset } = pageOpts(query);
  const where = [];
  const params = [];
  if (query.type) { params.push(query.type); where.push(`m.type = $${params.length}`); }
  if (query.date_from) { params.push(query.date_from); where.push(`m.created_at::date >= $${params.length}`); }
  if (query.date_to) { params.push(query.date_to); where.push(`m.created_at::date <= $${params.length}`); }
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM stock_movements m ${sqlWhere}`, params);
  const res = await pool.query(
    `SELECT m.created_at::date AS date, m.type,
            COALESCE(SUM(m.qty), 0)::int AS total_qty, COUNT(*)::int AS count
     FROM stock_movements m
     ${sqlWhere}
     GROUP BY m.created_at::date, m.type
     ORDER BY m.created_at::date DESC, m.type
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { data: res.rows, meta: metaOf(page, limit, count.rows[0].total) };
}

module.exports = { stockAging, dailyActivity, opnameAccuracy, movementsReport };
