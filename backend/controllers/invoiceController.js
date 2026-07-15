const Invoice = require('../models/Invoice');
const Merchant = require('../models/Merchant');
const { transferFunds } = require('../services/transferService');
const crypto = require('crypto');

exports.createInvoice = async (req, res) => {
  try {
    const { merchantId, amount, description } = req.body;
    if (!merchantId || !amount) return res.status(400).json({ success: false, message: 'merchantId and amount required' });
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) return res.status(404).json({ success: false, message: 'Merchant not found' });
    // Only merchant owner can create invoice
    if (String(merchant.owner) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Not authorized' });
    const invoiceId = 'inv_' + crypto.randomBytes(8).toString('hex');
    const inv = new Invoice({ invoiceId, merchant: merchant._id, amount, description });
    await inv.save();
    return res.json({ success: true, invoice: inv });
  } catch (err) {
    console.error('Create invoice error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne({ invoiceId: req.params.id }).populate('merchant');
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return res.json({ success: true, invoice: inv });
  } catch (err) {
    console.error('Get invoice error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// payer pays invoice via internal transfer
exports.payInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { pin } = req.body;
    const inv = await Invoice.findOne({ invoiceId }).populate('merchant');
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (inv.status !== 'pending') return res.status(400).json({ success: false, message: 'Invoice not payable' });

    // Use transferService to perform transfer from req.user to merchant.walletId
    // Verify PIN via User model
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(pin || '', user.pin);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid PIN' });

    const recipientIdentifier = inv.merchant.walletId || inv.merchant.vpa || inv.merchant._id.toString();
    const idemp = 'inv-' + inv.invoiceId;
    const result = await transferFunds({ senderId: user._id, recipientIdentifier, amount: inv.amount, idempotencyKey: idemp, description: `Invoice ${inv.invoiceId}` });
    if (result && result.success) {
      inv.status = 'paid';
      inv.payer = user._id;
      inv.providerPaymentId = result.transactionIds ? result.transactionIds.debit : undefined;
      await inv.save();
      return res.json({ success: true, message: 'Invoice paid', details: result });
    }
    return res.status(500).json({ success: false, message: 'Payment failed' });
  } catch (err) {
    console.error('Pay invoice error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
