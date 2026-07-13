// src/routes/auth.js
const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refreshToken);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);
router.put('/change-password', auth, ctrl.changePassword);
module.exports = router;
