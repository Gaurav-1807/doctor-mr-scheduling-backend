const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['vacation', 'sick_leave', 'emergency', 'conference', 'other'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: String,
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    },
    daysOfWeek: [Number],
    endRecurrence: Date
  },
  affectedAppointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

leaveSchema.index({ doctorId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
