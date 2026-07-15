const { transferFunds } = require('../services/transferService');

// POST /api/qr/pay
// body: { payload }
exports.process = async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ success: false, message: 'Missing payload' });

    // parse payload (supports pay:PHONE:AMOUNT and service:TYPE:ACCOUNT:AMOUNT)
    const p = payload.trim();
    if (p.startsWith('unipay://')) {
      // parse query
      try {
        const url = new URL(p);
        const to = url.searchParams.get('to');
        const amount = parseFloat(url.searchParams.get('amount'));
        if (to && amount) {
          const r = await transferFunds({ senderId: req.user.id, recipientIdentifier: to, amount, description: 'QR payment' });
          return res.json({ success: true, r });
        }
      } catch (e) { /* ignore */ }
    }

    const parts = p.split(':');
    if (parts[0] === 'pay' && parts.length >= 3) {
      const to = parts[1];
      const amount = parseFloat(parts[2]);
      const r = await transferFunds({ senderId: req.user.id, recipientIdentifier: to, amount, description: 'QR payment' });
      return res.json({ success: true, r });
    }

    if (parts[0] === 'service' && parts.length >= 4) {
      const svc = parts[1];
      const acct = parts[2];
      const amount = parseFloat(parts[3]);
      const r = await transferFunds({ senderId: req.user.id, recipientIdentifier: acct, amount, description: `Service ${svc}` });
      return res.json({ success: true, r });
    }

    return res.status(400).json({ success: false, message: 'Unsupported QR payload' });
  } catch (err) {
    console.error('QR process error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
