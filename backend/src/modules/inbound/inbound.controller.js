const { ok, created } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const service = require('./inbound.service');
const schemas = require('./inbound.schema');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.list = [
  validate({ query: schemas.listQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.listInbound(req.query);
    ok(res, data, meta);
  }),
];

exports.get = [wrap(async (req, res) => ok(res, await service.getInbound(Number(req.params.id))))];

exports.create = [
  validate({ body: schemas.createSchema }),
  wrap(async (req, res) => {
    const d = await service.createInbound(req.body, req.user.id);
    created(res, d);
  }),
];

exports.update = [
  validate({ body: schemas.updateSchema }),
  wrap(async (req, res) => ok(res, await service.updateInbound(Number(req.params.id), req.body, req.user.id))),
];

exports.receive = [
  validate({ body: schemas.receiveSchema }),
  wrap(async (req, res) => ok(res, await service.receiveInbound(Number(req.params.id), req.body, req.user.id))),
];

exports.qc = [
  validate({ body: schemas.qcSchema }),
  wrap(async (req, res) => ok(res, await service.qcInbound(Number(req.params.id), req.body, req.user.id))),
];

exports.putaway = [
  validate({ body: schemas.putawaySchema }),
  wrap(async (req, res) => ok(res, await service.putawayInbound(Number(req.params.id), req.body, req.user.id))),
];

exports.cancel = [
  wrap(async (req, res) => ok(res, await service.cancelInbound(Number(req.params.id), req.user.id))),
];

exports.timeline = [
  validate({ query: schemas.timelineQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.getInboundTimeline(Number(req.params.id), req.query);
    ok(res, data, meta);
  }),
];
