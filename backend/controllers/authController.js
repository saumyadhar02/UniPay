const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Generate unique Wallet ID
const generateWalletId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let walletId = 'UP';
  for (let i = 0; i < 8; i++) {
    walletId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return walletId;
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { user: { id: userId } },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, phone, pin } = req.body;

    // Validation
    if (!name || !phone || !pin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Validate phone
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be exactly 10 digits' 
      });
    }

    // Validate PIN
    if (!/^[0-9]{4}$/.test(pin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'PIN must be exactly 4 digits' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({ phone });
    if (user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number already registered' 
      });
    }

    // Hash PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Generate unique wallet ID
    let walletId;
    let isUnique = false;
    while (!isUnique) {
      walletId = generateWalletId();
      const existingWallet = await User.findOne({ walletId });
      if (!existingWallet) isUnique = true;
    }

    // Create user
    user = new User({
      name: name.trim(),
      phone,
      pin: hashedPin,
      walletId,
      balance: 0
    });

    await user.save();

    // Create welcome transaction
    const welcomeTxn = new Transaction({
      userId: user._id,
      type: 'credit',
      amount: 0,
      description: 'Welcome to UniPay! 🎉',
      balanceAfter: 0,
      status: 'completed'
    });
    await welcomeTxn.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        walletId: user.walletId,
        balance: user.balance
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { phone, pin } = req.body;

    // Validation
    if (!phone || !pin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide phone number and PIN' 
      });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number or PIN' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is deactivated. Please contact support.' 
      });
    }

    // Verify PIN
    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number or PIN' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        walletId: user.walletId,
        balance: user.balance
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-pin');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};