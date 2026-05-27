const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Is line ko badlein (yeh batayega ki .env file ek folder bahar rakhi hai)
require('dotenv').config({ path: '../.env' });

const User     = require('./models/User');
const Hospital = require('./models/Hospital');

const seed = async () => {
  console.log('Connecting to:', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB...');

  // Only clear hospitals and re-seed
  // Keep existing users
  await Hospital.deleteMany({});

  // Hospitals in Indore (real coordinates)
  await Hospital.create([
    {
      name: 'MY Hospital Indore',
      address: 'MY Hospital Rd, Indore, MP',
      phone: '0731-2527391',
      location: { lat: 22.7196, lon: 75.8577 },
      beds: { general: 50, icu: 15, trauma: 10 },
      isActive: true
    },
    {
      name: 'Bombay Hospital Indore',
      address: 'South Tukoganj, Indore, MP',
      phone: '0731-4077000',
      location: { lat: 22.7155, lon: 75.8672 },
      beds: { general: 40, icu: 10, trauma: 8 },
      isActive: true
    },
    {
      name: 'CHL Hospital Indore',
      address: 'AB Road, Indore, MP',
      phone: '0731-4000000',
      location: { lat: 22.7232, lon: 75.8801 },
      beds: { general: 35, icu: 8, trauma: 6 },
      isActive: true
    },
    {
      name: 'Medanta Hospital Indore',
      address: 'Vijay Nagar, Indore, MP',
      phone: '0731-4747474',
      location: { lat: 22.7536, lon: 75.8946 },
      beds: { general: 60, icu: 20, trauma: 12 },
      isActive: true
    },
    {
      name: 'Choithram Hospital Indore',
      address: 'Manik Bagh Rd, Indore, MP',
      phone: '0731-4200600',
      location: { lat: 22.6895, lon: 75.8432 },
      beds: { general: 45, icu: 12, trauma: 8 },
      isActive: true
    },
    {
      name: 'Apollo Hospitals Indore',
      address: 'MR 10 Road, Indore, MP',
      phone: '0731-4977777',
      location: { lat: 22.7412, lon: 75.9104 },
      beds: { general: 55, icu: 18, trauma: 10 },
      isActive: true
    },
    {
      name: 'Vishesh Jupiter Hospital',
      address: 'Scheme No 94, Indore, MP',
      phone: '0731-4077600',
      location: { lat: 22.7089, lon: 75.8731 },
      beds: { general: 30, icu: 8, trauma: 5 },
      isActive: true
    },
    {
      name: 'Kokilaben Hospital Indore',
      address: 'Scheme No 78, Indore, MP',
      phone: '0731-4900000',
      location: { lat: 22.7334, lon: 75.8623 },
      beds: { general: 40, icu: 10, trauma: 7 },
      isActive: true
    },
    // Bhopal hospitals (for wider coverage)
    {
      name: 'AIIMS Bhopal',
      address: 'Saket Nagar, Bhopal, MP',
      phone: '0755-2672356',
      location: { lat: 23.2599, lon: 77.4126 },
      beds: { general: 100, icu: 30, trauma: 20 },
      isActive: true
    },
    {
      name: 'Hamidia Hospital Bhopal',
      address: 'Royal Market, Bhopal, MP',
      phone: '0755-2540222',
      location: { lat: 23.2588, lon: 77.4010 },
      beds: { general: 80, icu: 20, trauma: 15 },
      isActive: true
    },
  ]);

  console.log('✅ Hospitals seeded successfully!');
  console.log('');
  console.log('Hospitals added:');
  console.log('  Indore: MY Hospital, Bombay, CHL, Medanta, Choithram, Apollo, Vishesh, Kokilaben');
  console.log('  Bhopal: AIIMS, Hamidia');
  console.log('');

  // Create admin if not exists
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const col = mongoose.connection.collection('users');
    const hash = await bcrypt.hash('Admin@123', 10);
    await col.insertOne({
      name: 'Admin Rakshak',
      email: 'admin@rakshak.com',
      role: 'admin',
      phone: '9999000001',
      password: hash,
      isActive: true,
      phoneVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Admin created: admin@rakshak.com / Admin@123');
  } else {
    console.log('Admin already exists:', adminExists.email);
  }

  console.log('');
  console.log('Login Credentials:');
  console.log('  Admin   → admin@rakshak.com / Admin@123');
  console.log('  Driver  → driver1@rakshak.com / driver123');
  console.log('  Patient → patient@rakshak.com / patient123');

  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
