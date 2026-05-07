const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ❌ REMOVED: const fetch = require('node-fetch');
// ✅ Node v24 already has global fetch

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, vehicleNumber } = req.body;

    if (role === 'admin')
      return res.status(403).json({ success: false, message: 'Admin registration not allowed' });

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'patient',
      phone,
      address,
      vehicleNumber
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        phoneVerified: user.phoneVerified
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/send-otp
router.post('/send-otp', protect, async (req, res) => {
  try {
    const { phone } = req.body;

    console.log('📱 send-otp called for phone:', phone, 'user:', req.user._id);

    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Enter valid 10-digit mobile number'
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(req.user._id, { phone, otp, otpExpiry });

    console.log('✅ OTP generated:', otp, '| Expiry:', otpExpiry);

    const apiKey = process.env.FAST2SMS_API_KEY;
    let smsSent = false;

    if (apiKey && apiKey !== 'YOUR_FAST2SMS_API_KEY_HERE') {
      try {
        const msg = `Your Rakshak OTP is: ${otp}. Valid for 10 minutes.`;

        const smsRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'q',
            message: msg,
            language: 'english',
            flash: 0,
            numbers: `91${phone}` // ✅ FIXED
          })
        });

        const smsText = await smsRes.text();
        console.log('📨 Fast2SMS response:', smsText);

        const smsData = JSON.parse(smsText);
        smsSent = smsData.return === true;

      } catch (e) {
        console.error('SMS send error:', e.message);
      }
    }

    return res.json({
      success: true,
      message: smsSent
        ? `OTP sent to ${phone} via SMS`
        : `OTP generated successfully`,
      devOtp: otp // for testing
    });

  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', protect, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp)
      return res.status(400).json({ success: false, message: 'OTP required' });

    const user = await User.findById(req.user._id);

    if (!user.otp)
      return res.status(400).json({ success: false, message: 'No OTP found.' });

    if (user.otp.toString() !== otp.toString().trim())
      return res.status(400).json({ success: false, message: 'Incorrect OTP.' });

    if (new Date() > user.otpExpiry)
      return res.status(400).json({ success: false, message: 'OTP expired.' });

    await User.findByIdAndUpdate(req.user._id, {
      phoneVerified: true,
      otp: null,
      otpExpiry: null
    });

    res.json({ success: true, message: 'Phone verified successfully!' });

  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -otp -otpExpiry');

    res.json({ success: true, user });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;