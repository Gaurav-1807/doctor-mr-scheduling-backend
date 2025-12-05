const mongoose = require('mongoose');

const mrSchema = new mongoose.Schema({
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
  company: {
    type: String,
    required: true
  },
  territory: {
    type: String
  },
  role: {
    type: String,
    default: 'mr'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String
  },
  role: {
    type: String,
    enum: ['mr', 'super_mr', 'admin'],
    default: 'mr'
  },
  permissions: [{
    type: String
  }],
  performanceScore: {
    type: Number,
    default: 0
  },
  stats: {
    totalVisits: { type: Number, default: 0 },
    completedVisits: { type: Number, default: 0 },
    missedVisits: { type: Number, default: 0 },
    coveragePercentage: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MR', mrSchema);
