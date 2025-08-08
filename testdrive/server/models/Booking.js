const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  seatNumber: {
    type: String,
    required: true
  },
  row: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'premium', 'vip'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  qrCode: String,
  ticketId: {
    type: String,
    unique: true
  }
});

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  tickets: [ticketSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  taxes: {
    type: Number,
    default: 0
  },
  fees: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  discountCode: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'refunded', 'expired'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'],
    required: true
  },
  paymentDetails: {
    transactionId: String,
    gateway: String,
    cardLast4: String,
    upiId: String
  },
  holdExpiresAt: {
    type: Date,
    required: true
  },
  bookingCode: {
    type: String,
    unique: true,
    required: true
  },
  contactInfo: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  specialRequests: [String],
  cancellationPolicy: {
    refundable: {
      type: Boolean,
      default: false
    },
    refundUntil: Date,
    cancellationFee: {
      type: Number,
      default: 0
    }
  },
  notifications: {
    emailSent: {
      type: Boolean,
      default: false
    },
    smsSent: {
      type: Boolean,
      default: false
    },
    pushSent: {
      type: Boolean,
      default: false
    }
  },
  notes: String,
  refundDetails: {
    amount: Number,
    reason: String,
    processedAt: Date,
    transactionId: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ match: 1, status: 1 });
bookingSchema.index({ bookingCode: 1 });
bookingSchema.index({ 'paymentDetails.transactionId': 1 });
bookingSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate booking code
bookingSchema.pre('save', function(next) {
  if (this.isNew && !this.bookingCode) {
    this.bookingCode = this.generateBookingCode();
  }
  
  if (this.isNew && !this.holdExpiresAt) {
    this.holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  }
  
  next();
});

// Generate unique booking code
bookingSchema.methods.generateBookingCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate ticket IDs
bookingSchema.methods.generateTicketIds = function() {
  this.tickets.forEach((ticket, index) => {
    ticket.ticketId = `${this.bookingCode}-T${String(index + 1).padStart(3, '0')}`;
  });
};

// Calculate total amount
bookingSchema.methods.calculateTotal = function() {
  this.subtotal = this.tickets.reduce((sum, ticket) => sum + ticket.price, 0);
  this.totalAmount = this.subtotal + this.taxes + this.fees - this.discount;
  return this.totalAmount;
};

// Check if booking is expired
bookingSchema.methods.isExpired = function() {
  return new Date() > this.holdExpiresAt;
};

// Check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  if (this.status !== 'confirmed') return false;
  if (!this.cancellationPolicy.refundable) return false;
  if (this.cancellationPolicy.refundUntil && new Date() > this.cancellationPolicy.refundUntil) return false;
  return true;
};

// Get refund amount
bookingSchema.methods.getRefundAmount = function() {
  if (!this.canBeCancelled()) return 0;
  
  let refundAmount = this.totalAmount;
  
  // Apply cancellation fee
  if (this.cancellationPolicy.cancellationFee > 0) {
    refundAmount -= this.cancellationPolicy.cancellationFee;
  }
  
  return Math.max(0, refundAmount);
};

// Virtual for ticket count
bookingSchema.virtual('ticketCount').get(function() {
  return this.tickets.length;
});

// Virtual for formatted total amount
bookingSchema.virtual('formattedTotal').get(function() {
  return `₹${this.totalAmount.toLocaleString()}`;
});

// Virtual for booking status display
bookingSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Payment Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    expired: 'Expired'
  };
  return statusMap[this.status] || this.status;
});

// Method to confirm booking
bookingSchema.methods.confirm = function(paymentDetails) {
  this.status = 'confirmed';
  this.paymentStatus = 'completed';
  this.paymentDetails = paymentDetails;
  this.generateTicketIds();
  return this.save();
};

// Method to cancel booking
bookingSchema.methods.cancel = function(reason = 'User requested cancellation') {
  this.status = 'cancelled';
  this.refundDetails = {
    amount: this.getRefundAmount(),
    reason: reason,
    processedAt: new Date()
  };
  return this.save();
};

// Method to expire booking
bookingSchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

module.exports = mongoose.model('Booking', bookingSchema);
