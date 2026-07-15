const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * Transfer funds atomically between users using MongoDB transactions.
 * @param {Object} opts
 * @param {String|mongoose.Types.ObjectId} opts.senderId - MongoDB user id of sender
 * @param {String} opts.recipientIdentifier - phone or walletId of recipient
 * @param {Number} opts.amount
 * @param {String} [opts.idempotencyKey] - optional idempotency key
 * @param {String} [opts.description]
 * @returns {Object} result with success, txnIds, balances
 */
async function transferFunds({ senderId, recipientIdentifier, amount, idempotencyKey, description, reserveForPayout = false, direction = 'transfer', providerReference = null }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Idempotency: check if already processed
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ 'metadata.idempotencyKey': idempotencyKey }).session(session);
      if (existing) {
        await session.commitTransaction();
        return { success: true, alreadyProcessed: true, transactionId: existing._id };
      }
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error('Invalid amount');

    // Load sender and recipient with session
    const sender = await User.findById(senderId).session(session);
    if (!sender) throw new Error('Sender not found');

    // Normalize recipient identifier: accept phone (with +91, spaces, dashes) or walletId
    const raw = String(recipientIdentifier || '').trim();
    // candidate walletId (uppercased)
    const walletCandidate = raw.toUpperCase();
    // candidate phone: strip non-digits, take last 10 digits if longer
    const digits = raw.replace(/\D/g, '');
    let phoneCandidate = digits;
    if (digits.length > 10) phoneCandidate = digits.slice(-10);

    const recipient = await User.findOne({
      $or: [
        { phone: phoneCandidate },
        { walletId: walletCandidate }
      ]
    }).session(session);
    if (!recipient) {
      // Log details to help debug mismatched formats from clients
      console.warn('transferService: recipient lookup failed', { raw: recipientIdentifier, phoneCandidate, walletCandidate });
      throw new Error('Recipient not found');
    }

    if (!recipient.isActive) throw new Error('Recipient account inactive');
    if (sender._id.toString() === recipient._id.toString()) throw new Error('Cannot send to self');

    if (reserveForPayout) {
      // Reserve flow: move funds from available balance into reservedBalance and create a pending transaction
      if (sender.balance < parsedAmount) throw new Error('Insufficient balance');
      sender.balance -= parsedAmount;
      sender.reservedBalance = (sender.reservedBalance || 0) + parsedAmount;
      await sender.save({ session });

      const pending = new Transaction({
        userId: sender._id,
        type: 'debit',
        amount: parsedAmount,
        description: description || `Payout reserved to ${recipientIdentifier}`,
        recipientName: recipient.name || recipientIdentifier,
        balanceAfter: sender.balance,
        status: 'pending',
        direction: direction || 'payout',
        metadata: { idempotencyKey: idempotencyKey || null, providerReference }
      });
      await pending.save({ session });

      // ledger entry
      const LedgerEntry = require('../models/LedgerEntry');
      const le = new LedgerEntry({ userId: sender._id, type: 'reserve', amount: parsedAmount, balanceAfter: sender.balance, relatedTransactionId: pending._id, metadata: { recipientIdentifier } });
      await le.save({ session });

      await session.commitTransaction();
      return { success: true, reserved: true, transactionId: pending._id, balances: { sender: sender.balance, reserved: sender.reservedBalance } };
    }

    // Regular internal transfer (instant)
    if (sender.balance < parsedAmount) throw new Error('Insufficient balance');

    // update balances
    sender.balance -= parsedAmount;
    recipient.balance += parsedAmount;

    await sender.save({ session });
    await recipient.save({ session });

    // create transactions
    const ts = new Date().toISOString();
    const debit = new Transaction({
      userId: sender._id,
      type: 'debit',
      amount: parsedAmount,
      description: description || `Sent to ${recipient.name || recipient.phone}`,
      recipientId: recipient._id,
      recipientName: recipient.name,
      balanceAfter: sender.balance,
      status: 'completed',
      direction: 'transfer',
      metadata: { idempotencyKey: idempotencyKey || null }
    });

    const credit = new Transaction({
      userId: recipient._id,
      type: 'credit',
      amount: parsedAmount,
      description: description || `Received from ${sender.name || sender.phone}`,
      recipientId: sender._id,
      recipientName: sender.name,
      balanceAfter: recipient.balance,
      status: 'completed',
      direction: 'transfer',
      metadata: { idempotencyKey: idempotencyKey || null }
    });

    await debit.save({ session });
    await credit.save({ session });

    await session.commitTransaction();
    return {
      success: true,
      transactionIds: { debit: debit._id, credit: credit._id },
      balances: { sender: sender.balance, recipient: recipient.balance }
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { transferFunds };
