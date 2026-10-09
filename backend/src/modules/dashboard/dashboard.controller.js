const { ok } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const { z, optionalDate } = require('../../utils/zodHelpers');
const service = require('./dashboard.service');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.summary = [
  wrap(async (req, res) => ok(res, await service.summary())),
];

exports.throughput = [
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(90).default(14) }) }),
  wrap(async (req, res) => ok(res, await service.throughput(req.query.days))),
];

exports.utilization = [
  wrap(async (req, res) => ok(res, await service.utilization())),
];

exports.overdue = [
  wrap(async (req, res) => ok(res, await service.overdue())),
];
