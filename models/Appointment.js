const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['urgent', 'medium', 'normal'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled', 'missed', 'rescheduled'],
    default: 'confirmed'
  },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  rescheduledTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  visitReason: {
    type: String
  },
  cancellationReason: {
    type: String
  },
  notes: {
    type: String
  },
  followUpDate: {
    type: Date
  }
}, {
  timestamps: true
});

appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ mrId: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
