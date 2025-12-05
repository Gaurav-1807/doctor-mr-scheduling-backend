const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String
  },
  pincode: {
    type: String
  },
  phone: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Hospital', hospitalSchema);
