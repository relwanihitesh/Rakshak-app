const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['patient','admin','driver'], default: 'patient' },
  phone:    { type: String },
  address:  { type: String },
  isActive: { type: Boolean, default: true },
  // Phone verification
  isPhoneVerified: { type: Boolean, default: false },
  otp:         { type: String },
  otpExpiry:   { type: Date },
  // Driver specific
  vehicleNumber: { type: String },
  vehicleImage:  { type: String },
  vehicleType:   { type: String, enum: ['ALS','BLS','PTA'], default: 'BLS' },
  isAvailable:   { type: Boolean, default: true },
  isVerified:    { type: Boolean, default: false },
  currentLocation: { lat: { type: Number }, lon: { type: Number } },
  rating: { type: Number, default: 5.0 },
  totalRides: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);