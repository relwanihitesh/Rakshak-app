const express = require('express');
const router = express.Router();
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { protect, authorize } = require('../middleware/auth');

// GET /api/driver/assignments
router.get('/assignments', protect, authorize('driver'), async (req, res) => {
  try {
    const emergencies = await Emergency.find({ assignedDriver: req.user._id })
      .populate('patient', 'name phone address')
      .populate('assignedHospital', 'name address phone location')
      .sort({ createdAt: -1 });
    res.json({ success: true, emergencies });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/driver/accept/:id
router.put('/accept/:id', protect, authorize('driver'), async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    emergency.status = 'ACCEPTED';
    emergency.acceptedAt = new Date();
    await emergency.save();
    req.io.to(`patient_${emergency.patient}`).emit('status_update', { status: 'ACCEPTED' });
    req.io.to('admin_room').emit('status_update', { id: emergency._id, status: 'ACCEPTED' });
    res.json({ success: true, message: 'Case accepted' });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/driver/in-transit/:id
router.put('/in-transit/:id', protect, authorize('driver'), async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    emergency.status = 'IN_TRANSIT';
    await emergency.save();
    req.io.to(`patient_${emergency.patient}`).emit('status_update', { status: 'IN_TRANSIT' });
    req.io.to('admin_room').emit('status_update', { id: emergency._id, status: 'IN_TRANSIT' });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/driver/complete/:id
router.put('/complete/:id', protect, authorize('driver'), async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Not found' });
    emergency.status = 'COMPLETED';
    emergency.completedAt = new Date();
    await emergency.save();
    await User.findByIdAndUpdate(req.user._id, { isAvailable: true });
    if (emergency.assignedHospital) {
      const hospital = await Hospital.findById(emergency.assignedHospital);
      if (hospital) {
        const bedType = (emergency.disease || '').toLowerCase().includes('accident') ? 'trauma'
          : (emergency.disease || '').toLowerCase().includes('heart') ? 'icu' : 'general';
        hospital.beds[bedType] = Math.min((hospital.beds[bedType] || 0) + 1, 99);
        await hospital.save();
      }
    }
    req.io.to(`patient_${emergency.patient}`).emit('status_update', { status: 'COMPLETED', requestFeedback: true, fare: emergency.fare });
    req.io.to('admin_room').emit('status_update', { id: emergency._id, status: 'COMPLETED' });
    res.json({ success: true, message: 'Case completed', fare: emergency.fare });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/driver/location — FIXED: properly saves currentLocation
router.put('/location', protect, authorize('driver'), async (req, res) => {
  try {
    const { lat, lon, emergencyId } = req.body;
    console.log(`📍 Driver ${req.user.name} location update: ${lat}, ${lon}`);

    // Save to User model using $set to ensure subdocument saves correctly
    await User.findByIdAndUpdate(
      req.user._id,
      { $set: { 'currentLocation.lat': parseFloat(lat), 'currentLocation.lon': parseFloat(lon) } },
      { new: true }
    );

    // If active emergency, update driverLocation on it too
    if (emergencyId) {
      await Emergency.findByIdAndUpdate(emergencyId, {
        $set: { 'driverLocation.lat': parseFloat(lat), 'driverLocation.lon': parseFloat(lon), 'driverLocation.updatedAt': new Date() }
      });
      const emergency = await Emergency.findById(emergencyId, 'patient');
      if (emergency) {
        req.io.to(`patient_${emergency.patient}`).emit('driver_location_update', { lat: parseFloat(lat), lon: parseFloat(lon) });
      }
    }

    req.io.to('admin_room').emit('driver_location', { driverId: req.user._id, driverName: req.user.name, lat: parseFloat(lat), lon: parseFloat(lon) });
    res.json({ success: true });
  } catch(err) {
    console.error('Location update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;