/**
 * Generator nomor dokumen: PREFIX-YYYYMMDD-NNNN
 * Urutan reset per hari. Dipanggil di dalam transaction agar aman.
 */
async function nextDocNumber(client, table, prefix) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const pattern = `${prefix}-${ymd}-%`;

  // Kunci advisory per tabel+hari agar paralel tidak menghasilkan nomor ganda
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${table}:${ymd}`]);

  const res = await client.query(
    `SELECT doc_no FROM ${table} WHERE doc_no LIKE $1 ORDER BY doc_no DESC LIMIT 1`,
    [pattern]
  );

  let seq = 1;
  if (res.rows[0]) {
    const tail = res.rows[0].doc_no.split('-').pop();
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}-${ymd}-${String(seq).padStart(4, '0')}`;
}

module.exports = { nextDocNumber };
