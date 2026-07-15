const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['reserve','release','topup','payout','transfer_in','transfer_out'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number },
  relatedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  metadata: { type: Object },
}, { timestamps: true });

LedgerEntrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
