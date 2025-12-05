/**
 * Socket.io Online Status Handler
 * Tracks user online/offline status
 */

// Store online users in memory
const onlineUsers = new Map();

const onlineStatusHandler = (io, socket) => {
  const userId = socket.userId;
  const userRole = socket.userRole;
  
  // Mark user as online
  onlineUsers.set(userId, {
    odId: socket.id,
    role: userRole,
    lastSeen: new Date()
  });

  // Join personal room for direct messages
  socket.join(`user:${userId}`);

  // Broadcast online status to all users
  socket.broadcast.emit('user-online', {
    userId,
    role: userRole
  });

  console.log(`User ${userId} is now online. Total online: ${onlineUsers.size}`);

  // Get online status of specific users
  socket.on('get-online-status', (userIds) => {
    if (Array.isArray(userIds)) {
      const statuses = userIds.map(id => ({
        userId: id,
        online: onlineUsers.has(id),
        lastSeen: onlineUsers.get(id)?.lastSeen
      }));
      socket.emit('online-statuses', statuses);
    }
  });

  // Update last seen on activity
  socket.on('activity', () => {
    if (onlineUsers.has(userId)) {
      onlineUsers.get(userId).lastSeen = new Date();
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    
    // Broadcast offline status
    socket.broadcast.emit('user-offline', {
      userId,
      lastSeen: new Date()
    });
    
    console.log(`User ${userId} disconnected. Total online: ${onlineUsers.size}`);
  });
};

// Helper functions
const isUserOnline = (userId) => onlineUsers.has(userId);

const getOnlineUsers = () => Array.from(onlineUsers.keys());

const getOnlineUsersByRole = (role) => {
  const users = [];
  onlineUsers.forEach((data, odId) => {
    if (data.role === role) users.push(userId);
  });
  return users;
};

module.exports = {
  onlineStatusHandler,
  isUserOnline,
  getOnlineUsers,
  getOnlineUsersByRole
};
