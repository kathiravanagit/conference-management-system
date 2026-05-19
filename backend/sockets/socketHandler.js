const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const xss = require('xss');
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
      waitingMap: {},
      approvedUserIds: {},
      screenShareEnabled: true,
      meetingStarted: false,
    });
  }
  return videoRoomState.get(roomId);
};

const isMeetingHostOrAdmin = (roomState, userId, role) => {
  if (!roomState || !userId) return false;
  return role === 'admin' || (roomState.hostId && userId === roomState.hostId);
};

const getWaitingList = (roomState) =>
  Object.entries(roomState.waitingMap || {}).map(([socketId, user]) => ({
    socketId,
    userId: user.userId,
    userName: user.userName,
    requestedAt: user.requestedAt,
  }));

const cleanupVideoRoomState = (io, roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  const roomState = videoRoomState.get(roomId);
  const hasWaitingUsers = !!roomState && Object.keys(roomState.waitingMap || {}).length > 0;
  if ((!room || room.size === 0) && !hasWaitingUsers) {
    videoRoomState.delete(roomId);
  }
};

const sanitizeChatText = (value = '') => {
  // First remove XSS attempts
  const xssSanitized = xss(String(value), {
    whiteList: {},
    stripIgnoredTag: true,
    stripLeakingHtml: true,
  });
  // Then normalize whitespace
  return xssSanitized
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeDisplayName = (value = '') => {
  const cleaned = String(value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Participant';
  return cleaned.slice(0, 80);
};

const verifySocketToken = (token, socket) => {
  // 1. Try to extract from handshake cookie (Secure HTTP-only cookie, most reliable)
  let actualToken = null;
  const cookieHeader = socket?.request?.headers?.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;)\s*authToken\s*=\s*([^;]+)/);
    if (match) {
      actualToken = match[1];
    }
  }

  // 2. Fallback to passed token
  if (!actualToken) {
    actualToken = token;
  }

  if (!actualToken) return null;
  try {
    return jwt.verify(actualToken, process.env.JWT_SECRET);
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
      meetingPassword: rawRoomId.meetingPassword,
    };
  }

  return {
    roomId: rawRoomId,
    userId: rawUserId,
    userName: 'Participant',
    token: rawToken,
    meetingPassword: undefined,
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

      const decoded = verifySocketToken(payload.token, socket);
      if (!decoded?.id) {
        socket.emit('video-room-auth-error', { message: 'Session expired. Please login again.' });
        return;
      }

      if (payload.userId && payload.userId !== decoded.id) {
        socket.emit('video-room-auth-error', { message: 'Invalid meeting identity payload.' });
        return;
      }

      const roomState = getOrCreateVideoRoomState(roomId);
      const userEntry = {
        userId: decoded.id,
        userName: normalizeDisplayName(payload.userName),
        role: decoded.role,
      };

      let conf = null;
      if (mongoose.Types.ObjectId.isValid(roomId)) {
        conf = await Conference.findById(roomId)
          .select('createdBy allowParticipantScreenShare meetingPasswordEnabled meetingPasswordHash')
          .lean();
      }

      if (!roomState.hostId && conf) {
        roomState.hostId = conf?.createdBy?.toString() || null;
        roomState.screenShareEnabled = conf?.allowParticipantScreenShare !== false;
      }

      const isPrivilegedUser = isMeetingHostOrAdmin(roomState, decoded.id, decoded.role);
      const isPreviouslyApproved = !!roomState.approvedUserIds?.[decoded.id];

      if (!isPrivilegedUser && conf?.meetingPasswordEnabled) {
        const matchesPassword = await bcrypt.compare(String(payload.meetingPassword || ''), conf.meetingPasswordHash || '');
        if (!matchesPassword) {
          socket.emit('video-room-auth-error', { message: 'Incorrect meeting password.' });
          return;
        }
      }

      if (!isPrivilegedUser && !isPreviouslyApproved) {
        roomState.waitingMap[socket.id] = {
          ...userEntry,
          requestedAt: new Date(),
        };
        socket.data.pendingVideoRoomId = roomId;

        socket.emit('waiting-room-status', {
          status: roomState.meetingStarted ? 'pending' : 'not-started',
          message: roomState.meetingStarted
            ? 'Waiting for host approval.'
            : 'Host has not started the meeting yet. Please wait.',
        });

        const hostSockets = Object.entries(roomState.userMap)
          .filter(([, user]) => isMeetingHostOrAdmin(roomState, user.userId, user.role))
          .map(([socketId]) => socketId);

        hostSockets.forEach((hostSocketId) => {
          io.to(hostSocketId).emit('waiting-room-requested', {
            socketId: socket.id,
            userId: userEntry.userId,
            userName: userEntry.userName,
            requestedAt: roomState.waitingMap[socket.id].requestedAt,
          });
          io.to(hostSocketId).emit('video-waiting-list', { waiting: getWaitingList(roomState) });
        });
        return;
      }

      delete roomState.waitingMap[socket.id];
      roomState.approvedUserIds[userEntry.userId] = true;
      socket.join(roomId);
      socket.data.videoRoomId = roomId;
      delete socket.data.pendingVideoRoomId;
      roomState.userMap[socket.id] = userEntry;

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
        screenShareEnabled: roomState.screenShareEnabled,
        meetingStarted: roomState.meetingStarted,
      });

      if (isPrivilegedUser) {
        socket.emit('video-waiting-list', { waiting: getWaitingList(roomState) });
      }

      socket.to(roomId).emit('user-connected', { userId: decoded.id, socketId: socket.id });
    });

    socket.on('approve-video-participant', ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const canManageWaiting = isMeetingHostOrAdmin(roomState, actor?.userId, actor?.role);
      if (!canManageWaiting) {
        socket.emit('meeting-action-denied', { message: 'Only the host can admit participants.' });
        return;
      }

      const pendingUser = roomState?.waitingMap?.[targetSocketId];
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!pendingUser || !targetSocket) {
        socket.emit('video-waiting-list', { waiting: getWaitingList(roomState) });
        return;
      }

      delete roomState.waitingMap[targetSocketId];
      roomState.approvedUserIds[pendingUser.userId] = true;
      roomState.userMap[targetSocketId] = {
        userId: pendingUser.userId,
        userName: pendingUser.userName,
        role: pendingUser.role,
      };

      targetSocket.join(roomId);
      targetSocket.data.videoRoomId = roomId;
      delete targetSocket.data.pendingVideoRoomId;

      targetSocket.emit('waiting-room-status', {
        status: 'approved',
        message: 'You have been admitted to the meeting.',
      });

      targetSocket.emit('video-room-state', {
        handStates: roomState.handStates,
        recentChat: roomState.recentChat,
        recentReactions: roomState.recentReactions,
        screenShareEnabled: roomState.screenShareEnabled,
        meetingStarted: roomState.meetingStarted,
      });

      io.to(roomId).emit('user-connected', { userId: pendingUser.userId, socketId: targetSocketId });
      io.to(roomId).emit('video-waiting-list', { waiting: getWaitingList(roomState) });
    });

    socket.on('reject-video-participant', ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const canManageWaiting = isMeetingHostOrAdmin(roomState, actor?.userId, actor?.role);
      if (!canManageWaiting) {
        socket.emit('meeting-action-denied', { message: 'Only the host can reject participants.' });
        return;
      }

      const pendingUser = roomState?.waitingMap?.[targetSocketId];
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!pendingUser) {
        socket.emit('video-waiting-list', { waiting: getWaitingList(roomState) });
        return;
      }

      delete roomState.waitingMap[targetSocketId];
      if (targetSocket) {
        targetSocket.emit('waiting-room-status', {
          status: 'rejected',
          message: 'Host declined your join request.',
        });
        delete targetSocket.data.pendingVideoRoomId;
      }

      io.to(roomId).emit('video-waiting-list', { waiting: getWaitingList(roomState) });
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

    socket.on('video-private-message', (data) => {
      const { roomId, targetSocketId, text } = data || {};
      if (!roomId || !targetSocketId || !text) return;

      const normalizedText = sanitizeChatText(text);
      if (!normalizedText || normalizedText.length > MAX_CHAT_MESSAGE_LENGTH) {
        socket.emit('video-chat-error', {
          message: `Message must be 1-${MAX_CHAT_MESSAGE_LENGTH} characters.`,
        });
        return;
      }

      const roomState = getOrCreateVideoRoomState(roomId);
      const sender = roomState.userMap[socket.id];
      const receiver = roomState.userMap[targetSocketId];
      if (!sender?.userId || !receiver?.userId) {
        socket.emit('video-chat-error', { message: 'Private chat target is not available.' });
        return;
      }

      const payload = {
        id: new mongoose.Types.ObjectId().toString(),
        socketId: socket.id,
        author: sender.userName || 'Participant',
        text: normalizedText,
        time: new Date(),
      };

      socket.emit('video-private-message', payload);
      socket.to(targetSocketId).emit('video-private-message', payload);
    });

    socket.on('set-screen-share-permission', ({ roomId, enabled } = {}) => {
      if (!roomId || typeof enabled !== 'boolean') return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = isMeetingHostOrAdmin(roomState, actor?.userId, actor?.role);
      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only host/admin can change screen share permissions.' });
        return;
      }

      roomState.screenShareEnabled = enabled;
      if (mongoose.Types.ObjectId.isValid(roomId)) {
        Conference.findByIdAndUpdate(roomId, { allowParticipantScreenShare: enabled }).catch((error) => {
          console.error('Failed to persist screen share setting:', error.message);
        });
      }
      io.to(roomId).emit('screen-share-permission-updated', { enabled });
    });

    socket.on('remove-participant', ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = isMeetingHostOrAdmin(roomState, actor?.userId, actor?.role);
      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only host/admin can remove participants.' });
        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return;

      targetSocket.emit('removed-from-meeting', { message: 'Host removed you from the meeting.' });
      targetSocket.leave(roomId);
      delete roomState.userMap[targetSocketId];
      delete roomState.handStates[targetSocketId];

      io.to(roomId).emit('user-disconnected', targetSocketId);
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

    socket.on('mute-single-participant', ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = !!actor && (
        actor.role === 'admin' ||
        (roomState?.hostId && actor.userId === roomState.hostId)
      );

      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only the host can mute participants.' });
        return;
      }

      io.to(targetSocketId).emit('trigger-mute-single');
    });

    socket.on('start-meeting', (roomId) => {
      if (!roomId) return;

      const roomState = videoRoomState.get(roomId);
      const actor = roomState?.userMap?.[socket.id];
      const isAuthorized = !!actor && (
        actor.role === 'admin' ||
        (roomState?.hostId && actor.userId === roomState.hostId)
      );

      if (!isAuthorized) {
        socket.emit('meeting-action-denied', { message: 'Only the host can start the meeting.' });
        return;
      }

      roomState.meetingStarted = true;
      io.to(roomId).emit('meeting-status-updated', { meetingStarted: true });

      Object.keys(roomState.waitingMap || {}).forEach((waitingSocketId) => {
        io.to(waitingSocketId).emit('waiting-room-status', {
          status: 'pending',
          message: 'Meeting started. Waiting for host approval.',
        });
      });
      io.to(roomId).emit('video-waiting-list', { waiting: getWaitingList(roomState) });
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

      roomState.meetingStarted = false;
      io.to(roomId).emit('meeting-ended-by-host');
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);

      const pendingRoomId = socket.data.pendingVideoRoomId;
      if (pendingRoomId) {
        const pendingRoomState = videoRoomState.get(pendingRoomId);
        if (pendingRoomState) {
          delete pendingRoomState.waitingMap[socket.id];

          const hostSockets = Object.entries(pendingRoomState.userMap)
            .filter(([, user]) => isMeetingHostOrAdmin(pendingRoomState, user.userId, user.role))
            .map(([socketId]) => socketId);

          hostSockets.forEach((hostSocketId) => {
            io.to(hostSocketId).emit('video-waiting-list', { waiting: getWaitingList(pendingRoomState) });
          });
        }
      }

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
