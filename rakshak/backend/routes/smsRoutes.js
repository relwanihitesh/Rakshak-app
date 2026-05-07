const express = require('express');
const router = express.Router();

// POST /api/sms/send-link
router.post('/send-link', async (req, res) => {
  try {
    const { phone, name, emergencyType } = req.body;

    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit phone number' });
    }

    const apiKey = process.env.FAST2SMS_API_KEY;
    console.log('Fast2SMS API Key present:', !!apiKey);

    const formLink = `${process.env.APP_URL || 'http://localhost:5000'}/login`;
    const message = `Hello ${name || 'User'}! Rakshak Emergency: Book your ambulance now: ${formLink} - Team Rakshak`;

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: phone
      })
    });

    const text = await response.text();
    console.log('Fast2SMS raw response:', text);
    
    let data;
    try { data = JSON.parse(text); } 
    catch(e) { data = { return: false, message: text }; }

    if (data.return === true) {
      res.json({ success: true, message: `SMS sent to ${phone}!` });
    } else {
      res.status(500).json({ 
        success: false, 
        message: `SMS failed: ${data.message || JSON.stringify(data)}` 
      });
    }
  } catch (err) {
    console.error('SMS Error:', err.message);
    res.status(500).json({ success: false, message: 'Error: ' + err.message });
  }
});

module.exports = router;
