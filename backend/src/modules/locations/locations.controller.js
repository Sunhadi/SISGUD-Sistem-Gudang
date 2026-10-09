const { ok, created } = require('../../utils/apiResponse');
const service = require('./locations.service');
const { validate } = require('../../middlewares/validate');
const schemas = require('./locations.schema');

exports.list = [
  validate({ query: schemas.listQuery }),
  (req, res, next) => {
    service
      .listLocations(req.query)
      .then(({ data, meta }) => ok(res, data, meta))
      .catch(next);
  },
];

exports.get = [(req, res, next) => service.getLocation(Number(req.params.id)).then((d) => ok(res, d)).catch(next)];

exports.getStocks = [
  (req, res, next) => service.getLocationStocks(Number(req.params.id)).then((d) => ok(res, d)).catch(next),
];

exports.findByCode = [
  (req, res, next) => service.findByCode(req.params.code).then((d) => ok(res, d)).catch(next),
];

exports.create = [
  validate({ body: schemas.createSchema }),
  (req, res, next) => service.createLocation(req.body, req.user.id).then((d) => created(res, d)).catch(next),
];

exports.update = [
  validate({ body: schemas.updateSchema }),
  (req, res, next) => service.updateLocation(Number(req.params.id), req.body, req.user.id).then((d) => ok(res, d)).catch(next),
];

exports.remove = [
  (req, res, next) => service.deactivateLocation(Number(req.params.id), req.user.id).then((d) => ok(res, d)).catch(next),
];
