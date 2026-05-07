const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth',      require('./routes/authRoutes'));
app.use('/api/emergency', require('./routes/emergencyRoutes'));
app.use('/api/hospital',  require('./routes/hospitalRoutes'));
app.use('/api/admin',     require('./routes/adminRoutes'));
app.use('/api/driver',    require('./routes/driverRoutes'));
app.use('/api/sms',       require('./routes/smsRoutes'));

// Serve frontend pages — ROUTES FIRST, then static
app.get('/',        (req, res) => res.sendFile(path.join(__dirname, '../frontend/home.html')));
app.get('/login',   (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/admin.html')));
app.get('/driver',  (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/driver.html')));
app.get('/patient', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/patient.html')));

// Static files — CSS, JS, images (AFTER routes)
app.use(express.static(path.join(__dirname, '../frontend')));

// Socket.io real-time events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(process.env.PORT, () => {
      console.log(`🚑 Rakshak Server running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });

module.exports = { io };