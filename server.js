const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.io setup with production-ready CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
        return callback(null, true);
      }
      console.log('Socket CORS blocked origin:', origin);
      return callback(null, true); // Allow all in production for now
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize socket handlers
const initializeSocket = require('./socket');
initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      return callback(null, true);
    }
    // Allow all origins in production for now (you can restrict this later)
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
// Use backend/uploads in production, root/uploads in development
const uploadsPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'uploads')
  : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/mrs', require('./routes/mrRoutes'));
app.use('/api/hospitals', require('./routes/hospitalRoutes'));
app.use('/api/availability', require('./routes/availabilityRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Advanced Feature Routes
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/visits', require('./routes/visitTrackingRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Cron Jobs
const { sendFollowUpReminders, sendDailySchedule } = require('./utils/cronJobs');
const { scheduleCycleSlotOpener } = require('./utils/cycleManager');
const { processReminders } = require('./utils/reminderEngine');
const { runEscalationChecks } = require('./utils/escalationAlerts');

// Run every day at 8 AM - Send daily schedule to doctors
cron.schedule('0 8 * * *', sendDailySchedule);

// Run every day at 9 AM - Send follow-up reminders
cron.schedule('0 9 * * *', sendFollowUpReminders);

// Run every day at 12 PM - Open next cycle slots
scheduleCycleSlotOpener();

// Run every hour - Process smart reminders
cron.schedule('0 * * * *', processReminders);

// Run every 30 minutes - Check for no-shows and escalations
cron.schedule('*/30 * * * *', runEscalationChecks);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});
