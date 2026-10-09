const { ok } = require('../../utils/apiResponse');
const authService = require('./auth.service');
const { validate } = require('../../middlewares/validate');
const schemas = require('./auth.schema');

exports.login = [
  validate({ body: schemas.loginSchema }),
  (req, res, next) => {
    authService
      .login(req.body, req.ip)
      .then((data) => ok(res, data))
      .catch(next);
  },
];

exports.logout = [
  (req, res, next) => {
    authService
      .logout(req.user.id, req.ip)
      .then(() => ok(res, { message: 'Logout berhasil' }))
      .catch(next);
  },
];

exports.me = [
  (req, res, next) => {
    authService
      .getMe(req.user.id)
      .then((data) => ok(res, data))
      .catch(next);
  },
];

exports.changePassword = [
  validate({ body: schemas.changePasswordSchema }),
  (req, res, next) => {
    authService
      .changePassword(req.user.id, req.body)
      .then(() => ok(res, { message: 'Password berhasil diubah' }))
      .catch(next);
  },
];
