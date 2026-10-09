const { ok, created } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const service = require('./opname.service');
const schemas = require('./opname.schema');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.list = [
  validate({ query: schemas.listQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.listOpname(req.query);
    ok(res, data, meta);
  }),
];

exports.get = [wrap(async (req, res) => ok(res, await service.getOpname(Number(req.params.id))))];

exports.create = [
  validate({ body: schemas.createSchema }),
  wrap(async (req, res) => {
    const d = await service.createOpname(req.body, req.user.id);
    created(res, d);
  }),
];

exports.count = [
  validate({ body: schemas.countSchema }),
  wrap(async (req, res) => ok(res, await service.countOpname(Number(req.params.id), req.body, req.user.id))),
];

exports.submit = [
  wrap(async (req, res) => ok(res, await service.submitOpname(Number(req.params.id), req.user.id))),
];

exports.approve = [
  validate({ body: schemas.approveSchema }),
  wrap(async (req, res) => ok(res, await service.approveOpname(Number(req.params.id), req.body, req.user.id))),
];

exports.cancel = [
  wrap(async (req, res) => ok(res, await service.cancelOpname(Number(req.params.id), req.user.id))),
];
