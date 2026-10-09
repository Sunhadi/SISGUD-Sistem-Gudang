const { ok, created } = require('../../utils/apiResponse');
const service = require('./items.service');
const { validate } = require('../../middlewares/validate');
const schemas = require('./items.schema');

exports.list = [
  validate({ query: schemas.listQuery }),
  (req, res, next) => {
    service
      .listItems(req.query)
      .then(({ data, meta }) => ok(res, data, meta))
      .catch(next);
  },
];

exports.get = [(req, res, next) => service.getItem(Number(req.params.id)).then((d) => ok(res, d)).catch(next)];

exports.create = [
  validate({ body: schemas.createSchema }),
  (req, res, next) => service.createItem(req.body, req.user.id).then((d) => created(res, d)).catch(next),
];

exports.update = [
  validate({ body: schemas.updateSchema }),
  (req, res, next) => service.updateItem(Number(req.params.id), req.body, req.user.id).then((d) => ok(res, d)).catch(next),
];

exports.remove = [
  (req, res, next) => service.deactivateItem(Number(req.params.id), req.user.id).then((d) => ok(res, d)).catch(next),
];

exports.findByBarcode = [
  (req, res, next) => service.findByBarcode(req.params.code).then((d) => ok(res, d)).catch(next),
];

exports.importExcel = [
  validate({ body: schemas.importSchema }),
  (req, res, next) => service.importItems(req.body.file_base64, req.user.id).then((d) => created(res, d)).catch(next),
];

exports.exportExcel = [
  async (req, res, next) => {
    try {
      const buffer = await service.exportItemsExcel();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="barang.xlsx"');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
];
