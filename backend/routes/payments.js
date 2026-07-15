const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentsController = require('../controllers/paymentsController');

// Initiate top-up (returns topup id to be used by frontend when completing payment)
router.post('/topup/init', auth, paymentsController.initTopup);

// Complete top-up (webhook or SDK could call this)
// Use a raw body parser for this route so we can verify provider HMAC signatures reliably.
router.post('/topup/complete', express.raw({ type: '*/*', limit: '256kb' }), paymentsController.completeTopup);

module.exports = router;
