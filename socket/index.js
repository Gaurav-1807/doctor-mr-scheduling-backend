const jwt = require('jsonwebtoken');
const chatHandler = require('./chatHandler');
const { notificationHandler } = require('./notificationHandler');
const { onlineStatusHandler } = require('./onlineStatusHandler');

/**
 * Socket.io Main Configuration
 * Initializes all socket handlers with authentication
 */

const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userName = decoded.name;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.userRole})`);

    // Initialize handlers
    onlineStatusHandler(io, socket);
    notificationHandler(io, socket);
    chatHandler(io, socket);

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

module.exports = initializeSocket;
