const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.patch('/:id/read', auth, markAsRead);
router.patch('/read-all', auth, markAllAsRead);
router.delete('/:id', auth, deleteNotification);

module.exports = router;
