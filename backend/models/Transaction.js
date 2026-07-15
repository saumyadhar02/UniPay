const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  description: {
    type: String,
    required: true,
    maxlength: [200, 'Description too long']
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipientName: {
    type: String
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'settled', 'failed'],
    default: 'completed'
  },
  // direction indicates whether this was a topup/payout/transfer
  direction: {
    type: String,
    enum: ['topup','payout','transfer'],
    default: 'transfer'
  },
  providerReserveId: { type: String },
  metadata: {
    ipAddress: String,
    userAgent: String,
    provider: String,
    providerPaymentId: String,
    topupId: String
  }
}, {
  timestamps: true
});

// Index for faster queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ type: 1 });
// Index provider payment ids & topup ids for idempotency checks
TransactionSchema.index({ 'metadata.providerPaymentId': 1 }, { sparse: true });
TransactionSchema.index({ 'metadata.topupId': 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', TransactionSchema);