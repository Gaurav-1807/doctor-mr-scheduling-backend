const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Doctor', 'MR'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'voice'],
    default: 'text'
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'pdf', 'voice', 'file']
    },
    url: String,
    filename: String,
    size: Number
  }],
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  mr: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MR',
    required: true
  },
  messages: [messageSchema],
  lastMessage: {
    content: String,
    timestamp: Date,
    sender: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

chatSchema.index({ doctor: 1, mr: 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
