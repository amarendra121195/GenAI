const express = require('express');
const { query, validationResult } = require('express-validator');
const Match = require('../models/Match');
const Venue = require('../models/Venue');

const router = express.Router();

// Get all matches with filtering
router.get('/', [
  query('team').optional().trim(),
  query('venue').optional().trim(),
  query('date').optional().isISO8601(),
  query('status').optional().isIn(['upcoming', 'live', 'completed', 'cancelled']),
  query('featured').optional().isBoolean(),
  query('minPrice').optional().isNumeric(),
  query('maxPrice').optional().isNumeric(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      team,
      venue,
      date,
      status,
      featured,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10
    } = req.query;

    // Build filter object
    const filter = {};

    if (team) {
      filter.$or = [
        { 'team1.name': { $regex: team, $options: 'i' } },
        { 'team2.name': { $regex: team, $options: 'i' } },
        { 'team1.shortName': { $regex: team, $options: 'i' } },
        { 'team2.shortName': { $regex: team, $options: 'i' } }
      ];
    }

    if (venue) {
      filter['venue'] = venue;
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    if (status) {
      filter.status = status;
    }

    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    // Price filtering
    if (minPrice || maxPrice) {
      filter.$or = [];
      
      if (minPrice) {
        filter.$or.push(
          { 'ticketPricing.general.price': { $gte: parseFloat(minPrice) } },
          { 'ticketPricing.premium.price': { $gte: parseFloat(minPrice) } },
          { 'ticketPricing.vip.price': { $gte: parseFloat(minPrice) } }
        );
      }
      
      if (maxPrice) {
        filter.$or.push(
          { 'ticketPricing.general.price': { $lte: parseFloat(maxPrice) } },
          { 'ticketPricing.premium.price': { $lte: parseFloat(maxPrice) } },
          { 'ticketPricing.vip.price': { $lte: parseFloat(maxPrice) } }
        );
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get matches with venue population
    const matches = await Match.find(filter)
      .populate('venue', 'name city state capacity')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Match.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      matches,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMatches: total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get featured matches
router.get('/featured', async (req, res) => {
  try {
    const matches = await Match.find({ featured: true })
      .populate('venue', 'name city state')
      .sort({ date: 1 })
      .limit(6);

    res.json({ matches });
  } catch (error) {
    console.error('Get featured matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get upcoming matches
router.get('/upcoming', [
  query('limit').optional().isInt({ min: 1, max: 20 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { limit = 10 } = req.query;
    const now = new Date();

    const matches = await Match.find({
      date: { $gte: now },
      status: 'upcoming'
    })
      .populate('venue', 'name city state')
      .sort({ date: 1 })
      .limit(parseInt(limit));

    res.json({ matches });
  } catch (error) {
    console.error('Get upcoming matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get match by ID
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('venue', 'name city state address capacity facilities images description rules contact transportation weather');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ match });
  } catch (error) {
    console.error('Get match error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Search matches
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
        { title: { $regex: query, $options: 'i' } },
        { 'team1.name': { $regex: query, $options: 'i' } },
        { 'team2.name': { $regex: query, $options: 'i' } },
        { 'team1.shortName': { $regex: query, $options: 'i' } },
        { 'team2.shortName': { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    const matches = await Match.find(searchFilter)
      .populate('venue', 'name city state')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Match.countDocuments(searchFilter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      matches,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMatches: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get matches by team
router.get('/team/:teamName', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teamName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const teamFilter = {
      $or: [
        { 'team1.name': { $regex: teamName, $options: 'i' } },
        { 'team2.name': { $regex: teamName, $options: 'i' } },
        { 'team1.shortName': { $regex: teamName, $options: 'i' } },
        { 'team2.shortName': { $regex: teamName, $options: 'i' } }
      ]
    };

    const matches = await Match.find(teamFilter)
      .populate('venue', 'name city state')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Match.countDocuments(teamFilter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      matches,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMatches: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get matches by team error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get matches by venue
router.get('/venue/:venueId', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { venueId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matches = await Match.find({ venue: venueId })
      .populate('venue', 'name city state')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Match.countDocuments({ venue: venueId });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      matches,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMatches: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get matches by venue error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
