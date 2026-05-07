const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const { protect, authorize } = require('../middleware/auth');

// GET /api/hospital — All hospitals
router.get('/', protect, async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true });
    res.json({ success: true, hospitals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/hospital — Add hospital (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const hospital = await Hospital.create(req.body);
    res.status(201).json({ success: true, hospital });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/hospital/:id/beds — Update bed count
router.put('/:id/beds', protect, authorize('admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { beds: req.body.beds }, { new: true });
    res.json({ success: true, hospital });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
