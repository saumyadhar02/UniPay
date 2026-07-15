const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true, index: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  description: { type: String },
  status: { type: String, enum: ['pending','paid','cancelled','failed'], default: 'pending' },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  providerPaymentId: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
