const Notification = require('../models/Notification');

/**
 * Socket.io Notification Handler
 * Handles real-time notifications
 */

const notificationHandler = (io, socket) => {
  // Subscribe to notifications
  socket.on('subscribe-notifications', () => {
    socket.join(`notifications:${socket.userId}`);
    console.log(`User ${socket.userId} subscribed to notifications`);
  });

  // Mark notification as read
  socket.on('notification-read', async (notificationId) => {
    try {
      await Notification.findByIdAndUpdate(notificationId, {
        read: true,
        readAt: new Date()
      });
      
      socket.emit('notification-updated', { id: notificationId, read: true });
    } catch (error) {
      console.error('Notification read error:', error);
    }
  });

  // Mark all notifications as read
  socket.on('notifications-read-all', async () => {
    try {
      await Notification.updateMany(
        { recipient: socket.userId, read: false },
        { read: true, readAt: new Date() }
      );
      
      socket.emit('all-notifications-read');
    } catch (error) {
      console.error('Mark all read error:', error);
    }
  });
};

// Helper function to send notification via socket
const sendNotification = (io, userId, notification) => {
  io.to(`notifications:${userId}`).emit('new-notification', notification);
  io.to(`user:${userId}`).emit('notification-badge-update');
};

// Send notification to multiple users
const broadcastNotification = (io, userIds, notification) => {
  userIds.forEach(userId => {
    sendNotification(io, userId, notification);
  });
};

module.exports = {
  notificationHandler,
  sendNotification,
  broadcastNotification
};
