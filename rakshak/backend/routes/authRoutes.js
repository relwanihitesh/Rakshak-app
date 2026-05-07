const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPviaSMS(phone, otp) {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_FAST2SMS_API_KEY_HERE') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
      return { sent: false, devMode: true };
    }
    const msg = `Your Rakshak OTP is: ${otp}. Valid 10 mins. Do not share.`;
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { 'authorization': apiKey, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ route: 'q', message: msg, language: 'english', flash: 0, numbers: phone })
    });
    const text = await res.text();
    console.log('Fast2SMS:', text);
    let data; try { data = JSON.parse(text); } catch(e) { data = { return: false }; }
    return { sent: data.return === true, devMode: false };
  } catch(e) {
    console.error('SMS error:', e.message);
    return { sent: false, devMode: false };
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, vehicleNumber } = req.body;
    if (role === 'admin') return res.status(403).json({ success: false, message: 'Admin registration not allowed' });
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password required' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });
    const user = await User.create({ name, email: email.toLowerCase(), password, role: role || 'patient', phone, address, vehicleNumber });
    res.status(201).json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    res.json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, phoneVerified: user.phoneVerified } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/auth/send-otp
router.post('/send-otp', protect, async (req, res) => {
  try {
    const { phone } = req.body;
    console.log('📱 send-otp called | phone:', phone, '| user:', req.user._id);

    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter valid 10-digit mobile number' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await User.findByIdAndUpdate(req.user._id, { phone, otp, otpExpiry });
    console.log('✅ OTP generated:', otp);

    const result = await sendOTPviaSMS(phone, otp);

    // ALWAYS return devOtp so it shows on screen
    return res.json({
      success: true,
      message: result.sent ? `OTP sent to ${phone} via SMS` : `OTP generated successfully`,
      devOtp: otp  // Always return so patient can see it
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
    console.log('🔐 verify-otp | otp entered:', otp, '| user:', req.user._id);

    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });

    const user = await User.findById(req.user._id);
    console.log('OTP in DB:', user.otp, '| Entered:', otp.toString().trim());

    if (!user.otp) return res.status(400).json({ success: false, message: 'No OTP found. Click Send OTP first.' });
    if (user.otp.toString() !== otp.toString().trim()) return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });

    await User.findByIdAndUpdate(req.user._id, { phoneVerified: true, otp: null, otpExpiry: null });
    console.log('✅ Phone verified for user:', req.user._id);
    res.json({ success: true, message: 'Phone verified successfully!' });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -otp -otpExpiry');
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
