const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  patient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName:  { type: String, required: true },
  patientPhone: { type: String },
  patientAge:   { type: Number },
  patientGender:{ type: String, enum: ['Male','Female','Other'] },
  condition:    { type: String, required: true },
  conditionCategory: { type: String },
  description:  { type: String },
  severityScale:{ type: Number, min: 0, max: 5, default: 0 },
  priorityScore: { type: Number, default: 0 },
  priorityLevel: { type: String, enum: ['CRITICAL','SEVERE','MODERATE','LOW'], default: 'LOW' },
  location: { lat: { type: Number, required: true }, lon: { type: Number, required: true }, address: { type: String } },
  assignedHospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  assignedDriver:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  compositeScore:   { type: Number, default: 0 },
  // FIXED: Added 'IN_TRANSIT' to the enum array below
  status: { 
    type: String, 
    enum: ['PENDING','ASSIGNED','ACCEPTED','IN_TRANSIT','COMPLETED','CANCELLED'], 
    default: 'PENDING' 
  },
  cancelledBy: { type: String }, cancelReason: { type: String },
  ambulanceType: { type: String, enum: ['ALS','BLS','PTA'], default: 'BLS' },
  distanceKm: { type: Number, default: 0 },
  baseCharge: { type: Number, default: 0 },
  perKmCharge: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: false },
  feedback: { rating: { type: Number, min:1, max:5 }, comment: { type: String }, givenAt: { type: Date } },
  assignedAt: { type: Date }, acceptedAt: { type: Date }, completedAt: { type: Date },
  hospitalRankings: [{ hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }, distance: Number, compositeScore: Number, bedsAvailable: Boolean }]
}, { timestamps: true });

module.exports = mongoose.model('Emergency', emergencySchema);