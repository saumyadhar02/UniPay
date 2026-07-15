const crypto = require('crypto');
const Topup = require('../models/Topup');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const axios = require('axios');

// POST /api/payments/topup/init
// Creates a topup record and (in production) would call provider to create a payment intent.
exports.initTopup = async (req, res) => {
  try {
    const { amount, provider = 'razorpay', currency = 'INR', metadata = {} } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // Create topup record
    const topup = new Topup({ userId: req.user.id, provider, amount, currency, metadata });
    await topup.save();

    // In a real integration we would call the provider SDK/API here to create a payment
    // For Razorpay: create an order and return order id to frontend. For now return the topup id.

    res.status(201).json({ success: true, topupId: topup._id, amount: topup.amount, currency: topup.currency });
  } catch (error) {
    console.error('Init Topup Error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate top-up' });
  }
};

// POST /api/payments/topup/complete
// Endpoint to mark a topup completed (used by webhook handler)
exports.completeTopup = async (req, res) => {
  try {
    // Support both raw buffer body (for HMAC verification) and parsed JSON body.
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    // Verify HMAC signature if configured
    const secret = process.env.PROVIDER_WEBHOOK_SECRET;
    if (secret) {
      // Look for common signature headers
      const sigHeader = req.headers['x-provider-signature'] || req.headers['x-signature'] || req.headers['x-razorpay-signature'] || req.headers['x-hub-signature'];
      if (!sigHeader) {
        console.warn('Payments webhook missing signature header');
        return res.status(400).json({ success: false, message: 'Missing signature header' });
      }
      const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sigHeader))) {
        console.warn('Payments webhook signature mismatch');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    let payload;
    try {
      payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody.toString()) : req.body;
    } catch (err) {
      console.error('Failed to parse webhook body', err);
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }

    const { topupId, providerPaymentId } = payload;
    const topup = topupId ? await Topup.findById(topupId) : null;
    // If we have an explicit topup record
    if (topup) {
      if (topup.status === 'completed') return res.json({ success: true, message: 'Already completed' });

      // Idempotency: ensure we haven't already recorded a transaction for this providerPaymentId
      if (providerPaymentId) {
        const existing = await Transaction.findOne({ 'metadata.providerPaymentId': providerPaymentId });
        if (existing) return res.json({ success: true, message: 'Already processed', transactionId: existing._id });
      }

      // Credit user balance
      const user = await User.findById(topup.userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      user.balance = (user.balance || 0) + topup.amount;
      await user.save();

      // Create transaction record
      const txn = new Transaction({ userId: user._id, type: 'credit', amount: topup.amount, description: `Top-up via ${topup.provider}`, balanceAfter: user.balance, status: 'completed', metadata: { providerPaymentId: providerPaymentId || null, topupId: topup._id } });
      await txn.save();

      topup.status = 'completed';
      topup.providerPaymentId = providerPaymentId || topup.providerPaymentId;
      await topup.save();

      return res.json({ success: true, message: 'Top-up completed', newBalance: user.balance, transactionId: txn._id });
    }

    // No explicit topup record: attempt to match user by common identifiers and create an immediate top-up
    let user = null;
    const { phone, walletId, pa, vpa, amount, provider } = payload;
    if (walletId) user = await User.findOne({ walletId });
    if (!user && phone) {
      const norm = phone.toString().replace(/\D/g, '');
      const last10 = norm.slice(-10);
      user = await User.findOne({ phone: { $regex: last10 + '$' } });
    }
    if (!user && vpa) user = await User.findOne({ vpa });

    if (!user) return res.status(404).json({ success: false, message: 'User not found for provided webhook data' });

    const amt = Number(amount) || 0;
    if (amt <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // Idempotency: check providerPaymentId
    if (providerPaymentId) {
      const existing = await Transaction.findOne({ 'metadata.providerPaymentId': providerPaymentId });
      if (existing) return res.json({ success: true, message: 'Already processed', transactionId: existing._id });
    }

    user.balance = (user.balance || 0) + amt;
    await user.save();

    const txn = new Transaction({ userId: user._id, type: 'credit', amount: amt, description: `Top-up via ${provider || 'webhook'}`, balanceAfter: user.balance, status: 'completed', metadata: { providerPaymentId: providerPaymentId || null } });
    await txn.save();

    return res.json({ success: true, message: 'Top-up applied', newBalance: user.balance, transactionId: txn._id });
  } catch (error) {
    console.error('Complete Topup Error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete top-up' });
  }
};
