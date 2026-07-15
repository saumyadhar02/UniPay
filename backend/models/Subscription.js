const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  service: { type: String, required: true },
  payee: { type: String, required: true }, // phone or account
  amount: { type: Number, required: true },
  nextDate: { type: Date, required: true },
  freq: { type: String, default: 'monthly' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
