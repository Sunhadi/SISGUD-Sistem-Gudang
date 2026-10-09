const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { auth } = require('../../middlewares/auth');
const controller = require('./auth.controller');

const router = Router();

// Rate limit khusus login (blueprint: pasang rate limit terutama di login)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login, coba lagi nanti', errors: [] },
});

router.post('/login', loginLimiter, ...controller.login);
router.post('/logout', auth, ...controller.logout);
router.get('/me', auth, ...controller.me);
router.put('/change-password', auth, ...controller.changePassword);

module.exports = router;
