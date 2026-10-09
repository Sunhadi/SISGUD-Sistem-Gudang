const { ok, created } = require('../../utils/apiResponse');
const service = require('./users.service');
const { validate } = require('../../middlewares/validate');
const schemas = require('./users.schema');

exports.list = [
  validate({ query: schemas.listQuery }),
  (req, res, next) => {
    service
      .listUsers(req.query)
      .then(({ data, meta }) => ok(res, data, meta))
      .catch(next);
  },
];

exports.get = [(req, res, next) => service.getUser(Number(req.params.id)).then((d) => ok(res, d)).catch(next)];

exports.create = [
  validate({ body: schemas.createSchema }),
  (req, res, next) => {
    service
      .createUser(req.body, req.user.id)
      .then((d) => created(res, d))
      .catch(next);
  },
];

exports.update = [
  validate({ body: schemas.updateSchema }),
  (req, res, next) => {
    service
      .updateUser(Number(req.params.id), req.body, req.user.id)
      .then((d) => ok(res, d))
      .catch(next);
  },
];

exports.remove = [
  (req, res, next) => {
    service
      .deactivateUser(Number(req.params.id), req.user.id)
      .then((d) => ok(res, d))
      .catch(next);
  },
];
