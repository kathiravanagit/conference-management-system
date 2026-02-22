const QAChat = require('../models/QAChat');

/**
 * Socket.io event handlers for real-time features
 */
const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    /**
     * Join conference room
     */
    socket.on('joinConference', (data) => {
      const { conferenceId, userId, userName } = data;
      const room = `conference-${conferenceId}`;
      
      socket.join(room);
      socket.emit('roomJoined', {
        message: `Joined conference: ${conferenceId}`,
      });
      
      // Notify others
      io.to(room).emit('userJoined', {
        message: `${userName} joined the conference`,
        userId,
        userName,
      });
    });

    /**
     * Live Q&A message
     */
    socket.on('qaMessage', async (data) => {
      const { conferenceId, userId, userName, message, isQuestion } = data;
      const room = `conference-${conferenceId}`;

      try {
        // Save to database
        const qAChat = await QAChat.create({
          conferenceId,
          userId,
          userName,
          message,
          isQuestion,
        });

        // Broadcast to all in the room
        io.to(room).emit('newQAMessage', {
          id: qAChat._id,
          userName,
          message,
          isQuestion,
          timestamp: qAChat.createdAt,
          likes: 0,
        });
      } catch (error) {
        console.error('Error posting message:', error);
        socket.emit('error', { message: 'Failed to post message' });
      }
    });

    /**
     * Like a message
     */
    socket.on('likeMessage', (data) => {
      const { conferenceId, messageId } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('messageLiked', {
        messageId,
        action: 'liked',
      });
    });

    /**
     * Typing indicator
     */
    socket.on('typing', (data) => {
      const { conferenceId, userName, isTyping } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('userTyping', {
        userName,
        isTyping,
      });
    });

    /**
     * Live notifications
     */
    socket.on('subscribeNotifications', (data) => {
      const { userId } = data;
      socket.join(`user-${userId}`);
    });

    socket.on('notification', (data) => {
      const { userId, type, message } = data;
      
      io.to(`user-${userId}`).emit('notification', {
        type,
        message,
        timestamp: new Date(),
      });
    });

    /**
     * Leave conference
     */
    socket.on('leaveConference', (data) => {
      const { conferenceId, userName } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('userLeft', {
        message: `${userName} left the conference`,
      });

      socket.leave(room);
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

module.exports = setupSocketIO;
