const Subscription = require('../models/Subscription');
const auth = require('../middleware/auth');
const { transferFunds } = require('../services/transferService');

// Create subscription
exports.create = async (req, res) => {
  try {
    const { service, payee, amount, nextDate, freq } = req.body;
    if (!service || !payee || !amount || !nextDate) return res.status(400).json({ success: false, message: 'Missing fields' });

    const sub = new Subscription({ userId: req.user.id, service, payee, amount, nextDate: new Date(nextDate), freq: freq || 'monthly' });
    await sub.save();
    res.status(201).json({ success: true, subscription: sub });
  } catch (err) {
    console.error('Create Subscription Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// List subscriptions for user
exports.list = async (req, res) => {
  try {
    const subs = await Subscription.find({ userId: req.user.id, active: true }).sort({ nextDate: 1 });
    res.json({ success: true, subscriptions: subs });
  } catch (err) {
    console.error('List Subscriptions Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Cancel subscription
exports.cancel = async (req, res) => {
  try {
    const id = req.params.id;
    const sub = await Subscription.findOne({ _id: id, userId: req.user.id });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });
    sub.active = false;
    await sub.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Cancel Sub Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// For admin/cron: process a single subscription (attempt payment)
exports.processOne = async (sub) => {
  try {
    if (!sub.active) return { success: false, reason: 'inactive' };
    const idempotencyKey = `sub:${sub._id.toString()}:${sub.nextDate.toISOString().slice(0,10)}`;
    // attempt transfer: sender is sub.userId, recipient is sub.payee
    const result = await transferFunds({ senderId: sub.userId, recipientIdentifier: sub.payee, amount: sub.amount, idempotencyKey, description: `Subscription ${sub.service}` });
    // advance nextDate (simple monthly advance)
    const nd = new Date(sub.nextDate);
    nd.setMonth(nd.getMonth() + 1);
    sub.nextDate = nd;
    await sub.save();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
