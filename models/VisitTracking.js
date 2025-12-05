const mongoose = require('mongoose');

const visitTrackingSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  mrId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MR',
    required: true
  },
  visitType: {
    type: String,
    enum: ['sample_drop', 'promotion', 'stock_check', 'inquiry_followup', 'general'],
    required: true
  },
  visitStatus: {
    type: String,
    enum: ['successful', 'missed', 'rescheduled'],
    required: true
  },
  talkingSummary: {
    type: String
  },
  productsDiscussed: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    quantity: Number,
    feedback: String
  }],
  samplesDistributed: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    quantity: Number
  }],
  nextFollowUpDate: Date,
  nextFollowUpReason: String,
  doctorFeedback: String,
  doctorSignature: String,
  geoLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  checkInTime: Date,
  checkOutTime: Date,
  duration: Number,
  voiceNotes: [{
    url: String,
    duration: Number,
    uploadedAt: Date
  }],
  photos: [{
    url: String,
    caption: String
  }]
}, {
  timestamps: true
});

visitTrackingSchema.index({ doctorId: 1, mrId: 1, createdAt: -1 });
visitTrackingSchema.index({ visitStatus: 1 });

module.exports = mongoose.model('VisitTracking', visitTrackingSchema);
