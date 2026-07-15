/**
 * Simple subscription processor. Run this periodically (cron, PM2, or scheduler).
 * It will find subscriptions with nextDate <= today and attempt payment.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const Subscription = require('../models/Subscription');
const subsCtrl = require('../controllers/subscriptionsController');

async function run() {
  try {
    await connectDB();
    const today = new Date();
    const due = await Subscription.find({ active: true, nextDate: { $lte: today } }).limit(100);
    console.log(`Found ${due.length} due subscriptions`);
    for (const sub of due) {
      console.log('Processing sub', sub._id.toString(), sub.service, sub.amount, sub.nextDate.toISOString().slice(0,10));
      const result = await subsCtrl.processOne(sub);
      console.log('Result', result);
    }
    process.exit(0);
  } catch (err) {
    console.error('Subscription job error', err);
    process.exit(1);
  }
}

if (require.main === module) run();
