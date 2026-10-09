const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const controller = require('./reports.controller');

const router = Router();
router.use(auth);

router.get('/stock-aging', ...controller.stockAging);
router.get('/daily-activity', ...controller.dailyActivity);
router.get('/opname-accuracy', ...controller.opnameAccuracy);
router.get('/movements', ...controller.movementsReport);
router.get('/:name/export', ...controller.exportExcel);

module.exports = router;
