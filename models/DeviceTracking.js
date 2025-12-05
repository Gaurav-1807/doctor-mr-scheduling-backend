const mongoose = require('mongoose');

const deviceTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userType: {
    type: String,
    enum: ['doctor', 'mr', 'admin'],
    required: true
  },
  deviceInfo: {
    deviceId: String,
    deviceType: String,
    browser: String,
    os: String,
    appVersion: String
  },
  ipAddress: String,
  location: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  loginAt: {
    type: Date,
    default: Date.now
  },
  logoutAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  sessionToken: String
}, {
  timestamps: true
});

deviceTrackingSchema.index({ userId: 1, isActive: 1 });
deviceTrackingSchema.index({ loginAt: -1 });

module.exports = mongoose.model('DeviceTracking', deviceTrackingSchema);
