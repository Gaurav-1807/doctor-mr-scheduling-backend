/**
 * Socket.io Chat Handler
 * Handles real-time messaging between doctors and MRs
 */

const chatHandler = (io, socket) => {
  console.log(`Chat handler initialized for user: ${socket.userId}`);

  // Join user's personal room for direct notifications
  socket.join(`user:${socket.userId}`);

  // Join conversation room
  socket.on('join-conversation', (conversationId) => {
    if (conversationId) {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    }
  });

  // Leave conversation room
  socket.on('leave-conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    }
  });

  // Send message - broadcast to conversation room
  socket.on('send-message', (data) => {
    try {
      const { conversationId, message, recipientId } = data;
      
      console.log(`Broadcasting message to conversation ${conversationId}`);
      
      // Broadcast to everyone in the conversation room EXCEPT the sender
      socket.to(`conversation:${conversationId}`).emit('new-message', {
        conversationId,
        message
      });

      // Also send notification to recipient's personal room
      if (recipientId) {
        io.to(`user:${recipientId}`).emit('message-notification', {
          conversationId,
          senderName: socket.userName || 'Someone',
          preview: message?.content?.substring(0, 50) || ''
        });
      }

    } catch (error) {
      console.error('Send message socket error:', error);
    }
  });

  // Typing indicator start
  socket.on('typing-start', (conversationId) => {
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        conversationId,
        userId: socket.userId,
        userName: socket.userName || 'Someone'
      });
    }
  });

  // Typing indicator stop
  socket.on('typing-stop', (conversationId) => {
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('user-stopped-typing', {
        conversationId,
        userId: socket.userId
      });
    }
  });

  // Mark messages as read
  socket.on('mark-read', (data) => {
    const { conversationId, messageIds } = data;
    if (conversationId && messageIds) {
      socket.to(`conversation:${conversationId}`).emit('messages-read', {
        conversationId,
        messageIds,
        readBy: socket.userId
      });
    }
  });
};

module.exports = chatHandler;
