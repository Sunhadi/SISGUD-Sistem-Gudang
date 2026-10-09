const { ok, created } = require('../../utils/apiResponse');
const service = require('./customers.service');
const { validate } = require('../../middlewares/validate');
const schemas = require('./customers.schema');

exports.list = [
  validate({ query: schemas.listQuery }),
  (req, res, next) => service.list(req.query).then(({ data, meta }) => ok(res, data, meta)).catch(next),
];
exports.get = [(req, res, next) => service.get(Number(req.params.id)).then((d) => ok(res, d)).catch(next)];
exports.create = [
  validate({ body: schemas.createSchema }),
  (req, res, next) => service.create(req.body, req.user.id).then((d) => created(res, d)).catch(next),
];
exports.update = [
  validate({ body: schemas.updateSchema }),
  (req, res, next) => service.update(Number(req.params.id), req.body, req.user.id).then((d) => ok(res, d)).catch(next),
];
exports.remove = [
  (req, res, next) => service.remove(Number(req.params.id), req.user.id).then((d) => ok(res, d)).catch(next),
];
