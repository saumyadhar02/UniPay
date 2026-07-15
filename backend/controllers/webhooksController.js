const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Example Razorpay webhook handler skeleton
exports.razorpay = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (signature !== expected) return res.status(400).send('invalid signature');

    const event = req.body.event;
    // handle payment authorized / captured events and credit user wallet
    if (event === 'payment.captured') {
      const payload = req.body.payload.payment.entity;
      // You must map payload to your own payment-intent record to find user
      // For demo: assume payload.notes.phone contains user phone
      const phone = payload.notes && payload.notes.phone;
      const amount = payload.amount / 100; // Razorpay amount in paise
      if (phone) {
        const user = await User.findOne({ phone });
        if (user) {
          user.balance += amount;
          await user.save();
          const txn = new Transaction({ userId: user._id, type: 'credit', amount, description: 'Top-up via Razorpay', balanceAfter: user.balance, status: 'completed' });
          await txn.save();
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(500).json({ ok: false });
  }
};

// Generic provider webhook handler. Accepts provider-specific payloads or a normalized payload:
// { provider, providerPaymentId, amount, currency, phone, walletId, topupId, metadata }
exports.generic = async (req, res) => {
  try {
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || '';
    const signatureHeader = req.headers['x-provider-signature'] || req.headers['x-signature'];
    // If a secret is configured, validate HMAC-SHA256 of raw body (if provided)
    if (secret && signatureHeader) {
      const raw = req.rawBody || JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      if (signatureHeader !== expected) {
        console.warn('Webhook signature mismatch');
        return res.status(400).json({ ok: false, message: 'invalid signature' });
      }
    }

    // Try to normalize payload
    const body = req.body || {};
    const provider = body.provider || body.source || 'unknown';
    const providerPaymentId = body.providerPaymentId || body.payment_id || (body.payload && body.payload.payment && body.payload.payment.entity && body.payload.payment.entity.id);
    let amount = body.amount || body.value || (body.payload && body.payload.payment && body.payload.payment.entity && body.payload.payment.entity.amount);
    // many providers send amount in paise/cents — if it's large, and looks like paise, try to normalize
    if (amount && amount > 100000) {
      amount = amount / 100;
    }
    if (amount) amount = Number(amount);

    const phone = body.phone || (body.payload && body.payload.payment && body.payload.payment.entity && body.payload.payment.entity.notes && body.payload.payment.entity.notes.phone) || null;
    const walletId = body.walletId || body.wallet || (body.payload && body.payload.payment && body.payload.payment.entity && body.payload.payment.entity.notes && body.payload.payment.entity.notes.walletId) || null;
    // Some providers include the UPI payload or payee VPA as 'pa' or 'vpa' or 'to'
    const paField = (body.pa || body.vpa || body.to || (body.payload && body.payload.payment && body.payload.payment.entity && (body.payload.payment.entity.pa || body.payload.payment.entity.vpa || body.payload.payment.entity.to))) || null;
    const topupId = body.topupId || body.order_id || null;

    if (!amount || (!phone && !walletId && !topupId)) {
      console.warn('Webhook missing required fields', { provider, providerPaymentId, amount, phone, walletId, topupId });
      return res.status(400).json({ ok: false, message: 'missing fields' });
    }

    // Locate user by phone, walletId, or payee VPA if provided
    let user = null;
    if (phone) {
      user = await User.findOne({ phone });
      if (user) console.info('Webhook matched user by phone', phone);
    }
    if (!user && walletId) {
      user = await User.findOne({ walletId: walletId.toUpperCase() });
      if (user) console.info('Webhook matched user by walletId', walletId);
    }
    // If provider included a payee VPA (pa/vpa/to), try to resolve to a local user
    if (!user && paField) {
      const paLower = String(paField).trim().toLowerCase();
      // If it's internal unipay vpa like walletid@unipay, extract wallet id
      if (paLower.endsWith('@unipay')){
        const candidate = paLower.split('@')[0].toUpperCase();
        user = await User.findOne({ walletId: candidate });
        if (user) console.info('Webhook matched user by internal unipay VPA', candidate);
      }
      // Otherwise try matching a saved VPA on the user profile
      if (!user){
        user = await User.findOne({ vpa: { $regex: new RegExp('^' + paLower.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$', 'i') } });
        if (user) console.info('Webhook matched user by saved VPA', paLower);
      }
    }

    if (!user) {
      console.warn('Webhook: user not found for incoming payment', { phone, walletId });
      return res.status(404).json({ ok: false, message: 'user not found' });
    }
    // If providerPaymentId or topupId match an existing pending transaction, settle it instead of creating a duplicate
    if (providerPaymentId || topupId) {
      const query = providerPaymentId ? { 'metadata.providerPaymentId': providerPaymentId } : { 'metadata.topupId': topupId };
      const existing = await Transaction.findOne(query);
      if (existing) {
        if (existing.status === 'pending') {
          // settle depending on direction
          if (existing.direction === 'topup') {
            // credit user now
            user.balance = (user.balance || 0) + amount;
            await user.save();
            existing.status = 'completed';
            existing.amount = amount;
            existing.balanceAfter = user.balance;
            existing.metadata = Object.assign(existing.metadata || {}, { provider, providerPaymentId, topupId });
            await existing.save();
            const LedgerEntry = require('../models/LedgerEntry');
            const le = new LedgerEntry({ userId: user._id, type: 'topup', amount, balanceAfter: user.balance, relatedTransactionId: existing._id, metadata: { provider } });
            await le.save();
            return res.json({ ok: true, credited: amount, balance: user.balance, settled: true });
          } else if (existing.direction === 'payout') {
            // payout settled by provider: reduce reservedBalance
            user.reservedBalance = Math.max(0, (user.reservedBalance || 0) - existing.amount);
            // user.balance already decreased at reserve time; don't add to balance
            await user.save();
            existing.status = 'completed';
            existing.metadata = Object.assign(existing.metadata || {}, { provider, providerPaymentId, topupId });
            await existing.save();
            const LedgerEntry = require('../models/LedgerEntry');
            const le = new LedgerEntry({ userId: user._id, type: 'payout', amount: existing.amount, balanceAfter: user.balance, relatedTransactionId: existing._id, metadata: { provider } });
            await le.save();
            return res.json({ ok: true, settled: true, balance: user.balance });
          }
        }
        // If already completed or settled, ignore duplicate
        return res.json({ ok: true, alreadyProcessed: true, balance: user.balance });
      }
    }

    // No matching pending tx found; treat as immediate top-up credit
    user.balance = (user.balance || 0) + amount;
    await user.save();

    const txn = new Transaction({
      userId: user._id,
      type: 'credit',
      amount,
      description: `Top-up via ${provider}`,
      balanceAfter: user.balance,
      status: 'completed',
      direction: 'topup',
      metadata: { provider, providerPaymentId, topupId }
    });
    await txn.save();

    const LedgerEntry = require('../models/LedgerEntry');
    const le = new LedgerEntry({ userId: user._id, type: 'topup', amount, balanceAfter: user.balance, relatedTransactionId: txn._id, metadata: { provider } });
    await le.save();

    return res.json({ ok: true, credited: amount, balance: user.balance });
  } catch (err) {
    console.error('Generic webhook error', err);
    return res.status(500).json({ ok: false, message: 'server error' });
  }
};
