const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  speciality: {
    type: String,
    required: true
  },
  qualification: {
    type: String
  },
  experience: {
    type: Number
  },
  role: {
    type: String,
    default: 'doctor'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String
  },
  bookingCycleDays: {
    type: Number,
    default: 1,
    min: 1,
    max: 90
  },
  role: {
    type: String,
    enum: ['doctor', 'admin'],
    default: 'doctor'
  },
  permissions: [{
    type: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Doctor', doctorSchema);
