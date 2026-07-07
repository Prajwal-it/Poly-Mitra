const express = require('express');
const router = express.Router();
const College = require('../model/college');

// GET all colleges
router.get('/', async (req, res) => {
  try {
    const data = await College.find();
    return res.json(data);
  } catch (err) {
    console.error('GET /api/colleges failed:', err);
    return res.status(500).json({ message: 'Failed to fetch colleges' });
  }
});

// POST - add a new college
router.post('/', async (req, res) => {
  try {
    const college = new College(req.body);
    const saved = await college.save();
    return res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/colleges failed:', err);
    return res.status(500).json({ message: 'Failed to add college' });
  }
});

module.exports = router;
