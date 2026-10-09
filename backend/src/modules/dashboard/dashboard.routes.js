const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const controller = require('./dashboard.controller');

const router = Router();
router.use(auth);

router.get('/summary', ...controller.summary);
router.get('/throughput', ...controller.throughput);
router.get('/utilization', ...controller.utilization);
router.get('/overdue', ...controller.overdue);

module.exports = router;
