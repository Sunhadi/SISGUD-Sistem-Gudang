const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./opname.controller');

const router = Router();
router.use(auth);

// Matrix blueprint: stock opname — semua role kecuali viewer
const op = allow('admin', 'supervisor', 'operator_inbound', 'operator_outbound');

router.get('/', ...controller.list);
router.get('/:id', ...controller.get);

router.post('/', op, ...controller.create);
router.post('/:id/count', op, ...controller.count);
router.post('/:id/submit', op, ...controller.submit);
// Approve hanya supervisor & admin
router.post('/:id/approve', allow('admin', 'supervisor'), ...controller.approve);
router.post('/:id/cancel', op, ...controller.cancel);

module.exports = router;
