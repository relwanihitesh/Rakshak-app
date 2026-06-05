// reset_admin.js
// Run: node reset_admin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const connectMongo = require('./backend/config/mongo');

async function resetAdmin() {
  try {
    await connectMongo();
    console.log('Connected to MongoDB...');

    const users = mongoose.connection.collection('users');

    // Generate fresh hash
    const newPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    // Delete all existing admins
    const deleted = await users.deleteMany({ role: 'admin' });
    console.log('Deleted old admins:', deleted.deletedCount);

    // Insert fresh admin directly (bypasses pre-save hook)
    await users.insertOne({
      name: 'Admin Rakshak',
      email: 'admin@rakshak.com',
      role: 'admin',
      phone: '9999000001',
      password: hash,
      isActive: true,
      phoneVerified: true,
      isVerified: true,
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('');
    console.log('SUCCESS!');
    console.log('Email   : admin@rakshak.com');
    console.log('Password: Admin@123');
    console.log('');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

resetAdmin();
