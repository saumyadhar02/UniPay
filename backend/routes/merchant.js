const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const merchantCtrl = require('../controllers/merchantController');

router.post('/', auth, merchantCtrl.createMerchant);
router.get('/:id', merchantCtrl.getMerchant);

module.exports = router;
