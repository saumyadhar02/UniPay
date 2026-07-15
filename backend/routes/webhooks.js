const express = require('express');
const router = express.Router();
const webhooksCtrl = require('../controllers/webhooksController');

// Razorpay webhook endpoint
router.post('/razorpay', express.json(), webhooksCtrl.razorpay);
// Generic provider webhook (normalize different providers)
router.post('/generic', express.json({ verify: (req, res, buf) => { req.rawBody = buf.toString(); } }), webhooksCtrl.generic);

module.exports = router;
