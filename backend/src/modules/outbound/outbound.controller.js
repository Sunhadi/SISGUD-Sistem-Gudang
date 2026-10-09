const { ok, created } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const service = require('./outbound.service');
const schemas = require('./outbound.schema');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.list = [
  validate({ query: schemas.listQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.listOutbound(req.query);
    ok(res, data, meta);
  }),
];

exports.get = [wrap(async (req, res) => ok(res, await service.getOutbound(Number(req.params.id))))];

exports.create = [
  validate({ body: schemas.createSchema }),
  wrap(async (req, res) => {
    const d = await service.createOutbound(req.body, req.user.id);
    created(res, d);
  }),
];

exports.update = [
  validate({ body: schemas.updateSchema }),
  wrap(async (req, res) => ok(res, await service.updateOutbound(Number(req.params.id), req.body, req.user.id))),
];

exports.allocate = [
  wrap(async (req, res) => ok(res, await service.allocateOutbound(Number(req.params.id), req.user.id))),
];

exports.pickingTasks = [
  wrap(async (req, res) => ok(res, await service.getPickingTasks(Number(req.params.id)))),
];

exports.pick = [
  validate({ body: schemas.pickSchema }),
  wrap(async (req, res) => ok(res, await service.pickOutbound(Number(req.params.id), req.body, req.user.id))),
];

exports.pack = [
  validate({ body: schemas.packSchema }),
  wrap(async (req, res) => ok(res, await service.packOutbound(Number(req.params.id), req.body, req.user.id))),
];

exports.ship = [
  validate({ body: schemas.shipSchema }),
  wrap(async (req, res) => ok(res, await service.shipOutbound(Number(req.params.id), req.body, req.user.id))),
];

exports.cancel = [
  wrap(async (req, res) => ok(res, await service.cancelOutbound(Number(req.params.id), req.user.id))),
];

exports.timeline = [
  validate({ query: schemas.timelineQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.getOutboundTimeline(Number(req.params.id), req.query);
    ok(res, data, meta);
  }),
];
