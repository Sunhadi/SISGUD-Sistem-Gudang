const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./inventory.controller');

const router = Router();
router.use(auth);

// Baca: semua role termasuk viewer
router.get('/stocks', ...controller.stocks);
router.get('/stocks/summary', ...controller.summary);
router.get('/movements', ...controller.movements);
router.get('/stock-card/:itemId', ...controller.stockCard);
router.get('/low-stock', ...controller.lowStock);
router.get('/expiring', ...controller.expiring);

// Tulis: admin & supervisor (penyesuaian stok butuh approval-level akses)
router.post('/transfer', allow('admin', 'supervisor'), ...controller.transfer);
router.post('/adjustment', allow('admin', 'supervisor'), ...controller.adjustment);

module.exports = router;
