const mongoose = require('mongoose');

const doctorServiceSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  specialties: [{
    name: String,
    description: String,
    experience: Number
  }],
  services: [{
    name: String,
    description: String,
    duration: Number,
    fee: Number
  }],
  treatments: [{
    name: String,
    description: String,
    category: String
  }],
  documents: [{
    type: {
      type: String,
      enum: ['license', 'certificate', 'id_proof', 'degree', 'other']
    },
    url: String,
    filename: String,
    verified: {
      type: Boolean,
      default: false
    },
    uploadedAt: Date
  }],
  awards: [{
    title: String,
    year: Number,
    description: String
  }],
  languages: [String],
  consultationFee: {
    inPerson: Number,
    online: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DoctorService', doctorServiceSchema);
