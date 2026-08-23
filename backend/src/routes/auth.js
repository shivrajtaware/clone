// src/routes/auth.js
const router = require('express').Router();
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');
const { validate, validators } = require('../middleware/validation');
router.post('/login', validators.loginValidator, validate, ctrl.login);
router.post('/refresh', ctrl.refreshToken);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);
router.put('/change-password', auth, validators.changePasswordValidator, validate, ctrl.changePassword);
router.get('/sessions', auth, ctrl.listSessions);
router.delete('/sessions/:id', auth, ctrl.revokeSession);
router.delete('/sessions', auth, ctrl.revokeAllSessions);
module.exports = router;
