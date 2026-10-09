const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./inbound.controller');

const router = Router();
router.use(auth);

// Operasional inbound: admin, supervisor, operator_inbound (matriks blueprint)
const op = allow('admin', 'supervisor', 'operator_inbound');

router.get('/', ...controller.list);
router.get('/:id', ...controller.get);
router.get('/:id/timeline', ...controller.timeline);

router.post('/', op, ...controller.create);
router.put('/:id', op, ...controller.update);
router.post('/:id/receive', op, ...controller.receive);
router.post('/:id/qc', op, ...controller.qc);
router.post('/:id/putaway', op, ...controller.putaway);
router.post('/:id/cancel', allow('admin', 'supervisor'), ...controller.cancel);

module.exports = router;
