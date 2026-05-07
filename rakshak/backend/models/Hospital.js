const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  address: { type: String, required: true },
  phone:   { type: String },
  location: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  beds: {
    general: { type: Number, default: 20 },
    icu:     { type: Number, default: 5 },
    trauma:  { type: Number, default: 3 }
  },
  isActive: { type: Boolean, default: true },
  rating:   { type: Number, default: 4.0 }
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
