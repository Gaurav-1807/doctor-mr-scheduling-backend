const Chat = require('../models/Chat');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');
const Notification = require('../models/Notification');

// @desc    Get all users for chat (WhatsApp-like user list)
// @route   GET /api/chat/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let users = [];
    
    if (userRole === 'doctor') {
      // Doctors see all MRs
      users = await MR.find({ isActive: true })
        .select('name company email phone profileImage')
        .sort({ name: 1 });
    } else if (userRole === 'mr') {
      // MRs see all Doctors
      users = await Doctor.find({ isActive: true })
        .select('name specialty email phone clinicAddress profileImage')
        .sort({ name: 1 });
    }
    
    // Get existing conversations to show last message
    const conversations = await Chat.find({
      $or: [{ doctor: userId }, { mr: userId }]
    }).select('doctor mr lastMessage updatedAt messages');
    
    // Map users with conversation info and unread count
    const usersWithChat = users.map(user => {
      const conv = conversations.find(c => 
        c.doctor?.toString() === user._id.toString() || 
        c.mr?.toString() === user._id.toString()
      );
      
      // Calculate unread count (messages from other user that are not read)
      let unreadCount = 0;
      if (conv && conv.messages) {
        unreadCount = conv.messages.filter(msg => {
          const senderId = msg.sender?.toString();
          const isFromOther = senderId !== userId;
          const isUnread = msg.read === false;
          return isFromOther && isUnread;
        }).length;
      }
      
      return {
        _id: user._id,
        name: user.name,
        subtitle: userRole === 'doctor' ? user.company : user.specialty,
        email: user.email,
        profileImage: user.profileImage,
        conversationId: conv?._id || null,
        lastMessage: conv?.lastMessage || null,
        lastMessageTime: conv?.updatedAt || null,
        unreadCount: unreadCount
      };
    });
    
    // Sort by last message time (users with recent messages first)
    usersWithChat.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });
    
    res.json({ success: true, data: usersWithChat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all conversations for user
// @route   GET /api/chat/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let query = {};
    if (userRole === 'doctor') {
      query.doctor = userId;
    } else {
      query.mr = userId;
    }
    
    const conversations = await Chat.find(query)
      .populate('doctor', 'name specialty profileImage')
      .populate('mr', 'name company profileImage')
      .sort({ updatedAt: -1 });
    
    // Add unread count for each conversation
    const conversationsWithUnread = conversations.map(conv => {
      const unreadCount = conv.messages.filter(
        msg => msg.sender.toString() !== userId && !msg.read
      ).length;
      
      return {
        ...conv.toObject(),
        unreadCount
      };
    });
    
    res.json({ success: true, data: conversationsWithUnread });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or get conversation with a user
// @route   POST /api/chat/conversations
// @access  Private
exports.createConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let doctorId, mrId;
    
    if (userRole === 'doctor') {
      doctorId = userId;
      mrId = recipientId;
    } else {
      doctorId = recipientId;
      mrId = userId;
    }
    
    // Check if conversation already exists
    let chat = await Chat.findOne({ doctor: doctorId, mr: mrId })
      .populate('doctor', 'name specialty profileImage')
      .populate('mr', 'name company profileImage');
    
    if (chat) {
      return res.json({ success: true, data: chat, existing: true });
    }
    
    // Create new conversation
    chat = await Chat.create({ 
      doctor: doctorId, 
      mr: mrId, 
      messages: [] 
    });
    
    await chat.populate('doctor', 'name specialty profileImage');
    await chat.populate('mr', 'name company profileImage');
    
    res.status(201).json({ success: true, data: chat, existing: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single conversation
// @route   GET /api/chat/conversations/:conversationId
// @access  Private
exports.getConversation = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.conversationId)
      .populate('doctor', 'name specialty profileImage')
      .populate('mr', 'name company profileImage');
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    res.json({ success: true, data: chat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversations/:conversationId/messages
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const chat = await Chat.findById(conversationId);
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Mark messages as read
    const userId = req.user.id;
    let hasUnread = false;
    chat.messages.forEach(msg => {
      if (msg.sender.toString() !== userId && !msg.read) {
        msg.read = true;
        msg.readAt = new Date();
        hasUnread = true;
      }
    });
    
    if (hasUnread) {
      await chat.save();
    }
    
    // Paginate messages (most recent first)
    const totalMessages = chat.messages.length;
    const startIndex = Math.max(0, totalMessages - (page * limit));
    const endIndex = totalMessages - ((page - 1) * limit);
    const messages = chat.messages.slice(startIndex, endIndex);
    
    res.json({ 
      success: true, 
      data: messages,
      hasMore: startIndex > 0,
      total: totalMessages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send message
// @route   POST /api/chat/conversations/:conversationId/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text' } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }
    
    const chat = await Chat.findById(conversationId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    const newMessage = {
      sender: req.user.id,
      senderModel: req.user.role === 'doctor' ? 'Doctor' : 'MR',
      content: content.trim(),
      messageType,
      timestamp: new Date(),
      read: false
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = {
      content: content.substring(0, 100),
      timestamp: new Date(),
      sender: req.user.id
    };
    
    await chat.save();
    
    // Get the saved message with _id
    const savedMessage = chat.messages[chat.messages.length - 1];
    
    // Create notification for recipient (using correct field names)
    try {
      const recipientId = req.user.role === 'doctor' ? chat.mr : chat.doctor;
      const recipientType = req.user.role === 'doctor' ? 'mr' : 'doctor';
      
      await Notification.create({
        userId: recipientId,
        userType: recipientType,
        title: 'New Message',
        message: `New message from ${req.user.name || 'User'}`,
        type: 'general',
        relatedId: chat._id
      });
    } catch (notifError) {
      // Don't fail the message send if notification fails
      console.error('Notification error:', notifError.message);
    }
    
    res.status(201).json({ success: true, data: savedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark message as read
// @route   PUT /api/chat/messages/:messageId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const chat = await Chat.findOne({ 'messages._id': messageId });
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    const message = chat.messages.id(messageId);
    if (message) {
      message.read = true;
      message.readAt = new Date();
      await chat.save();
    }
    
    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete message
// @route   DELETE /api/chat/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const chat = await Chat.findOne({ 'messages._id': messageId });
    
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    const message = chat.messages.id(messageId);
    
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }
    
    message.deleteOne();
    await chat.save();
    
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unread message count
// @route   GET /api/chat/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let query = {};
    if (userRole === 'doctor') {
      query.doctor = userId;
    } else {
      query.mr = userId;
    }
    
    const chats = await Chat.find(query);
    
    let unreadCount = 0;
    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        if (msg.sender.toString() !== userId && !msg.read) {
          unreadCount++;
        }
      });
    });
    
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
