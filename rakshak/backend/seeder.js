const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User     = require('./models/User');
const Hospital = require('./models/Hospital');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB...');

  await User.deleteMany({});
  await Hospital.deleteMany({});

  // Create admin
  await User.create({
    name: 'Admin Rakshak', email: 'admin@rakshak.com',
    password: 'admin123', role: 'admin', phone: '9999000001'
  });

  // Create drivers
  await User.create([
    { name: 'Ravi Kumar',  email: 'driver1@rakshak.com', password: 'driver123', role: 'driver', phone: '9999000002', vehicleNumber: 'MP09AB1234', isAvailable: true },
    { name: 'Suresh Patel',email: 'driver2@rakshak.com', password: 'driver123', role: 'driver', phone: '9999000003', vehicleNumber: 'MP09CD5678', isAvailable: true },
    { name: 'Anil Sharma', email: 'driver3@rakshak.com', password: 'driver123', role: 'driver', phone: '9999000004', vehicleNumber: 'MP09EF9012', isAvailable: true },
  ]);

  // Create patient
  await User.create({
    name: 'Hitesh Relwani', email: 'patient@rakshak.com',
    password: 'patient123', role: 'patient', phone: '9999000005',
    address: '204 Barathi Colony, Indore'
  });

  // Create hospitals in Indore
  await Hospital.create([
    { name: 'MY Hospital Indore',   address: 'MY Hospital Rd, Indore', phone: '0731-2527391', location: { lat: 22.7196, lon: 75.8577 }, beds: { general: 30, icu: 8, trauma: 5 } },
    { name: 'Bombay Hospital',      address: 'South Tukoganj, Indore',  phone: '0731-4077000', location: { lat: 22.7155, lon: 75.8672 }, beds: { general: 25, icu: 6, trauma: 4 } },
    { name: 'CHL Hospital',         address: 'AB Road, Indore',         phone: '0731-4000000', location: { lat: 22.7232, lon: 75.8801 }, beds: { general: 20, icu: 5, trauma: 3 } },
    { name: 'Medanta Hospital',     address: 'Vijay Nagar, Indore',     phone: '0731-4747474', location: { lat: 22.7536, lon: 75.8946 }, beds: { general: 40, icu: 10, trauma: 6 } },
    { name: 'Choithram Hospital',   address: 'Manik Bagh Rd, Indore',   phone: '0731-4200600', location: { lat: 22.6895, lon: 75.8432 }, beds: { general: 35, icu: 7, trauma: 4 } },
  ]);

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Login Credentials:');
  console.log('  Admin   → admin@rakshak.com   / admin123');
  console.log('  Driver  → driver1@rakshak.com / driver123');
  console.log('  Patient → patient@rakshak.com / patient123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
