// src/routes/patients.js
const router = require('express').Router();
const ctrl = require('../controllers/patientController');
const auth = require('../middleware/auth');
router.use(auth);
router.get('/search', ctrl.search);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.get('/:id/timeline', ctrl.getTimeline);
module.exports = router;
