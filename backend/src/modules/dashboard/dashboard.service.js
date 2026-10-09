const pool = require('../../config/db');

/** Angka ringkas dashboard (blueprint 6.7) */
async function summary() {
  const res = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM items WHERE is_active = TRUE) AS total_sku,
       (SELECT COUNT(*)::int FROM locations WHERE is_active = TRUE) AS total_locations,
       (SELECT COALESCE(SUM(qty), 0)::int FROM stocks WHERE status = 'available') AS total_stock,
       (SELECT COUNT(*)::int FROM inbound_orders WHERE created_at::date = CURRENT_DATE) AS inbound_today,
       (SELECT COUNT(*)::int FROM outbound_orders WHERE created_at::date = CURRENT_DATE) AS outbound_today,
       (SELECT COUNT(*)::int FROM outbound_orders
         WHERE status NOT IN ('shipped','cancelled')
           AND due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS overdue_orders,
       (SELECT COUNT(*)::int FROM items i
         WHERE i.is_active = TRUE
           AND i.min_stock > COALESCE((SELECT SUM(s.qty) FROM stocks s WHERE s.item_id = i.id AND s.status='available'), 0)
       )::int AS low_stock_count,
       (SELECT COUNT(*)::int FROM outbound_orders WHERE status = 'ready_to_ship')::int AS ready_to_ship`
  );
  return res.rows[0];
}

/** Throughput harian: qty masuk & keluar per hari (N hari terakhir) */
async function throughput(days = 14) {
  const res = await pool.query(
    `SELECT d::date AS date,
            COALESCE(SUM(m.qty) FILTER (WHERE m.type = 'inbound'), 0)::int AS qty_in,
            COALESCE(SUM(m.qty) FILTER (WHERE m.type IN ('outbound','transfer')), 0)::int AS qty_out,
            COUNT(m.id)::int AS movements
     FROM generate_series(CURRENT_DATE - $1::int, CURRENT_DATE, '1 day') AS d
     LEFT JOIN stock_movements m ON m.created_at::date = d::date
     GROUP BY d::date
     ORDER BY d::date`,
    [days - 1]
  );
  return res.rows;
}

/** Utilisasi lokasi: terpakai vs kapasitas */
async function utilization() {
  const res = await pool.query(
    `SELECT l.id, l.code, l.zone, l.type, l.capacity,
            COALESCE(SUM(s.qty), 0)::int AS qty_used,
            CASE WHEN l.capacity IS NULL OR l.capacity = 0 THEN NULL
                 ELSE ROUND(100.0 * COALESCE(SUM(s.qty), 0) / l.capacity, 1) END AS pct_used
     FROM locations l
     LEFT JOIN stocks s ON s.location_id = l.id
     WHERE l.is_active = TRUE
     GROUP BY l.id
     ORDER BY l.code`
  );
  return res.rows;
}

/** Daftar outbound order terlambat (belum dikirim & lewat jatuh tempo) */
async function overdue() {
  const res = await pool.query(
    `SELECT oo.id, oo.doc_no, oo.status, oo.priority, oo.due_date, oo.created_at,
            c.name AS customer_name
     FROM outbound_orders oo
     LEFT JOIN customers c ON c.id = oo.customer_id
     WHERE oo.status NOT IN ('shipped','cancelled')
       AND oo.due_date IS NOT NULL AND oo.due_date < CURRENT_DATE
     ORDER BY oo.due_date ASC`
  );
  return res.rows;
}

module.exports = { summary, throughput, utilization, overdue };
