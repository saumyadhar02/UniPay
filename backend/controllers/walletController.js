const User = require('../models/User');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcryptjs');
const { transferFunds } = require('../services/transferService');

// @desc    Send money to another user
// @route   POST /api/wallet/send
// @access  Private
exports.sendMoney = async (req, res) => {
  try {
    const { recipient, amount, pin, idempotencyKey } = req.body;

    if (!recipient || !amount || !pin) return res.status(400).json({ success: false, message: 'Missing fields' });

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // Verify sender and pin
    const sender = await User.findById(req.user.id);
    if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

    const isPinValid = await bcrypt.compare(pin, sender.pin);
    if (!isPinValid) return res.status(401).json({ success: false, message: 'Invalid PIN' });

    // Use transfer service to perform atomic transfer (it will validate recipient, balances, etc.)
    const result = await transferFunds({ senderId: sender._id, recipientIdentifier: recipient, amount: parsedAmount, idempotencyKey, description: `Sent to ${recipient}` });

    if (result && result.alreadyProcessed) {
      return res.json({ success: true, message: 'Transfer already processed', transactionId: result.transactionId });
    }

    res.json({ success: true, message: `Successfully sent ₹${parsedAmount.toFixed(2)}`, details: result });
  } catch (error) {
    console.error('Send Money Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Transaction failed' });
  }
};

// @desc    Add money using voucher code
// @route   POST /api/wallet/topup
// @access  Private
exports.topUp = async (req, res) => {
  try {
    const { voucherCode } = req.body;

    if (!voucherCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Voucher code is required' 
      });
    }

    // Predefined vouchers (In production, store in database)
    const vouchers = {
      'UNIPAY100': 100,
      'UNIPAY500': 500,
      'UNIPAY1000': 1000,
      'UNIPAY5000': 5000,
      'WELCOME50': 50,
      'BONUS200': 200
    };

    const code = voucherCode.toUpperCase().trim();
    const amount = vouchers[code];

    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid voucher code' 
      });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update balance
    user.balance += amount;
    await user.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: user._id,
      type: 'credit',
      amount,
      description: `Voucher Top-up (${code})`,
      balanceAfter: user.balance,
      status: 'completed'
    });

    await transaction.save();

    res.json({
      success: true,
      message: `Successfully added ₹${amount} to your wallet`,
      newBalance: user.balance,
      transaction: {
        id: transaction._id,
        amount,
        code,
        date: transaction.createdAt
      }
    });

  } catch (error) {
    console.error('Top Up Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Top-up failed. Please try again.' 
    });
  }
};

// @desc    Get transaction history
// @route   GET /api/wallet/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const transactions = await Transaction.find({ 
      userId: req.user.id 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments({ 
      userId: req.user.id 
    });

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transactions' 
    });
  }
};

// @desc    Get transaction details by ID
// @route   GET /api/wallet/transactions/:id
// @access  Private
exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('recipientId', 'name phone walletId');

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('Get Transaction Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transaction' 
    });
  }
};

// @desc    Get user balance
// @route   GET /api/wallet/balance
// @access  Private
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance name phone walletId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, balance: user.balance, user: { id: user._id, name: user.name, phone: user.phone, walletId: user.walletId } });
  } catch (error) {
    console.error('Get Balance Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balance' });
  }
};

// @desc    Save user's VPA (UPI VPA) in profile
// @route   POST /api/wallet/vpa
// @access  Private
exports.saveVpa = async (req, res) => {
  try {
    const { vpa } = req.body;
    if (!vpa || typeof vpa !== 'string' || !vpa.includes('@')) return res.status(400).json({ success: false, message: 'Valid VPA is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.vpa = vpa.trim().toLowerCase();
    await user.save();
    return res.json({ success: true, message: 'VPA saved', vpa: user.vpa });
  } catch (err) {
    console.error('Save VPA Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save VPA' });
  }
};