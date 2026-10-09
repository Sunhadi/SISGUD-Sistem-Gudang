const { ok } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const { z, optionalString, optionalDate, paginationQuery } = require('../../utils/zodHelpers');
const service = require('./reports.service');
const exceljs = require('exceljs');
const { ApiError } = require('../../utils/errors');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.stockAging = [
  wrap(async (req, res) => ok(res, await service.stockAging())),
];

exports.dailyActivity = [
  validate({ query: paginationQuery.extend({
    date_from: optionalDate(), date_to: optionalDate(),
  }) }),
  wrap(async (req, res) => ok(res, await service.dailyActivity(req.query.date_from, req.query.date_to))),
];

exports.opnameAccuracy = [
  wrap(async (req, res) => ok(res, await service.opnameAccuracy())),
];

exports.movementsReport = [
  validate({ query: paginationQuery.extend({
    type: optionalString(20),
    date_from: optionalDate(), date_to: optionalDate(),
  }) }),
  wrap(async (req, res) => {
    const { data, meta } = await service.movementsReport(req.query);
    ok(res, data, meta);
  }),
];

/** Export Excel: /reports/:name/export */
exports.exportExcel = [
  validate({ query: paginationQuery.extend({
    type: optionalString(20),
    date_from: optionalDate(), date_to: optionalDate(),
  }) }),
  wrap(async (req, res) => {
    const name = req.params.name;
    let filename = `${name}.xlsx`;
    const workbook = new exceljs.Workbook();

    if (name === 'stock-aging') {
      const rows = await service.stockAging();
      const sheet = workbook.addWorksheet('Aging Stok');
      sheet.columns = [
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Nama', key: 'name', width: 36 },
        { header: 'Lokasi', key: 'location_code', width: 14 },
        { header: 'Batch', key: 'batch_no', width: 14 },
        { header: 'Qty', key: 'qty', width: 10 },
        { header: 'Diterima', key: 'received_at', width: 20 },
        { header: 'Usia (hari)', key: 'age_days', width: 12 },
        { header: 'Kategori Usia', key: 'age_bucket', width: 14 },
      ];
      rows.forEach((r) => sheet.addRow({ ...r, received_at: r.received_at }));
      filename = 'aging-stok.xlsx';
    } else if (name === 'daily-activity') {
      const rows = await service.dailyActivity(req.query.date_from, req.query.date_to);
      const sheet = workbook.addWorksheet('Aktivitas Harian');
      sheet.columns = [
        { header: 'Tanggal', key: 'date', width: 14 },
        { header: 'Total Mutasi', key: 'total_movements', width: 14 },
        { header: 'Qty Masuk', key: 'qty_in', width: 12 },
        { header: 'Qty Keluar', key: 'qty_out', width: 12 },
        { header: 'User Aktif', key: 'active_users', width: 12 },
      ];
      rows.forEach((r) => sheet.addRow(r));
      filename = 'aktivitas-harian.xlsx';
    } else if (name === 'opname-accuracy') {
      const rows = await service.opnameAccuracy();
      const sheet = workbook.addWorksheet('Akurasi Opname');
      sheet.columns = [
        { header: 'Dokumen', key: 'doc_no', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Item', key: 'total_items', width: 10 },
        { header: 'Dihitung', key: 'counted_items', width: 10 },
        { header: 'Selisih', key: 'diff_items', width: 10 },
        { header: 'Total Selisih Qty', key: 'total_diff_qty', width: 16 },
      ];
      rows.forEach((r) => sheet.addRow(r));
      filename = 'akurasi-opname.xlsx';
    } else if (name === 'movements') {
      const { data } = await service.movementsReport(req.query);
      const sheet = workbook.addWorksheet('Mutasi Harian');
      sheet.columns = [
        { header: 'Tanggal', key: 'date', width: 14 },
        { header: 'Tipe', key: 'type', width: 14 },
        { header: 'Qty', key: 'total_qty', width: 10 },
        { header: 'Jumlah Transaksi', key: 'count', width: 16 },
      ];
      data.forEach((r) => sheet.addRow(r));
      filename = 'mutasi-harian.xlsx';
    } else {
      throw ApiError.notFound('Laporan tidak dikenal');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }),
];
