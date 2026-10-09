const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./locations.controller');

const router = Router();
router.use(auth);

router.get('/', ...controller.list);
router.get('/code/:code', ...controller.findByCode);
router.get('/:id/stocks', ...controller.getStocks);
router.get('/:id', ...controller.get);

router.post('/', allow('admin', 'supervisor'), ...controller.create);
router.put('/:id', allow('admin', 'supervisor'), ...controller.update);
router.delete('/:id', allow('admin', 'supervisor'), ...controller.remove);

module.exports = router;
