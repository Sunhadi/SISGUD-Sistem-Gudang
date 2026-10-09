const { Router } = require('express');
const { auth, allow } = require('../../middlewares/auth');
const controller = require('./users.controller');

const router = Router();

// Hanya admin yang bisa mengelola user (matriks akses blueprint)
router.use(auth, allow('admin'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
