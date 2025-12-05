const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Users list (WhatsApp-like)
router.get('/users', chatController.getUsers);

// Conversation routes
router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.createConversation);
router.get('/conversations/:conversationId', chatController.getConversation);

// Message routes
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.put('/messages/:messageId/read', chatController.markAsRead);
router.delete('/messages/:messageId', chatController.deleteMessage);

// Unread count
router.get('/unread-count', chatController.getUnreadCount);

module.exports = router;
