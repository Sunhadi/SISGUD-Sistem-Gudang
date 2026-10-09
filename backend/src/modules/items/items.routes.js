const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./items.controller');

const router = Router();

router.use(auth);

// Master data: admin & supervisor penuh; operator & viewer hanya lihat (matriks blueprint)
router.get('/', ...controller.list);
router.get('/barcode/:code', ...controller.findByBarcode);
router.get('/export', ...controller.exportExcel);
router.get('/:id', ...controller.get);

router.post('/', allow('admin', 'supervisor'), ...controller.create);
router.put('/:id', allow('admin', 'supervisor'), ...controller.update);
router.delete('/:id', allow('admin', 'supervisor'), ...controller.remove);
router.post('/import', allow('admin', 'supervisor'), ...controller.importExcel);

module.exports = router;
