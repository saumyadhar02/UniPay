const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const walletController = require('../controllers/walletController');

// @route   GET /api/wallet/balance
// @desc    Get user balance
// @access  Private
router.get('/balance', auth, walletController.getBalance);

// @route   POST /api/wallet/send
// @desc    Send money to another user
// @access  Private
router.post('/send', auth, walletController.sendMoney);

// @route   POST /api/wallet/topup
// @desc    Add money using voucher
// @access  Private
router.post('/topup', auth, walletController.topUp);

// @route   POST /api/wallet/vpa
// @desc    Save user VPA (e.g., yourid@bank)
// @access  Private
router.post('/vpa', auth, walletController.saveVpa);

// @route   GET /api/wallet/transactions
// @desc    Get transaction history
// @access  Private
router.get('/transactions', auth, walletController.getTransactions);

// @route   GET /api/wallet/transactions/:id
// @desc    Get transaction by ID
// @access  Private
router.get('/transactions/:id', auth, walletController.getTransactionById);

module.exports = router;