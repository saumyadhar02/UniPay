const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[0-9]{10}$/, 'Please enter valid 10-digit phone number']
  },
  pin: {
    type: String,
    required: [true, 'PIN is required']
  },
  walletId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  // Optional saved VPA (e.g. yourid@bank) so incoming provider webhooks can match payees
  vpa: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  // Amount reserved for pending payouts (not available for spending)
  reservedBalance: {
    type: Number,
    default: 0,
    min: [0, 'Reserved balance cannot be negative']
  },
  // Minimal KYC fields
  kycStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'verified', 'rejected'],
    default: 'not_submitted'
  },
  kycDocuments: [{
    type: String // store references/URLs to uploaded doc images
  }],
  kycSubmittedAt: { type: Date },
  // Simple PIN failure tracking
  failedPinAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
UserSchema.index({ phone: 1 });
UserSchema.index({ walletId: 1 });
UserSchema.index({ vpa: 1 }, { sparse: true });

module.exports = mongoose.model('User', UserSchema);