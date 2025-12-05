const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  slotDuration: {
    type: Number,
    required: true,
    default: 15
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

availabilitySchema.index({ doctorId: 1, dayOfWeek: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);
