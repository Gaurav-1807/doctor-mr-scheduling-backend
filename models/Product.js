const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: String,
  manufacturer: String,
  images: [String],
  brochures: [{
    url: String,
    filename: String
  }],
  videos: [{
    url: String,
    title: String,
    duration: Number
  }],
  specifications: {
    type: Map,
    of: String
  },
  price: {
    mrp: Number,
    dealerPrice: Number,
    currency: {
      type: String,
      default: 'INR'
    }
  },
  stockInfo: {
    available: Boolean,
    quantity: Number,
    unit: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String]
}, {
  timestamps: true
});

productSchema.index({ name: 'text', category: 'text', tags: 'text' });
productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
