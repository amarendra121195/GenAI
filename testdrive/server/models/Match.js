const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  team1: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    shortName: {
      type: String,
      required: true,
      trim: true
    },
    logo: String
  },
  team2: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    shortName: {
      type: String,
      required: true,
      trim: true
    },
    logo: String
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  matchNumber: {
    type: Number,
    required: true
  },
  season: {
    type: String,
    required: true,
    default: '2024'
  },
  description: String,
  highlights: [String],
  ticketPricing: {
    general: {
      price: Number,
      available: Number
    },
    premium: {
      price: Number,
      available: Number
    },
    vip: {
      price: Number,
      available: Number
    }
  },
  ticketSaleStart: {
    type: Date,
    required: true
  },
  ticketSaleEnd: {
    type: Date,
    required: true
  },
  isSoldOut: {
    type: Boolean,
    default: false
  },
  tags: [String],
  featured: {
    type: Boolean,
    default: false
  },
  weather: {
    temperature: Number,
    condition: String,
    humidity: Number
  },
  broadcast: {
    channel: String,
    streaming: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
matchSchema.index({ date: 1, status: 1 });
matchSchema.index({ 'team1.name': 1, 'team2.name': 1 });
matchSchema.index({ venue: 1 });
matchSchema.index({ featured: 1 });

// Virtual for match display name
matchSchema.virtual('displayName').get(function() {
  return `${this.team1.shortName} vs ${this.team2.shortName}`;
});

// Virtual for formatted date
matchSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for time remaining
matchSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const matchTime = new Date(this.date);
  const diff = matchTime - now;
  
  if (diff <= 0) return 'Match started';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
});

// Method to check if tickets are available
matchSchema.methods.hasAvailableTickets = function() {
  const totalAvailable = 
    this.ticketPricing.general.available +
    this.ticketPricing.premium.available +
    this.ticketPricing.vip.available;
  
  return totalAvailable > 0 && !this.isSoldOut;
};

// Method to get minimum ticket price
matchSchema.methods.getMinPrice = function() {
  const prices = [
    this.ticketPricing.general.price,
    this.ticketPricing.premium.price,
    this.ticketPricing.vip.price
  ].filter(price => price > 0);
  
  return Math.min(...prices);
};

// Method to get maximum ticket price
matchSchema.methods.getMaxPrice = function() {
  const prices = [
    this.ticketPricing.general.price,
    this.ticketPricing.premium.price,
    this.ticketPricing.vip.price
  ].filter(price => price > 0);
  
  return Math.max(...prices);
};

module.exports = mongoose.model('Match', matchSchema);
