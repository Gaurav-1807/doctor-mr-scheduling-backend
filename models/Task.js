const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  mrId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MR',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  taskType: {
    type: String,
    enum: ['visit', 'sample_delivery', 'stock_check', 'report_submission', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  dueDate: Date,
  completedAt: Date,
  relatedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  relatedAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  notes: String,
  attachments: [{
    url: String,
    filename: String
  }]
}, {
  timestamps: true
});

taskSchema.index({ mrId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
