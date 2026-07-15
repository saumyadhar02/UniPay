const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const qrCtrl = require('../controllers/qrController');

router.post('/pay', auth, qrCtrl.process);

module.exports = router;
