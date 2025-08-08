const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
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
  isAvailable: {
    type: Boolean,
    default: true
  },
  isReserved: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'premium', 'vip'],
    default: 'general'
  },
  coordinates: {
    x: Number,
    y: Number
  },
  features: [String], // e.g., ['aisle', 'handicap-accessible', 'covered']
  holdUntil: Date,
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }
});

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  capacity: {
    type: Number,
    required: true
  },
  priceRange: {
    min: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'premium', 'vip'],
    default: 'general'
  },
  amenities: [String], // e.g., ['food-service', 'beverages', 'restrooms']
  isCovered: {
    type: Boolean,
    default: false
  },
  viewQuality: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'limited'],
    default: 'good'
  },
  rows: [{
    name: String,
    seats: [seatSchema]
  }]
});

const venueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  capacity: {
    type: Number,
    required: true
  },
  sections: [sectionSchema],
  facilities: {
    parking: {
      available: { type: Boolean, default: true },
      capacity: Number,
      fee: Number
    },
    food: {
      available: { type: Boolean, default: true },
      vendors: [String]
    },
    beverages: {
      available: { type: Boolean, default: true },
      alcohol: { type: Boolean, default: false }
    },
    restrooms: {
      available: { type: Boolean, default: true },
      count: Number
    },
    accessibility: {
      wheelchairAccessible: { type: Boolean, default: true },
      elevators: { type: Boolean, default: true },
      ramps: { type: Boolean, default: true }
    },
    security: {
      metalDetectors: { type: Boolean, default: true },
      bagCheck: { type: Boolean, default: true },
      prohibitedItems: [String]
    }
  },
  images: {
    main: String,
    gallery: [String],
    seatingMap: String
  },
  description: String,
  rules: [String],
  contact: {
    phone: String,
    email: String,
    website: String
  },
  transportation: {
    metro: {
      available: { type: Boolean, default: false },
      station: String,
      distance: Number
    },
    bus: {
      available: { type: Boolean, default: false },
      routes: [String]
    },
    taxi: {
      available: { type: Boolean, default: true },
      standLocation: String
    }
  },
  weather: {
    current: {
      temperature: Number,
      condition: String,
      humidity: Number
    },
    forecast: [{
      date: Date,
      temperature: Number,
      condition: String,
      precipitation: Number
    }]
  }
}, {
  timestamps: true
});

// Index for efficient queries
venueSchema.index({ city: 1, state: 1 });
venueSchema.index({ 'sections.category': 1 });

// Virtual for total available seats
venueSchema.virtual('availableSeats').get(function() {
  let total = 0;
  this.sections.forEach(section => {
    section.rows.forEach(row => {
      row.seats.forEach(seat => {
        if (seat.isAvailable && !seat.isReserved) {
          total++;
        }
      });
    });
  });
  return total;
});

// Virtual for venue display name
venueSchema.virtual('displayName').get(function() {
  return `${this.name}, ${this.city}`;
});

// Method to get seat by ID
venueSchema.methods.getSeat = function(sectionName, rowName, seatNumber) {
  const section = this.sections.find(s => s.name === sectionName);
  if (!section) return null;
  
  const row = section.rows.find(r => r.name === rowName);
  if (!row) return null;
  
  return row.seats.find(s => s.seatNumber === seatNumber);
};

// Method to update seat availability
venueSchema.methods.updateSeatAvailability = function(sectionName, rowName, seatNumber, isAvailable, bookingId = null) {
  const seat = this.getSeat(sectionName, rowName, seatNumber);
  if (seat) {
    seat.isAvailable = isAvailable;
    seat.bookingId = bookingId;
    if (!isAvailable) {
      seat.holdUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes hold
    } else {
      seat.holdUntil = null;
    }
  }
  return seat;
};

// Method to get seats by category
venueSchema.methods.getSeatsByCategory = function(category) {
  const seats = [];
  this.sections.forEach(section => {
    section.rows.forEach(row => {
      row.seats.forEach(seat => {
        if (seat.category === category && seat.isAvailable && !seat.isReserved) {
          seats.push({
            ...seat.toObject(),
            section: section.name,
            row: row.name
          });
        }
      });
    });
  });
  return seats;
};

// Method to get price range
venueSchema.methods.getPriceRange = function() {
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  this.sections.forEach(section => {
    section.rows.forEach(row => {
      row.seats.forEach(seat => {
        if (seat.price < minPrice) minPrice = seat.price;
        if (seat.price > maxPrice) maxPrice = seat.price;
      });
    });
  });
  
  return { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice === -Infinity ? 0 : maxPrice };
};

module.exports = mongoose.model('Venue', venueSchema);
