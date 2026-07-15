const mongoose = require('mongoose');

const MerchantSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  walletId: { type: String, required: true, uppercase: true },
  vpa: { type: String, lowercase: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

MerchantSchema.index({ walletId: 1 });

module.exports = mongoose.model('Merchant', MerchantSchema);
