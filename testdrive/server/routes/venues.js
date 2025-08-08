const express = require('express');
const { query, validationResult } = require('express-validator');
const Venue = require('../models/Venue');
const Match = require('../models/Match');

const router = express.Router();

// Get all venues
router.get('/', [
  query('city').optional().trim(),
  query('state').optional().trim(),
  query('category').optional().isIn(['general', 'premium', 'vip']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { city, state, category, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    if (category) {
      filter['sections.category'] = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const venues = await Venue.find(filter)
      .select('name city state capacity images')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Venue.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      venues,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalVenues: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venue by ID
router.get('/:id', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json({ venue });
  } catch (error) {
    console.error('Get venue error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venue seating map
router.get('/:id/seating', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .select('sections capacity');

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    // Calculate seat availability by section
    const seatingData = venue.sections.map(section => ({
      name: section.name,
      category: section.category,
      capacity: section.capacity,
      availableSeats: section.rows.reduce((total, row) => {
        return total + row.seats.filter(seat => seat.isAvailable && !seat.isReserved).length;
      }, 0),
      priceRange: section.priceRange,
      amenities: section.amenities,
      isCovered: section.isCovered,
      viewQuality: section.viewQuality,
      rows: section.rows.map(row => ({
        name: row.name,
        seats: row.seats.map(seat => ({
          seatNumber: seat.seatNumber,
          isAvailable: seat.isAvailable && !seat.isReserved,
          price: seat.price,
          category: seat.category,
          coordinates: seat.coordinates,
          features: seat.features
        }))
      }))
    }));

    res.json({
      venue: {
        id: venue._id,
        capacity: venue.capacity,
        totalAvailableSeats: venue.availableSeats
      },
      seating: seatingData
    });
  } catch (error) {
    console.error('Get venue seating error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venue availability for a specific match
router.get('/:id/match/:matchId/availability', async (req, res) => {
  try {
    const { id: venueId, matchId } = req.params;

    const [venue, match] = await Promise.all([
      Venue.findById(venueId),
      Match.findById(matchId)
    ]);

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.venue.toString() !== venueId) {
      return res.status(400).json({ error: 'Match is not at this venue' });
    }

    // Get seat availability by section
    const availability = venue.sections.map(section => ({
      name: section.name,
      category: section.category,
      totalSeats: section.capacity,
      availableSeats: section.rows.reduce((total, row) => {
        return total + row.seats.filter(seat => seat.isAvailable && !seat.isReserved).length;
      }, 0),
      priceRange: section.priceRange,
      amenities: section.amenities
    }));

    res.json({
      match: {
        id: match._id,
        title: match.title,
        date: match.date,
        time: match.time,
        status: match.status
      },
      venue: {
        id: venue._id,
        name: venue.name,
        city: venue.city
      },
      availability
    });
  } catch (error) {
    console.error('Get venue availability error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Venue or match not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get seats by section
router.get('/:id/sections/:sectionName/seats', [
  query('category').optional().isIn(['general', 'premium', 'vip']),
  query('available').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id: venueId, sectionName } = req.params;
    const { category, available } = req.query;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const section = venue.sections.find(s => s.name === sectionName);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    let seats = [];
    section.rows.forEach(row => {
      row.seats.forEach(seat => {
        let includeSeat = true;

        if (category && seat.category !== category) {
          includeSeat = false;
        }

        if (available !== undefined) {
          const isAvailable = seat.isAvailable && !seat.isReserved;
          if (available === 'true' && !isAvailable) {
            includeSeat = false;
          }
          if (available === 'false' && isAvailable) {
            includeSeat = false;
          }
        }

        if (includeSeat) {
          seats.push({
            seatNumber: seat.seatNumber,
            row: row.name,
            section: section.name,
            category: seat.category,
            price: seat.price,
            isAvailable: seat.isAvailable && !seat.isReserved,
            coordinates: seat.coordinates,
            features: seat.features
          });
        }
      });
    });

    res.json({
      section: {
        name: section.name,
        category: section.category,
        capacity: section.capacity,
        amenities: section.amenities
      },
      seats
    });
  } catch (error) {
    console.error('Get section seats error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Search venues
router.get('/search/:query', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchFilter = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { city: { $regex: query, $options: 'i' } },
        { state: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };

    const venues = await Venue.find(searchFilter)
      .select('name city state capacity images')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Venue.countDocuments(searchFilter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      venues,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalVenues: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search venues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venues by city
router.get('/city/:cityName', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cityName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const venues = await Venue.find({ city: { $regex: cityName, $options: 'i' } })
      .select('name city state capacity images')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Venue.countDocuments({ city: { $regex: cityName, $options: 'i' } });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      venues,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalVenues: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get venues by city error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
