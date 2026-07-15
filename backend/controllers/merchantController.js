const Merchant = require('../models/Merchant');
const User = require('../models/User');

exports.createMerchant = async (req, res) => {
  try {
    const { name, description, vpa } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const walletId = user.walletId;
    const m = new Merchant({ owner: user._id, name, description, walletId, vpa: vpa ? vpa.toLowerCase() : undefined });
    await m.save();
    return res.json({ success: true, merchant: m });
  } catch (err) {
    console.error('Create merchant error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMerchant = async (req, res) => {
  try {
    const m = await Merchant.findById(req.params.id).populate('owner', 'name phone walletId');
    if (!m) return res.status(404).json({ success: false, message: 'Merchant not found' });
    return res.json({ success: true, merchant: m });
  } catch (err) {
    console.error('Get merchant error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
