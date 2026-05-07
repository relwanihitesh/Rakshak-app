const express = require('express');
const router = express.Router();
const Emergency = require('../models/Emergency');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// Haversine distance
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/admin/emergencies
router.get('/emergencies', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const emergencies = await Emergency.find(filter)
      .populate('patient', 'name phone')
      .populate('assignedHospital', 'name address')
      .populate('assignedDriver', 'name phone vehicleNumber')
      .populate('hospitalRankings.hospital', 'name address location beds')
      .sort({ priorityScore: -1, createdAt: 1 });
    res.json({ success: true, emergencies });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin/nearby-drivers/:emergencyId — FIXED
router.get('/nearby-drivers/:emergencyId', protect, authorize('admin'), async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.emergencyId);
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found' });

    const { lat, lon } = emergency.location;
    console.log(`🔍 Finding nearby drivers for patient at ${lat}, ${lon}`);

    const drivers = await User.find(
      { role: 'driver', isAvailable: true },
      'name phone vehicleNumber currentLocation avgRating isVerified'
    );

    console.log(`Found ${drivers.length} available drivers`);
    drivers.forEach(d => console.log(`  Driver: ${d.name} | Location:`, d.currentLocation));

    const driversWithDist = drivers.map(d => {
      let distance = null;
      const dLat = d.currentLocation?.lat;
      const dLon = d.currentLocation?.lon;
      if (dLat && dLon && lat && lon) {
        distance = parseFloat(haversine(lat, lon, dLat, dLon).toFixed(2));
      }
      return {
        _id: d._id,
        name: d.name,
        phone: d.phone,
        vehicleNumber: d.vehicleNumber,
        currentLocation: d.currentLocation,
        avgRating: d.avgRating || 5.0,
        isVerified: d.isVerified,
        distanceFromPatient: distance
      };
    }).sort((a, b) => {
      if (a.distanceFromPatient === null && b.distanceFromPatient === null) return 0;
      if (a.distanceFromPatient === null) return 1;
      if (b.distanceFromPatient === null) return -1;
      return a.distanceFromPatient - b.distanceFromPatient;
    });

    res.json({ success: true, drivers: driversWithDist });
  } catch(err) {
    console.error('nearby-drivers error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/assign/:id
router.put('/assign/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { hospitalId, driverId } = req.body;
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found' });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const condText = ((emergency.disease || '') + ' ' + (emergency.condition || '')).toLowerCase();
    const bedType = condText.includes('accident') || condText.includes('trauma') ? 'trauma'
      : condText.includes('heart') || condText.includes('cardiac') ? 'icu' : 'general';

    if (hospital.beds[bedType] <= 0) return res.status(400).json({ success: false, message: `No ${bedType} beds available` });
    hospital.beds[bedType] -= 1;
    await hospital.save();

    await User.findByIdAndUpdate(driverId, { isAvailable: false });

    emergency.assignedHospital = hospitalId;
    emergency.assignedDriver = driverId;
    emergency.status = 'ASSIGNED';
    emergency.assignedAt = new Date();
    await emergency.save();

    const populated = await Emergency.findById(emergency._id)
      .populate('patient', 'name phone')
      .populate('assignedHospital', 'name address phone location')
      .populate('assignedDriver', 'name phone vehicleNumber');

    req.io.to(`driver_${driverId}`).emit('new_assignment', populated);
    req.io.to(`patient_${emergency.patient}`).emit('status_update', { status: 'ASSIGNED', emergency: populated });

    res.json({ success: true, message: 'Assigned successfully', emergency: populated });
  } catch(err) {
    console.error('assign error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/stats
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const total     = await Emergency.countDocuments();
    const pending   = await Emergency.countDocuments({ status: 'PENDING' });
    const assigned  = await Emergency.countDocuments({ status: { $in: ['ASSIGNED','ACCEPTED','IN_TRANSIT'] } });
    const completed = await Emergency.countDocuments({ status: 'COMPLETED' });
    const cancelled = await Emergency.countDocuments({ status: 'CANCELLED' });
    const critical  = await Emergency.countDocuments({ priorityLevel: 'CRITICAL' });
    const drivers   = await User.countDocuments({ role: 'driver', isAvailable: true });
    const hospitals = await Hospital.find({}, 'name beds');
    const completedCases = await Emergency.find({ status: 'COMPLETED' }, 'fare');
    const totalRevenue = completedCases.reduce((sum, e) => sum + (e.fare?.totalAmount || 0), 0);
    res.json({ success: true, stats: { total, pending, assigned, completed, cancelled, critical, availableDrivers: drivers, hospitals, totalRevenue } });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin/drivers
router.get('/drivers', protect, authorize('admin'), async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' }, 'name phone vehicleNumber vehicleImage isAvailable currentLocation avgRating isVerified');
    res.json({ success: true, drivers });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/admin/verify-driver/:id
router.put('/verify-driver/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isVerified: true });
    res.json({ success: true, message: 'Driver verified!' });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;