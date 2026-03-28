const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const QAChat = require('../models/QAChat');
const Conference = require('../models/Conference');
const MeetingChat = require('../models/MeetingChat');

const MAX_CHAT_MESSAGE_LENGTH = 500;
const ALLOWED_REACTIONS = new Set(['👏', '👍', '🎉', '❤️', '🔥', '🙌']);

const videoRoomState = new Map();

const getOrCreateVideoRoomState = (roomId) => {
  if (!videoRoomState.has(roomId)) {
    videoRoomState.set(roomId, {
      handStates: {},
      recentChat: [],
      recentReactions: [],
      userMap: {},
      hostId: null,
    });
  }
  return videoRoomState.get(roomId);
};

const cleanupVideoRoomState = (io, roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room || room.size === 0) {
    videoRoomState.delete(roomId);
  }
};

const sanitizeChatText = (value = '') =>
  String(value)
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDisplayName = (value = '') => {
  const cleaned = String(value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Participant';
  return cleaned.slice(0, 80);
};

const verifySocketToken = (token) => {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const extractJoinPayload = (rawRoomId, rawUserId, rawToken) => {
  if (typeof rawRoomId === 'object' && rawRoomId !== null) {
    return {
      roomId: rawRoomId.roomId,
      userId: rawRoomId.userId,
      userName: rawRoomId.userName,
      token: rawRoomId.token,
    };
  }

  return {
    roomId: rawRoomId,
    userId: rawUserId,
    userName: 'Participant',
    token: rawToken,
  };
};

const getAuthorizedVideoRoomState = (socket) => {
  const roomId = socket.data.videoRoomId;
  if (!roomId) return null;

  const roomState = videoRoomState.get(roomId);
  if (!roomState?.userMap?.[socket.id]) return null;

  return { roomId, roomState };
};

const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinConference', (data) => {
      const { conferenceId, userId, userName } = data;
      const room = `conference-${conferenceId}`;

      socket.join(room);
      socket.emit('roomJoined', {
        message: `Joined conference: ${conferenceId}`,
      });

      io.to(room).emit('userJoined', {
        message: `${userName} joined the conference`,
        userId,
        userName,
      });
    });

    socket.on('qaMessage', async (data) => {
      const { conferenceId, userId, userName, message, isQuestion } = data;
      const room = `conference-${conferenceId}`;

      try {
        const qAChat = await QAChat.create({
          conferenceId,
          userId,
          userName,
          message,
          isQuestion,
        });

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

    socket.on('likeMessage', (data) => {
      const { conferenceId, messageId } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('messageLiked', {
        messageId,
        action: 'liked',
      });
    });

    socket.on('typing', (data) => {
      const { conferenceId, userName, isTyping } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('userTyping', {
        userName,
        isTyping,
      });
    });

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

    socket.on('leaveConference', (data) => {
      const { conferenceId, userName } = data;
      const room = `conference-${conferenceId}`;

      io.to(room).emit('userLeft', {
        message: `${userName} left the conference`,
      });

      socket.leave(room);
    });

    // ==========================================
    // WebRTC Video Conferencing Signaling
    // ==========================================

    socket.on('join-video-room', async (rawRoomId, rawUserId, rawToken) => {
      const payload = extractJoinPayload(rawRoomId, rawUserId, rawToken);
      const roomId = payload.roomId;

      if (!roomId) {
        socket.emit('video-room-auth-error', { message: 'Missing meeting room id.' });
        return;
      }

      const decoded = verifySocketToken(payload.token);
      if (!decoded?.id) {
        socket.emit('video-room-auth-error', { message: 'Session expired. Please login again.' });
        return;
      }

      if (payload.userId && payload.userId !== decoded.id) {
        socket.emit('video-room-auth-error', { message: 'Invalid meeting identity payload.' });
        return;
      }

      socket.join(roomId);
      socket.data.videoRoomId = roomId;

      const roomState = getOrCreateVideoRoomState(roomId);
      roomState.userMap[socket.id] = {
        userId: decoded.id,
        userName: normalizeDisplayName(payload.userName),
        role: decoded.role,
      };

      if (!roomState.hostId && mongoose.Types.ObjectId.isValid(roomId)) {
        const conf = await Conference.findById(roomId).select('createdBy').lean();
        roomState.hostId = conf?.createdBy?.toString() || null;
      }

      if (roomState.recentChat.length === 0 && mongoose.Types.ObjectId.isValid(roomId)) {
        const history = await MeetingChat.find({ conferenceId: roomId })
          .sort({ createdAt: -1 })
          .limit(40)
          .lean();

        roomState.recentChat = history
          .reverse()
          .map((entry) => ({
            id: entry._id.toString(),
            socketId: null,
            author: entry.userName,
            text: entry.message,
            time: entry.createdAt,
          }));
      }

      socket.emit('video-room-state', {
        handStates: roomState.handStates,
        recentChat: roomState.recentChat,
        recentReactions: roomState.recentReactions,
      });

      socket.to(roomId).emit('user-connected', { userId: decoded.id, socketId: socket.id });
    });

    socket.on('video-offer', (data) => {
      const authContext = getAuthorizedVideoRoomState(socket);
      if (!authContext) {
        socket.emit('video-room-auth-error', { message: 'Not authorized for signaling.' });
        return;
      }

      const { roomState } = authContext;
      if (!data?.target || !roomState.userMap[data.target] || !data?.sdp) {
        return;
      }

      socket.to(data.target).emit('video-offer', {
        caller: socket.id,
        sdp: data.sdp,
        userInfo: data.userInfo,
      });
    });

    socket.on('video-answer', (data) => {
      const authContext = getAuthorizedVideoRoomState(socket);
      if (!authContext) {
        socket.emit('video-room-auth-error', { message: 'Not authorized for signaling.' });
        return;
      }

      const { roomState } = authContext;
      if (!data?.target || !roomState.userMap[data.target] || !data?.sdp) {
        return;
      }

      socket.to(data.target).emit('video-answer', {
        caller: socket.id,
        sdp: data.sdp,
        userInfo: data.userInfo,
      });
    });

    socket.on('new-ice-candidate', (data) => {
      const authContext = getAuthorizedVideoRoomState(socket);
      if (!authContext) {
        socket.emit('video-room-auth-error', { message: 'Not authorized for signaling.' });
        return;
      }

      const { roomState } = authContext;
      if (!data?.target || !roomState.userMap[data.target] || !data?.candidate) {
        return;
      }

      socket.to(data.target).emit('new-ice-candidate', {
        candidate: data.candidate,
        caller: socket.id,
      });
    });

    socket.on('user-media-status', (data) => {
      const authContext = getAuthorizedVideoRoomState(socket);
      if (!authContext) {
        socket.emit('video-room-auth-error', { message: 'Not authorized for this meeting room.' });
        return;
      }

      const { roomId } = authContext;
      if (data?.roomId !== roomId) {
        return;
      }

      if (data?.type !== 'audio' && data?.type !== 'video') {
        return;
      }

      socket.to(roomId).emit('user-media-status', {
        socketId: socket.id,
        type: data.type,
        isMuted: data.isMuted,
        isVideoOff: data.isVideoOff,
      });
    });

    socket.on('video-chat-message', (data) => {
      const { roomId, text } = data || {};
      if (!roomId || !text) return;

      const normalizedText = sanitizeChatText(text);
      if (!normalizedText || normalizedText.length > MAX_CHAT_MESSAGE_LENGTH) {
        socket.emit('video-chat-error', {
          message: `Message must be 1-${MAX_CHAT_MESSAGE_LENGTH} characters.`,
        });
        return;
      }

      const roomState = getOrCreateVideoRoomState(roomId);
      const sender = roomState.userMap[socket.id];
      if (!sender?.userId) {
        socket.emit('video-chat-error', { message: 'Not authorized for this meeting room.' });
        return;
      }

      const payload = {
        id: new mongoose.Types.ObjectId().toString(),
        socketId: socket.id,
        author: sender.userName || 'Participant',
        text: normalizedText,
        time: new Date(),
      };

      roomState.recentChat.push(payload);
      if (roomState.recentChat.length > 80) {
        roomState.recentChat.shift();
      }

      if (mongoose.Types.ObjectId.isValid(roomId) && mongoose.Types.ObjectId.isValid(sender.userId)) {
        MeetingChat.create({
          conferenceId: roomId,
          userId: sender.userId,
          userName: payload.author,
          message: normalizedText,
        }).catch((error) => {
          console.error('Failed to persist meeting chat:', error.message);
        });
      }

      io.to(roomId).emit('video-chat-message', payload);
    });

    socket.on('video-reaction', (data) => {
      const { roomId, emoji } = data || {};
      if (!roomId || !emoji) return;
      if (!ALLOWED_REACTIONS.has(emoji)) {
        socket.emit('video-chat-error', { message: 'Unsupported reaction.' });
        return;
      }

      const roomState = getOrCreateVideoRoomState(roomId);
      const sender = roomState.userMap[socket.id];
      if (!sender?.userId) {
        socket.emit('video-chat-error', { message: 'Not authorized for this meeting room.' });
        return;
      }

      const payload = {
        socketId: socket.id,
        emoji,
        author: sender.userName || 'Participant',
        time: new Date(),
      };

      roomState.recentReactions.push(payload);
      if (roomState.recentReactions.length > 20) {
        roomState.recentReactions.shift();
      }

      io.to(roomId).emit('video-reaction', payload);
    });

    socket.on('user-hand-status', (data) => {
      const { roomId, isHandRaised } = data || {};
      if (!roomId) return;

      const roomState = getOrCreateVideoRoomState(roomId);
      if (!roomState.userMap[socket.id]) {
        socket.emit('video-chat-error', { message: 'Not authorized for this meeting room.' });
        return;
      }

      roomState.handStates[socket.id] = !!isHandRaised;

      io.to(roomId).emit('user-hand-status', {
        socketId: socket.id,
        isHandRaised: !!isHandRaised,
      });
    });

    socket.on('mute-all-participants', (roomId) => {
      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = !!actor && (
        actor.role === 'admin' ||
        (roomState?.hostId && actor.userId === roomState.hostId)
      );

      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only the host can mute all participants.' });
        return;
      }

      socket.to(roomId).emit('trigger-mute-all');
    });

    socket.on('end-meeting-for-all', (roomId) => {
      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = !!actor && (
        actor.role === 'admin' ||
        (roomState?.hostId && actor.userId === roomState.hostId)
      );

      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only the host can end the meeting.' });
        return;
      }

      io.to(roomId).emit('meeting-ended-by-host');
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);

      const roomId = socket.data.videoRoomId;
      if (roomId) {
        const roomState = videoRoomState.get(roomId);
        if (roomState) {
          delete roomState.handStates[socket.id];
          delete roomState.userMap[socket.id];
        }

        socket.to(roomId).emit('user-disconnected', socket.id);
        cleanupVideoRoomState(io, roomId);
        return;
      }

      socket.broadcast.emit('user-disconnected', socket.id);
    });
  });
};

module.exports = setupSocketIO;
