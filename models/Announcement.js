const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['urgent', 'important', 'normal'],
    default: 'normal'
  },
  attachments: [{
    type: String,
    url: String,
    filename: String
  }],
  targetMRs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MR'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date,
  readBy: [{
    mrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MR'
    },
    readAt: Date
  }]
}, {
  timestamps: true
});

announcementSchema.index({ doctorId: 1, isActive: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
