const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const invoiceCtrl = require('../controllers/invoiceController');

router.post('/', auth, invoiceCtrl.createInvoice);
router.get('/:id', invoiceCtrl.getInvoice);
router.post('/:id/pay', auth, invoiceCtrl.payInvoice);

module.exports = router;
