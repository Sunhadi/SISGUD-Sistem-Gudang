const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./outbound.controller');

const router = Router();
router.use(auth);

// Baca: semua role
router.get('/', ...controller.list);
router.get('/:id', ...controller.get);
router.get('/:id/picking-tasks', ...controller.pickingTasks);
router.get('/:id/timeline', ...controller.timeline);

// Operasional outbound: admin, supervisor, operator_outbound
const op = allow('admin', 'supervisor', 'operator_outbound');

router.post('/', op, ...controller.create);
router.put('/:id', op, ...controller.update);
router.post('/:id/allocate', op, ...controller.allocate);
router.post('/:id/pick', op, ...controller.pick);
router.post('/:id/pack', op, ...controller.pack);
router.post('/:id/ship', op, ...controller.ship);
router.post('/:id/cancel', allow('admin', 'supervisor'), ...controller.cancel);

module.exports = router;
