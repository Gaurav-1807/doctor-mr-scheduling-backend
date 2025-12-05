const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userType: {
    type: String,
    enum: ['doctor', 'mr'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['appointment', 'reminder', 'followup', 'cancellation', 'general'],
    default: 'general'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
