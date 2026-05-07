const express = require('express');
const router = express.Router();
const Emergency = require('../models/Emergency');
const Hospital = require('../models/Hospital');
const { protect, authorize } = require('../middleware/auth');
const { getAIPriorityScore, rankHospitals } = require('../controllers/aiEngine');

// Billing config
const BILLING = {
  ALS: { base: 500, perKm: 30 },
  BLS: { base: 300, perKm: 20 },
  PTA: { base: 200, perKm: 15 }
};

function calcAmount(type, distanceKm) {
  const b = BILLING[type] || BILLING.BLS;
  return { baseCharge: b.base, perKmCharge: b.perKm, totalAmount: b.base + (b.perKm * distanceKm) };
}

// POST /api/emergency/request
router.post('/request', protect, authorize('patient'), async (req, res) => {
  try {
    const { condition, conditionCategory, description, severityScale, lat, lon, address,
            patientAge, patientGender, ambulanceType } = req.body;

    const { score: priorityScore, level: priorityLevel } = getAIPriorityScore(condition, severityScale);
    const hospitals = await Hospital.find({ isActive: true });
    const rankings = rankHospitals(hospitals, parseFloat(lat), parseFloat(lon), condition, priorityScore);

    if (!rankings.length) return res.status(404).json({ success: false, message: 'No hospitals found within 30km' });

    const topDist = rankings[0]?.distance || 5;
    const type = ambulanceType || 'BLS';
    const billing = calcAmount(type, topDist);

    const emergency = await Emergency.create({
      patient: req.user._id, patientName: req.user.name, patientPhone: req.user.phone,
      patientAge, patientGender, condition, conditionCategory, description,
      severityScale: severityScale || 0, priorityScore, priorityLevel,
      location: { lat, lon, address }, ambulanceType: type,
      distanceKm: topDist, ...billing,
      hospitalRankings: rankings.map(r => ({ hospital: r.hospital, distance: r.distance, compositeScore: r.compositeScore, bedsAvailable: r.bedsAvailable })),
      status: 'PENDING'
    });

    req.io.to('admin_room').emit('new_emergency', { emergency });

    res.status(201).json({
      success: true, message: 'Emergency submitted!',
      emergency: { id: emergency._id, priorityLevel, status: 'PENDING', topHospital: rankings[0]?.hospitalData?.name, distance: topDist, ...billing }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/emergency/my
router.get('/my', protect, authorize('patient'), async (req, res) => {
  try {
    const emergencies = await Emergency.find({ patient: req.user._id })
      .populate('assignedHospital', 'name address phone')
      .populate('assignedDriver', 'name phone vehicleNumber vehicleType currentLocation')
      .sort({ createdAt: -1 });
    res.json({ success: true, emergencies });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/emergency/cancel/:id — Patient cancels
router.put('/cancel/:id', protect, authorize('patient'), async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    if (['COMPLETED','CANCELLED'].includes(emergency.status)) return res.status(400).json({ success: false, message: `Cannot cancel — already ${emergency.status}` });
    emergency.status = 'CANCELLED';
    emergency.cancelledBy = 'patient';
    emergency.cancelReason = req.body.reason || 'Cancelled by patient';
    await emergency.save();
    req.io.to('admin_room').emit('status_update', { id: emergency._id, status: 'CANCELLED' });
    if (emergency.assignedDriver) req.io.to(`driver_${emergency.assignedDriver}`).emit('status_update', { id: emergency._id, status: 'CANCELLED' });
    res.json({ success: true, message: 'Emergency cancelled' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/emergency/feedback/:id
router.post('/feedback/:id', protect, authorize('patient'), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    if (emergency.status !== 'COMPLETED') return res.status(400).json({ success: false, message: 'Can only give feedback after completion' });
    emergency.feedback = { rating, comment, givenAt: new Date() };
    await emergency.save();
    // Update driver rating
    if (emergency.assignedDriver) {
      const User = require('../models/User');
      const driver = await User.findById(emergency.assignedDriver);
      if (driver) {
        driver.totalRides = (driver.totalRides || 0) + 1;
        driver.rating = ((driver.rating * (driver.totalRides - 1)) + rating) / driver.totalRides;
        await driver.save();
      }
    }
    res.json({ success: true, message: 'Feedback submitted!' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/emergency/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('patient', 'name phone')
      .populate('assignedHospital', 'name address phone location')
      .populate('assignedDriver', 'name phone vehicleNumber vehicleType currentLocation rating')
      .populate('hospitalRankings.hospital', 'name address location beds');
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, emergency });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;