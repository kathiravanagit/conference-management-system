import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import DOMPurify from 'dompurify';
import { useAuth } from '../../context/AuthContext';
import { conferenceAPI } from '../../utils/api';
import {
    FaMicrophone,
    FaMicrophoneSlash,
    FaVideo,
    FaVideoSlash,
    FaPhoneSlash,
    FaExpand,
    FaCompress,
    FaDesktop,
    FaStopCircle,
    FaUsers,
    FaPowerOff,
    FaUser,
    FaRegSmile,
    FaRegHandPaper,
    FaTh,
    FaColumns,
    FaComments,
    FaThumbtack,
    FaChevronDown,
    FaChevronUp,
} from 'react-icons/fa';
import './VideoMeeting.css';

// Utility to sanitize message text for safe display
const sanitizeMessageText = (text) => {
    if (typeof text !== 'string') return '';
    // Strip all HTML tags and dangerous content
    const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    return sanitized;
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL.replace('/api', '') || 'http://localhost:5000';

const VideoMeeting = () => {
    const { id: conferenceId } = useParams();
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [stream, setStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [peers, setPeers] = useState({});
    const [error, setError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isHost, setIsHost] = useState(false);
    const [peersInfo, setPeersInfo] = useState({});
    const [activeSpeakerSocketId, setActiveSpeakerSocketId] = useState(null);

    const [conferenceTitle, setConferenceTitle] = useState('Live Session');
    const [conferenceSchedule, setConferenceSchedule] = useState([]);
    const [publicMeetingId, setPublicMeetingId] = useState('');
    const [joinPhase, setJoinPhase] = useState('lobby');
    const [waitingMessage, setWaitingMessage] = useState('Waiting for host approval.');
    const [waitingRequests, setWaitingRequests] = useState([]);
    const [joiningMeeting, setJoiningMeeting] = useState(false);
    const [meetingPassword, setMeetingPassword] = useState('');
    const [requiresMeetingPassword, setRequiresMeetingPassword] = useState(false);
    const [screenShareAllowed, setScreenShareAllowed] = useState(true);
    const [selectedPrivateTarget, setSelectedPrivateTarget] = useState('all');
    const [recordings, setRecordings] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingError, setRecordingError] = useState('');
    const [meetingStarted, setMeetingStarted] = useState(false);
    const [isStartingMeeting, setIsStartingMeeting] = useState(false);

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activePanelTab, setActivePanelTab] = useState('participants');
    const [layoutMode, setLayoutMode] = useState('focus');
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [quickReaction, setQuickReaction] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMoreEmojis, setShowMoreEmojis] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [showEndMeetingConfirm, setShowEndMeetingConfirm] = useState(false);
    const [showMuteAllConfirm, setShowMuteAllConfirm] = useState(false);

    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([
        {
            id: 'welcome',
            author: 'System',
            text: 'Welcome to the meeting room. Keep messages respectful and on-topic.',
            time: new Date(),
        },
    ]);

    const socketRef = useRef();
    const localVideoRef = useRef();
    const peersRef = useRef({});
    const streamRef = useRef(null);
    const containerRef = useRef();
    const chatEndRef = useRef();
    const emojiPickerRef = useRef();
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordingStreamRef = useRef(null);

    const quickEmojiOptions = ['👏', '👍', '🔥', '🎉', '❤️'];
    const extraEmojiOptions = ['😂', '😮', '🙌', '💯', '✅', '🤝'];

    useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const invitePassword = params.get('pwd') || params.get('password') || '';
        if (invitePassword) {
            setMeetingPassword(invitePassword);
        }
    }, [location.search]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        const initLobby = async () => {
            try {
                const res = await conferenceAPI.getById(conferenceId);
                const conference = res.data.conference;
                const confCreator = conference?.createdBy;
                const creatorId = typeof confCreator === 'object' ? confCreator._id : confCreator;
                const isHostVal = creatorId === user?._id;
                const canManageRoom = isHostVal || user?.role === 'admin';
                setIsHost(isHostVal);
                setConferenceTitle(conference?.title || 'Live Session');
                setConferenceSchedule(Array.isArray(conference?.schedule) ? conference.schedule : []);
                setPublicMeetingId(conference?.meetingId || conferenceId.slice(0, 10));
                setRequiresMeetingPassword(!!conference?.meetingPasswordEnabled && !canManageRoom);
                setScreenShareAllowed(conference?.allowParticipantScreenShare !== false);

                if (canManageRoom) {
                    const recordingResponse = await conferenceAPI.getRecordings(conferenceId);
                    setRecordings(recordingResponse.data?.recordings || []);
                }
            } catch (err) {
                console.error('Failed to fetch conference details for host check', err);
            }

            try {
                const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(currentStream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = currentStream;
                }
            } catch (err) {
                console.error('Failed to get local stream', err);
                setError('Camera and microphone permissions are required to join the meeting.');
            }
        };

        initLobby();

        return () => {
            Object.values(peersRef.current).forEach((peerObj) => {
                peerObj.peer.close();
            });
            peersRef.current = {};

            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }

            if (screenStream) {
                screenStream.getTracks().forEach((track) => track.stop());
            }

            setPeers({});
            setPeersInfo({});
            setWaitingRequests([]);
        };
    }, [conferenceId, isAuthenticated, user, screenStream, navigate]);

    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.off();
            }
        };
    }, []);

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = isScreenSharing && screenStream ? screenStream : stream;
        }
    }, [stream, screenStream, isScreenSharing]);

    useEffect(() => {
        if (activeSpeakerSocketId && !peers[activeSpeakerSocketId]) {
            setActiveSpeakerSocketId(null);
        }
    }, [peers, activeSpeakerSocketId]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!quickReaction) return;
        const timeout = setTimeout(() => setQuickReaction(''), 1800);
        return () => clearTimeout(timeout);
    }, [quickReaction]);

    useEffect(() => {
        const handleOutsideEmojiPicker = (event) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
                setShowMoreEmojis(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideEmojiPicker);
        return () => document.removeEventListener('mousedown', handleOutsideEmojiPicker);
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    useEffect(() => {
        if (!showEndMeetingConfirm && !showMuteAllConfirm) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowEndMeetingConfirm(false);
                setShowMuteAllConfirm(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [showEndMeetingConfirm, showMuteAllConfirm]);

    const emitJoinVideoRoom = () => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.emit('join-video-room', {
            roomId: conferenceId,
            userId: user?._id,
            userName: user?.name || 'Participant',
            token: localStorage.getItem('token'),
            meetingPassword,
        });
    };

    const resetRemotePeers = () => {
        Object.values(peersRef.current).forEach((peerObj) => {
            peerObj.peer.close();
        });

        peersRef.current = {};
        setPeers({});
        setPeersInfo({});
        setActiveSpeakerSocketId(null);
    };

    const setupSocketListeners = (localStream, isHostVal) => {
        socketRef.current.on('connect', () => {
            setConnectionState('connected');
            setError('');
            resetRemotePeers();
            emitJoinVideoRoom();
        });

        socketRef.current.on('disconnect', () => {
            setConnectionState('reconnecting');
            resetRemotePeers();
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `reconnect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: 'Connection interrupted. Trying to reconnect... ',
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('connect_error', () => {
            setConnectionState('reconnecting');
        });

        socketRef.current.io.on('reconnect_attempt', () => {
            setConnectionState('reconnecting');
        });

        socketRef.current.io.on('reconnect', () => {
            setConnectionState('connected');
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `reconnected-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: 'Reconnected to the meeting.',
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('video-room-state', ({ handStates = {}, recentChat = [], recentReactions = [], screenShareEnabled = true, meetingStarted: started = false }) => {
            setJoinPhase('joined');
            setJoiningMeeting(false);
            setScreenShareAllowed(screenShareEnabled);
            setMeetingStarted(!!started);
            const nextInfo = {};
            Object.entries(handStates).forEach(([socketId, handRaised]) => {
                if (socketId !== socketRef.current.id) {
                    nextInfo[socketId] = { isHandRaised: !!handRaised };
                }
            });

            if (Object.keys(nextInfo).length > 0) {
                setPeersInfo((prev) => {
                    const merged = { ...prev };
                    Object.entries(nextInfo).forEach(([socketId, info]) => {
                        merged[socketId] = { ...(merged[socketId] || {}), ...info };
                    });
                    return merged;
                });
            }

            if (Array.isArray(recentChat) && recentChat.length > 0) {
                setChatMessages((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    const incoming = recentChat.filter((m) => !seen.has(m.id));
                    return [...prev, ...incoming];
                });
            }

            if (Array.isArray(recentReactions) && recentReactions.length > 0) {
                setChatMessages((prev) => {
                    const reactionMessages = recentReactions.map((reaction, index) => ({
                        id: `reaction-history-${index}-${new Date(reaction.time || Date.now()).getTime()}`,
                        author: 'System',
                        text: `${reaction.author || 'Participant'} reacted ${reaction.emoji}`,
                        time: reaction.time || new Date(),
                    }));
                    return [...prev, ...reactionMessages];
                });
            }
        });

        socketRef.current.on('video-room-auth-error', ({ message }) => {
            setJoiningMeeting(false);
            setError(message || 'Session expired. Please login again.');
        });

        socketRef.current.on('waiting-room-status', ({ status, message }) => {
            if (status === 'pending' || status === 'not-started') {
                setJoinPhase('waiting');
                setJoiningMeeting(false);
                setWaitingMessage(message || 'Waiting for host approval.');
                return;
            }

            if (status === 'approved') {
                setWaitingMessage('Admitted by host. Joining meeting...');
                return;
            }

            if (status === 'rejected') {
                setJoiningMeeting(false);
                setJoinPhase('lobby');
                setError(message || 'Host declined your join request.');
            }
        });

        socketRef.current.on('video-waiting-list', ({ waiting = [] }) => {
            if (!Array.isArray(waiting)) return;
            setWaitingRequests(waiting);
        });

        socketRef.current.on('meeting-status-updated', ({ meetingStarted: started }) => {
            setMeetingStarted(!!started);
            setIsStartingMeeting(false);
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `meeting-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: started ? 'Meeting has started.' : 'Meeting is currently paused.',
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('waiting-room-requested', (request) => {
            if (!request?.socketId) return;
            setWaitingRequests((prev) => {
                const exists = prev.some((item) => item.socketId === request.socketId);
                if (exists) return prev;
                return [...prev, request];
            });
        });

        socketRef.current.on('user-connected', async ({ socketId }) => {
            const peer = createPeerConnection(socketId, localStream);
            peersRef.current[socketId] = { peer, socketId };

            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socketRef.current.emit('video-offer', {
                    target: socketId,
                    sdp: offer,
                    userInfo: { userName: user.name, isHost: isHostVal },
                });
            } catch (err) {
                console.error('Error creating offer', err);
            }
        });

        socketRef.current.on('video-offer', async ({ caller, sdp, userInfo }) => {
            if (userInfo) {
                setPeersInfo((prev) => ({ ...prev, [caller]: userInfo }));
            }
            const peer = createPeerConnection(caller, localStream);
            peersRef.current[caller] = { peer, socketId: caller };

            try {
                await peer.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socketRef.current.emit('video-answer', {
                    target: caller,
                    sdp: answer,
                    userInfo: { userName: user.name, isHost: isHostVal },
                });
            } catch (err) {
                console.error('Error handling offer', err);
            }
        });

        socketRef.current.on('video-answer', async ({ caller, sdp, userInfo }) => {
            if (userInfo) {
                setPeersInfo((prev) => ({ ...prev, [caller]: userInfo }));
            }
            const peerObj = peersRef.current[caller];
            if (peerObj) {
                try {
                    await peerObj.peer.setRemoteDescription(new RTCSessionDescription(sdp));
                } catch (err) {
                    console.error('Error setting remote description from answer', err);
                }
            }
        });

        socketRef.current.on('new-ice-candidate', async ({ candidate, caller }) => {
            const peerObj = peersRef.current[caller];
            if (peerObj && candidate) {
                try {
                    await peerObj.peer.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('Error adding received ice candidate', err);
                }
            }
        });

        socketRef.current.on('user-disconnected', (socketId) => {
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].peer.close();
                delete peersRef.current[socketId];

                setPeers((prevPeers) => {
                    const newPeers = { ...prevPeers };
                    delete newPeers[socketId];
                    return newPeers;
                });
                setPeersInfo((prev) => {
                    const next = { ...prev };
                    delete next[socketId];
                    return next;
                });
            }
        });

        socketRef.current.on('user-media-status', ({ socketId, type, isMuted: remoteMuted, isVideoOff: remoteVideoOff }) => {
            setPeersInfo((prev) => {
                const info = prev[socketId] || {};
                return {
                    ...prev,
                    [socketId]: {
                        ...info,
                        isMuted: type === 'audio' ? remoteMuted : info.isMuted,
                        isVideoOff: type === 'video' ? remoteVideoOff : info.isVideoOff,
                    },
                };
            });
        });

        socketRef.current.on('user-hand-status', ({ socketId, isHandRaised: remoteHandRaised }) => {
            if (socketId === socketRef.current.id) return;

            setPeersInfo((prev) => {
                const info = prev[socketId] || {};
                return {
                    ...prev,
                    [socketId]: {
                        ...info,
                        isHandRaised: !!remoteHandRaised,
                    },
                };
            });
        });

        socketRef.current.on('video-chat-message', (message) => {
            setChatMessages((prev) => {
                if (prev.some((item) => item.id === message.id)) {
                    return prev;
                }
                return [...prev, message];
            });
        });

        socketRef.current.on('video-private-message', (message) => {
            setChatMessages((prev) => {
                if (prev.some((item) => item.id === message.id)) {
                    return prev;
                }
                return [...prev, { ...message, isPrivate: true }];
            });
        });

        socketRef.current.on('screen-share-permission-updated', ({ enabled }) => {
            setScreenShareAllowed(!!enabled);
            if (!enabled && isScreenSharing) {
                stopScreenSharing();
            }
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `share-policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: enabled ? 'Host enabled participant screen sharing.' : 'Host disabled participant screen sharing.',
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('removed-from-meeting', ({ message }) => {
            alert(message || 'You have been removed from this meeting by the host.');
            leaveMeeting();
        });

        socketRef.current.on('video-reaction', ({ emoji, author, socketId }) => {
            setQuickReaction(emoji);
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: `${socketId === socketRef.current.id ? 'You' : (author || 'Participant')} reacted ${emoji}`,
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('video-chat-error', ({ message }) => {
            if (!message) return;
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: message,
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('meeting-action-denied', ({ message }) => {
            const deniedMessage = message || 'You are not allowed to perform this action.';
            setChatMessages((prev) => [
                ...prev,
                {
                    id: `denied-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: 'System',
                    text: deniedMessage,
                    time: new Date(),
                },
            ]);
        });

        socketRef.current.on('trigger-mute-all', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.enabled) {
                    audioTrack.enabled = false;
                    setIsMuted(true);
                }
            }
        });

        socketRef.current.on('trigger-mute-single', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.enabled) {
                    audioTrack.enabled = false;
                    setIsMuted(true);
                }
            }
        });

        socketRef.current.on('meeting-ended-by-host', () => {
            alert('The host has ended this meeting across all participants.');
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
            navigate(`/conference/${conferenceId}`);
        });
    };

    const startJoinMeeting = () => {
        if (!stream) {
            setError('Camera and microphone permissions are required to join the meeting.');
            return;
        }

        const startSocketJoin = () => {
            setError('');
            setJoiningMeeting(true);
            setConnectionState('connecting');

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }

            const socket = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true });
            socketRef.current = socket;
            setupSocketListeners(stream, isHost);
        };

        if (!requiresMeetingPassword) {
            startSocketJoin();
            return;
        }

        conferenceAPI
            .authorizeMeetingJoin(conferenceId, meetingPassword)
            .then(() => startSocketJoin())
            .catch((err) => {
                setError(err?.response?.data?.message || 'Invalid meeting password.');
                setJoiningMeeting(false);
            });
    };

    const approveWaitingParticipant = (socketId) => {
        socketRef.current?.emit('approve-video-participant', {
            roomId: conferenceId,
            targetSocketId: socketId,
        });
    };

    const rejectWaitingParticipant = (socketId) => {
        socketRef.current?.emit('reject-video-participant', {
            roomId: conferenceId,
            targetSocketId: socketId,
        });
    };

    const createPeerConnection = (targetSocketId, localStream) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
            ],
        });

        localStream.getTracks().forEach((track) => {
            peer.addTrack(track, localStream);
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('new-ice-candidate', {
                    target: targetSocketId,
                    candidate: event.candidate,
                });
            }
        };

        peer.ontrack = (event) => {
            setPeers((prevPeers) => ({
                ...prevPeers,
                [targetSocketId]: event.streams[0],
            }));
        };

        return peer;
    };

    const toggleMute = () => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        socketRef.current?.emit('user-media-status', { roomId: conferenceId, type: 'audio', isMuted: newMuted });
    };

    const toggleVideo = () => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;
        videoTrack.enabled = !videoTrack.enabled;
        const newVideoOff = !videoTrack.enabled;
        setIsVideoOff(newVideoOff);
        socketRef.current?.emit('user-media-status', { roomId: conferenceId, type: 'video', isVideoOff: newVideoOff });
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleScreenShare = async () => {
        const canManageWaitingRoom = isHost || user?.role === 'admin';
        if (!canManageWaitingRoom && !screenShareAllowed) {
            setError('Host has disabled participant screen sharing for this meeting.');
            return;
        }

        if (!isScreenSharing) {
            try {
                const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(screen);
                const screenTrack = screen.getVideoTracks()[0];

                Object.values(peersRef.current).forEach((peerObj) => {
                    const sender = peerObj.peer.getSenders().find((s) => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screen;
                }
                setIsScreenSharing(true);
                screenTrack.onended = () => {
                    stopScreenSharing();
                };
            } catch (err) {
                console.error('Error sharing screen', err);
            }
        } else {
            stopScreenSharing();
        }
    };

    const stopScreenSharing = () => {
        if (screenStream) {
            screenStream.getTracks().forEach((t) => t.stop());
            setScreenStream(null);
        }

        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            Object.values(peersRef.current).forEach((peerObj) => {
                const sender = peerObj.peer.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (sender && videoTrack) {
                    sender.replaceTrack(videoTrack);
                }
            });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        }
        setIsScreenSharing(false);
    };

    const leaveMeeting = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach((track) => track.stop());
        }
        navigate(`/conference/${conferenceId}`);
    };

    const cancelJoinRequest = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setConnectionState('disconnected');
        setJoinPhase('lobby');
        setJoiningMeeting(false);
        setWaitingMessage('Waiting for host approval.');
    };

    const endMeetingForAll = () => {
        socketRef.current?.emit('end-meeting-for-all', conferenceId);
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        setShowEndMeetingConfirm(false);
        navigate(`/conference/${conferenceId}`);
    };

    const muteAllParticipants = () => {
        socketRef.current?.emit('mute-all-participants', conferenceId);
        setShowMuteAllConfirm(false);
    };

    const muteSingleParticipant = (socketId) => {
        socketRef.current?.emit('mute-single-participant', {
            roomId: conferenceId,
            targetSocketId: socketId,
        });
    };

    const startMeetingForEveryone = () => {
        setIsStartingMeeting(true);
        socketRef.current?.emit('start-meeting', conferenceId);
    };

    const tryReconnect = () => {
        if (!socketRef.current) return;
        if (!socketRef.current.connected) {
            setConnectionState('reconnecting');
            socketRef.current.connect();
            return;
        }

        emitJoinVideoRoom();
    };

    const sendReaction = (emoji) => {
        socketRef.current?.emit('video-reaction', {
            roomId: conferenceId,
            emoji,
        });
    };

    const sendChatMessage = () => {
        const text = chatInput.trim();
        if (!text) return;

        if (selectedPrivateTarget === 'all') {
            socketRef.current?.emit('video-chat-message', {
                roomId: conferenceId,
                text,
            });
        } else {
            socketRef.current?.emit('video-private-message', {
                roomId: conferenceId,
                targetSocketId: selectedPrivateTarget,
                text,
            });
        }
        setChatInput('');
    };

    const toggleParticipantScreenSharePermission = () => {
        const next = !screenShareAllowed;
        socketRef.current?.emit('set-screen-share-permission', {
            roomId: conferenceId,
            enabled: next,
        });
    };

    const removeParticipant = (socketId) => {
        socketRef.current?.emit('remove-participant', {
            roomId: conferenceId,
            targetSocketId: socketId,
        });
    };

    const togglePinParticipant = (participantId) => {
        if (participantId === 'local') {
            setActiveSpeakerSocketId(null);
            return;
        }

        setActiveSpeakerSocketId((prev) => (prev === participantId ? null : participantId));
    };

    const uploadRecordingBlob = async (blob) => {
        const formData = new FormData();
        formData.append('recording', blob, `${conferenceTitle.replace(/[^a-zA-Z0-9]+/g, '_')}_${Date.now()}.webm`);
        formData.append('title', `${conferenceTitle} Recording`);
        formData.append('durationSeconds', 0);

        const response = await conferenceAPI.uploadRecording(conferenceId, formData);
        const created = response.data?.recording;
        if (created) {
            setRecordings((prev) => [created, ...prev]);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        if (!stream) {
            setRecordingError('No media stream available to record.');
            return;
        }

        try {
            recordedChunksRef.current = [];

            const screenVideoTrack = isScreenSharing ? screenStream?.getVideoTracks?.()[0] : null;
            const cameraVideoTrack = stream.getVideoTracks?.()[0] || null;
            const selectedVideoTrack = screenVideoTrack || cameraVideoTrack;
            const micAudioTrack = stream.getAudioTracks?.()[0] || null;

            if (!selectedVideoTrack || selectedVideoTrack.readyState !== 'live') {
                setRecordingError('No active video track. Turn on camera or start screen share before recording.');
                return;
            }

            if (!screenVideoTrack && cameraVideoTrack && !cameraVideoTrack.enabled) {
                setRecordingError('Camera is off. Turn on camera or share screen before recording.');
                return;
            }

            const captureStream = new MediaStream();
            captureStream.addTrack(selectedVideoTrack);
            if (micAudioTrack && micAudioTrack.readyState === 'live') {
                captureStream.addTrack(micAudioTrack);
            }
            recordingStreamRef.current = captureStream;

            const recordingMimeTypes = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=h264,opus',
                'video/webm',
            ];
            const supportedMimeType = recordingMimeTypes.find((mimeType) => {
                if (typeof MediaRecorder.isTypeSupported !== 'function') {
                    return mimeType === 'video/webm';
                }
                return MediaRecorder.isTypeSupported(mimeType);
            });
            const recorderOptions = supportedMimeType ? { mimeType: supportedMimeType } : undefined;
            const recorder = new MediaRecorder(captureStream, recorderOptions);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                try {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    if (blob.size > 0) {
                        await uploadRecordingBlob(blob);
                        setRecordingError('');
                    }
                } catch (err) {
                    setRecordingError(err?.response?.data?.message || err.message || 'Failed to upload recording.');
                } finally {
                    if (recordingStreamRef.current) {
                        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
                        recordingStreamRef.current = null;
                    }
                }
            };

            recorder.start(1000);
            setIsRecording(true);
            setRecordingError('');
        } catch (err) {
            const message = err?.message || 'Recording is not supported in this browser.';
            setRecordingError(`Unable to start recording. ${message}`);
            setIsRecording(false);
            if (recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach((track) => track.stop());
                recordingStreamRef.current = null;
            }
        }
    };

    const canManageWaitingRoom = isHost || user?.role === 'admin';

    if (joinPhase !== 'joined') {
        const canJoinNow = !!stream && !joiningMeeting;
        return (
            <div className="video-lobby-page" ref={containerRef}>
                <div className="video-lobby-card">
                    <div className="video-lobby-main">
                        <h1>{conferenceTitle}</h1>
                        <p>Set your audio and video before joining the session.</p>

                        <div className="video-lobby-preview">
                            <video
                                playsInline
                                muted
                                ref={localVideoRef}
                                autoPlay
                                className={`video-stream ${isVideoOff ? 'hidden' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="video-off-placeholder">
                                    <FaVideoSlash size={44} />
                                </div>
                            )}
                            <div className="video-label stage-label">
                                <span>{user?.name || 'You'}{isHost ? ' (Host)' : ''}</span>
                                <span className="media-status-icons">
                                    {isMuted && <FaMicrophoneSlash className="status-icon" title="Muted" />}
                                </span>
                            </div>
                        </div>

                        <div className="video-lobby-controls">
                            <button
                                type="button"
                                className={`control-btn ${isMuted ? 'muted' : ''}`}
                                onClick={toggleMute}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                            </button>

                            <button
                                type="button"
                                className={`control-btn ${isVideoOff ? 'muted' : ''}`}
                                onClick={toggleVideo}
                                title={isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
                            >
                                {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
                            </button>
                        </div>

                        {error && <p className="lobby-error">{error}</p>}

                        {requiresMeetingPassword && (
                            <div className="lobby-password-row">
                                <label htmlFor="meeting-password">Meeting Password</label>
                                <input
                                    id="meeting-password"
                                    type="password"
                                    value={meetingPassword}
                                    onChange={(event) => setMeetingPassword(event.target.value)}
                                    placeholder="Enter meeting password"
                                />
                            </div>
                        )}

                        {joinPhase === 'waiting' ? (
                            <div className="lobby-waiting-block">
                                <p>{waitingMessage}</p>
                                <button type="button" className="btn-leave" onClick={cancelJoinRequest}>
                                    Cancel Request
                                </button>
                            </div>
                        ) : (
                            <div className="video-lobby-actions">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={startJoinMeeting}
                                    disabled={!canJoinNow}
                                >
                                    {joiningMeeting ? 'Joining...' : canManageWaitingRoom ? 'Join Host Console' : 'Join Session'}
                                </button>
                                <button type="button" className="btn btn-outline" onClick={() => navigate(`/conference/${conferenceId}`)}>
                                    Back to Details
                                </button>
                            </div>
                        )}
                    </div>

                    <aside className="video-lobby-side">
                        <h3>Session Details</h3>
                        <p><strong>Meeting ID:</strong> {publicMeetingId}</p>
                        <p><strong>Mode:</strong> {canManageWaitingRoom ? 'Host controls enabled' : 'Participant mode'}</p>
                        <p><strong>Network:</strong> {connectionState}</p>

                        {canManageWaitingRoom && (
                            <div className="lobby-recordings">
                                <h4>Recordings</h4>
                                {recordings.length === 0 ? (
                                    <p>No recordings uploaded yet.</p>
                                ) : (
                                    recordings.slice(0, 3).map((recording) => (
                                        <a
                                            key={recording._id}
                                            href={`${SOCKET_URL}${recording.fileUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {recording.title}
                                        </a>
                                    ))
                                )}
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="video-meeting-error">
                <div className="error-card">
                    <h2>Permission Denied</h2>
                    <p>{error}</p>
                    <button onClick={() => navigate(`/conference/${conferenceId}`)} className="btn-leave">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const peersArray = Object.entries(peers);
    const activeRemoteStream = activeSpeakerSocketId ? peers[activeSpeakerSocketId] : null;
    const activeRemoteInfo = activeSpeakerSocketId ? peersInfo[activeSpeakerSocketId] : null;

    const participants = [
        {
            id: 'local',
            name: user?.name || 'You',
            isHost,
            isMuted,
            isVideoOff,
            isLocal: true,
            isHandRaised,
        },
        ...peersArray.map(([socketId]) => ({
            id: socketId,
            name: peersInfo[socketId]?.userName || 'Participant',
            isHost: !!peersInfo[socketId]?.isHost,
            isMuted: !!peersInfo[socketId]?.isMuted,
            isVideoOff: !!peersInfo[socketId]?.isVideoOff,
            isLocal: false,
            isHandRaised: !!peersInfo[socketId]?.isHandRaised,
        })),
    ];

    const stageIsRemote = !isScreenSharing && !!activeRemoteStream;
    const topPresenterName = stageIsRemote
        ? (activeRemoteInfo?.userName || 'Participant')
        : `${user?.name || 'You'}${isScreenSharing ? ' (Presenting)' : ''}`;
    const participantCount = 1 + peersArray.length;
    const connectionStatus = {
        connecting: { label: 'Connecting...', className: 'connecting' },
        connected: { label: 'Connected', className: 'connected' },
        reconnecting: { label: 'Reconnecting...', className: 'reconnecting' },
        disconnected: { label: 'Disconnected', className: 'disconnected' },
    }[connectionState] || { label: 'Connecting...', className: 'connecting' };

    return (
        <div className="video-meeting-page" ref={containerRef}>
            <div className="video-meeting-header">
                <div className="video-meeting-header-left">
                    <h1>{conferenceTitle}</h1>
                    <span className="live-clock">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="meeting-header-right">
                    <span className={`connection-badge ${connectionStatus.className}`}>{connectionStatus.label}</span>
                    {(connectionState === 'reconnecting' || connectionState === 'disconnected') && (
                        <button type="button" className="reconnect-btn" onClick={tryReconnect}>Reconnect</button>
                    )}
                    <div className="participants-count">Participants: {participantCount}</div>
                </div>
            </div>

            <div className="meeting-spotlight-strip">
                <div className="presenter-meta">
                    <span className="presenter-dot" />
                    <span>{topPresenterName}</span>
                </div>
                <div className="meeting-code">Meeting ID: {publicMeetingId || conferenceId.slice(0, 10)}</div>
            </div>

            {!meetingStarted && canManageWaitingRoom && (
                <div className="meeting-start-banner">
                    <p>The meeting is not started yet. Start it to admit participants from the waiting room.</p>
                    <button type="button" onClick={startMeetingForEveryone} disabled={isStartingMeeting}>
                        {isStartingMeeting ? 'Starting...' : 'Start Meeting'}
                    </button>
                </div>
            )}

            <div className={`meeting-layout ${isPanelOpen ? 'panel-open' : 'panel-closed'}`}>
                <div className={`stage-area ${layoutMode === 'grid' ? 'stage-grid-mode' : ''}`}>
                    <div className="stage-video-wrap">
                        {layoutMode === 'grid' ? (
                            <div className="gallery-grid">
                                <VideoPlayer
                                    stream={stream}
                                    label={`You${isHost ? ' (Host)' : ''}`}
                                    isHost={isHost}
                                    isMuted={isMuted}
                                    isVideoOff={isVideoOff}
                                    raisedHand={isHandRaised}
                                    muted
                                />
                                {peersArray.map(([socketId, peerStream]) => (
                                    <VideoPlayer
                                        key={socketId}
                                        stream={peerStream}
                                        label={peersInfo[socketId]?.userName || 'Participant'}
                                        isHost={peersInfo[socketId]?.isHost}
                                        isMuted={peersInfo[socketId]?.isMuted}
                                        isVideoOff={peersInfo[socketId]?.isVideoOff}
                                        raisedHand={peersInfo[socketId]?.isHandRaised}
                                    />
                                ))}
                            </div>
                        ) : stageIsRemote ? (
                            <VideoPlayer
                                stream={activeRemoteStream}
                                label={activeRemoteInfo?.userName || 'Participant'}
                                isHost={activeRemoteInfo?.isHost}
                                isMuted={activeRemoteInfo?.isMuted}
                                isVideoOff={activeRemoteInfo?.isVideoOff}
                                raisedHand={activeRemoteInfo?.isHandRaised}
                                variant="stage"
                            />
                        ) : (
                            <div className="video-container stage-tile">
                                <video
                                    playsInline
                                    muted
                                    ref={localVideoRef}
                                    autoPlay
                                    className={`video-stream ${isVideoOff ? 'hidden' : ''}`}
                                />
                                {isVideoOff && (
                                    <div className="video-off-placeholder">
                                        <FaVideoSlash size={50} />
                                    </div>
                                )}
                                <div className="video-label stage-label">
                                    <span>{isScreenSharing ? 'You (Presenting)' : `You${isHost ? ' (Host)' : ''}`}</span>
                                    <span className="media-status-icons">
                                        {isHandRaised && <span className="raised-hand-pill" title="Hand raised">✋</span>}
                                        {isMuted && <FaMicrophoneSlash className="status-icon" title="Muted" />}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {layoutMode !== 'grid' && (
                        <div className="filmstrip-row" aria-label="Participant video strip">
                            <button
                                className="filmstrip-tile-btn"
                                type="button"
                                onClick={() => setActiveSpeakerSocketId(null)}
                                title="Pin yourself to stage"
                            >
                                <VideoPlayer
                                    stream={stream}
                                    label={`You${isHost ? ' (Host)' : ''}`}
                                    isHost={isHost}
                                    isMuted={isMuted}
                                    isVideoOff={isVideoOff}
                                    raisedHand={isHandRaised}
                                    muted
                                    variant="filmstrip"
                                    pinned={activeSpeakerSocketId === null}
                                />
                            </button>

                            {peersArray.map(([socketId, peerStream]) => (
                                <button
                                    key={socketId}
                                    className="filmstrip-tile-btn"
                                    type="button"
                                    onClick={() => setActiveSpeakerSocketId(socketId)}
                                    title={`Pin ${peersInfo[socketId]?.userName || 'participant'} to stage`}
                                >
                                    <VideoPlayer
                                        stream={peerStream}
                                        label={peersInfo[socketId]?.userName || 'Participant'}
                                        isHost={peersInfo[socketId]?.isHost}
                                        isMuted={peersInfo[socketId]?.isMuted}
                                        isVideoOff={peersInfo[socketId]?.isVideoOff}
                                        raisedHand={peersInfo[socketId]?.isHandRaised}
                                        variant="filmstrip"
                                        pinned={activeSpeakerSocketId === socketId}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {isPanelOpen && (
                    <aside className="participants-panel" aria-label="Meeting side panel">
                        <div className="panel-header">
                            <h3>Meeting Workspace</h3>
                            <p>{participantCount} participant{participantCount > 1 ? 's' : ''}</p>
                        </div>

                        <div className="panel-tabs">
                            <button
                                type="button"
                                className={`panel-tab ${activePanelTab === 'participants' ? 'active' : ''}`}
                                onClick={() => setActivePanelTab('participants')}
                            >
                                Participants
                            </button>
                            <button
                                type="button"
                                className={`panel-tab ${activePanelTab === 'chat' ? 'active' : ''}`}
                                onClick={() => setActivePanelTab('chat')}
                            >
                                Chat
                            </button>
                            <button
                                type="button"
                                className={`panel-tab ${activePanelTab === 'agenda' ? 'active' : ''}`}
                                onClick={() => setActivePanelTab('agenda')}
                            >
                                Agenda
                            </button>
                            {canManageWaitingRoom && (
                                <button
                                    type="button"
                                    className={`panel-tab ${activePanelTab === 'recordings' ? 'active' : ''}`}
                                    onClick={() => setActivePanelTab('recordings')}
                                >
                                    Recordings
                                </button>
                            )}
                        </div>

                        {activePanelTab === 'participants' && (
                            <div className="participants-list">
                                {canManageWaitingRoom && (
                                    <div className="waiting-room-card">
                                        <div className="waiting-room-head">
                                            <h4>Waiting Room</h4>
                                            <span>{waitingRequests.length}</span>
                                        </div>
                                        {waitingRequests.length === 0 ? (
                                            <p className="waiting-empty">No pending requests.</p>
                                        ) : (
                                            waitingRequests.map((request) => (
                                                <div key={request.socketId} className="waiting-item">
                                                    <div>
                                                        <strong>{request.userName || 'Participant'}</strong>
                                                    </div>
                                                    <div className="waiting-actions">
                                                        <button type="button" onClick={() => approveWaitingParticipant(request.socketId)}>
                                                            Admit
                                                        </button>
                                                        <button type="button" className="decline" onClick={() => rejectWaitingParticipant(request.socketId)}>
                                                            Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {participants.map((participant) => (
                                    <div key={participant.id} className="participants-item">
                                        <div className="participants-name-wrap">
                                            <span className="participants-name">{participant.isLocal ? 'You' : participant.name}</span>
                                            {participant.isHost && <span className="host-pill">Host</span>}
                                        </div>
                                        <div className="participants-state">
                                            {participant.isHandRaised && <span title="Hand raised">✋</span>}
                                            {participant.isMuted && <FaMicrophoneSlash title="Muted" />}
                                            {participant.isVideoOff && <FaVideoSlash title="Camera off" />}
                                            <button
                                                type="button"
                                                className={`participant-pin-btn ${activeSpeakerSocketId === participant.id || (participant.id === 'local' && activeSpeakerSocketId === null) ? 'active' : ''}`}
                                                onClick={() => togglePinParticipant(participant.id)}
                                            >
                                                <FaThumbtack />
                                            </button>
                                            {canManageWaitingRoom && !participant.isLocal && (
                                                <button
                                                    type="button"
                                                    className="participant-mute-btn"
                                                    onClick={() => muteSingleParticipant(participant.id)}
                                                >
                                                    Mute
                                                </button>
                                            )}
                                            {canManageWaitingRoom && !participant.isLocal && (
                                                <button
                                                    type="button"
                                                    className="participant-remove-btn"
                                                    onClick={() => removeParticipant(participant.id)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activePanelTab === 'chat' && (
                            <div className="meeting-chat-wrap">
                                <div className="meeting-chat-list">
                                    {chatMessages.map((message) => (
                                        <div key={message.id} className="meeting-chat-item">
                                            <div className="meeting-chat-head">
                                                <strong>{sanitizeMessageText(message.author)} {message.isPrivate ? '(Private)' : ''}</strong>
                                                <span>{new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p>{sanitizeMessageText(message.text)}</p>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="meeting-chat-input-row">
                                    <select
                                        value={selectedPrivateTarget}
                                        onChange={(event) => setSelectedPrivateTarget(event.target.value)}
                                        className="private-target-select"
                                    >
                                        <option value="all">Everyone</option>
                                        {participants
                                            .filter((participant) => !participant.isLocal)
                                            .map((participant) => (
                                                <option key={participant.id} value={participant.id}>
                                                    {participant.name}
                                                </option>
                                            ))}
                                    </select>
                                    <input
                                        value={chatInput}
                                        onChange={(event) => setChatInput(event.target.value)}
                                        placeholder="Type a message"
                                        maxLength={500}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') sendChatMessage();
                                        }}
                                    />
                                    <button type="button" onClick={sendChatMessage}>Send</button>
                                </div>
                            </div>
                        )}

                        {activePanelTab === 'agenda' && (
                            <div className="agenda-panel-list">
                                {conferenceSchedule.length === 0 ? (
                                    <p className="empty-panel-note">No agenda added for this conference.</p>
                                ) : (
                                    conferenceSchedule.map((item, index) => (
                                        <div key={`${item.time}-${index}`} className="agenda-panel-item">
                                            <span>{item.time || '--:--'}</span>
                                            <p>{item.activity || 'Session item'}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activePanelTab === 'recordings' && canManageWaitingRoom && (
                            <div className="recordings-panel-list">
                                {recordings.length === 0 ? (
                                    <p className="empty-panel-note">No recordings uploaded yet.</p>
                                ) : (
                                    recordings.map((recording) => (
                                        <div key={recording._id} className="recording-panel-item">
                                            <strong>{recording.title}</strong>
                                            <video controls src={`${SOCKET_URL}${recording.fileUrl}`} />
                                            <a href={`${SOCKET_URL}${recording.fileUrl}`} target="_blank" rel="noreferrer">
                                                Open recording
                                            </a>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {quickReaction && <div className="reaction-toast">{quickReaction}</div>}

            <div className="video-controls">
                <div className="controls-group controls-group-left">
                    <button
                        className={`control-btn ${isPanelOpen ? 'sharing' : ''}`}
                        onClick={() => {
                            setIsPanelOpen((prev) => !prev);
                            if (!isPanelOpen) setActivePanelTab('participants');
                        }}
                        title={isPanelOpen ? 'Hide side panel' : 'Show side panel'}
                        aria-label={isPanelOpen ? 'Hide side panel' : 'Show side panel'}
                    >
                        {activePanelTab === 'chat' ? <FaComments /> : <FaUsers />}
                    </button>

                    <button
                        className={`control-btn ${layoutMode === 'grid' ? 'sharing' : ''}`}
                        onClick={() => setLayoutMode((prev) => (prev === 'focus' ? 'grid' : 'focus'))}
                        title={layoutMode === 'grid' ? 'Switch to Focus mode' : 'Switch to Gallery mode'}
                        aria-label={layoutMode === 'grid' ? 'Switch to focus layout' : 'Switch to gallery layout'}
                    >
                        {layoutMode === 'grid' ? <FaColumns /> : <FaTh />}
                    </button>
                </div>

                <div className="controls-group controls-group-center">
                    <button
                        className={`control-btn ${isMuted ? 'muted' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                        {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                    </button>

                    <button
                        className={`control-btn ${isVideoOff ? 'muted' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
                        aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                        {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
                    </button>

                    <button
                        className={`control-btn ${isScreenSharing ? 'sharing' : ''}`}
                        onClick={toggleScreenShare}
                        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                        aria-label={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
                    >
                        {isScreenSharing ? <FaStopCircle /> : <FaDesktop />}
                    </button>

                    <button
                        className={`control-btn ${isHandRaised ? 'host-action-btn' : ''}`}
                        onClick={() => {
                            const next = !isHandRaised;
                            setIsHandRaised(next);
                            socketRef.current?.emit('user-hand-status', {
                                roomId: conferenceId,
                                isHandRaised: next,
                            });
                        }}
                        title={isHandRaised ? 'Lower hand' : 'Raise hand'}
                        aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                    >
                        <FaRegHandPaper />
                    </button>

                    <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                        <button
                            className={`control-btn ${showEmojiPicker ? 'sharing' : ''}`}
                            onClick={() => setShowEmojiPicker((prev) => !prev)}
                            title="Send emoji reaction"
                            aria-label="Open emoji reactions"
                        >
                            <FaRegSmile />
                        </button>

                        {showEmojiPicker && (
                            <div className="emoji-picker-popover">
                                <div className="emoji-row">
                                    {quickEmojiOptions.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            className="emoji-btn"
                                            onClick={() => {
                                                sendReaction(emoji);
                                                setShowEmojiPicker(false);
                                                setShowMoreEmojis(false);
                                            }}
                                            title={`Send ${emoji}`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className="emoji-more-btn"
                                        onClick={() => setShowMoreEmojis((prev) => !prev)}
                                        title={showMoreEmojis ? 'Show fewer emojis' : 'Show more emojis'}
                                        aria-label={showMoreEmojis ? 'Show fewer emojis' : 'Show more emojis'}
                                    >
                                        {showMoreEmojis ? <FaChevronUp /> : <FaChevronDown />}
                                    </button>
                                </div>

                                {showMoreEmojis && (
                                    <div className="emoji-row emoji-row-more">
                                        {extraEmojiOptions.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                className="emoji-btn"
                                                onClick={() => {
                                                    sendReaction(emoji);
                                                    setShowEmojiPicker(false);
                                                    setShowMoreEmojis(false);
                                                }}
                                                title={`Send ${emoji}`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        className="control-btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                        aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                    >
                        {isFullscreen ? <FaCompress /> : <FaExpand />}
                    </button>
                </div>

                <div className="controls-group controls-group-right">
                    {canManageWaitingRoom && (
                        <button
                            className={`control-btn ${screenShareAllowed ? 'sharing' : 'muted'}`}
                            onClick={toggleParticipantScreenSharePermission}
                            title={screenShareAllowed ? 'Disable participant screen share' : 'Enable participant screen share'}
                            aria-label={screenShareAllowed ? 'Disable participant screen share' : 'Enable participant screen share'}
                        >
                            <FaDesktop />
                        </button>
                    )}

                    {isHost && (
                        <button
                            className={`control-btn ${isRecording ? 'muted' : ''}`}
                            onClick={toggleRecording}
                            title={isRecording ? 'Stop host recording (local)' : 'Start host recording (local)'}
                            aria-label={isRecording ? 'Stop host recording' : 'Start host recording'}
                        >
                            <FaStopCircle />
                        </button>
                    )}

                    {isHost && (
                        <button
                            className="control-btn host-action-btn"
                            onClick={() => setShowMuteAllConfirm(true)}
                            title="Mute All Participants"
                            aria-label="Mute all participants"
                        >
                            <FaUsers />
                        </button>
                    )}

                    <button className="control-btn leave-btn" onClick={leaveMeeting} title="Leave Meeting" aria-label="Leave meeting">
                        <FaPhoneSlash /> <span>Leave</span>
                    </button>

                    {isHost && (
                        <button
                            className="control-btn leave-btn end-all-btn"
                            onClick={() => setShowEndMeetingConfirm(true)}
                            title="End Meeting for All"
                            aria-label="End meeting for all participants"
                        >
                            <FaPowerOff /> <span>End for All</span>
                        </button>
                    )}
                </div>
            </div>

            {recordingError && <div className="recording-error-banner">{recordingError}</div>}

            {showEndMeetingConfirm && (
                <div className="meeting-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm end meeting">
                    <div className="meeting-confirm-card">
                        <h3>End meeting for everyone?</h3>
                        <p>This will disconnect all participants and close the meeting immediately.</p>
                        <div className="meeting-confirm-actions">
                            <button
                                type="button"
                                className="meeting-confirm-btn secondary"
                                onClick={() => setShowEndMeetingConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="meeting-confirm-btn danger"
                                onClick={endMeetingForAll}
                            >
                                End for All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMuteAllConfirm && (
                <div className="meeting-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm mute all">
                    <div className="meeting-confirm-card">
                        <h3>Mute all participants?</h3>
                        <p>This will turn off microphone audio for all other participants in this meeting.</p>
                        <div className="meeting-confirm-actions">
                            <button
                                type="button"
                                className="meeting-confirm-btn secondary"
                                onClick={() => setShowMuteAllConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="meeting-confirm-btn warning"
                                onClick={muteAllParticipants}
                            >
                                Mute All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VideoPlayer = ({ stream, label, isHost, isMuted, isVideoOff, raisedHand, variant = 'grid', muted = false, pinned = false }) => {
    const ref = useRef();

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={`video-container ${variant === 'stage' ? 'stage-tile' : ''} ${variant === 'filmstrip' ? 'filmstrip-tile' : ''}`}>
            {variant === 'filmstrip' && (
                <span className={`tile-pin-indicator ${pinned ? 'active' : ''}`} title={pinned ? 'Pinned to stage' : 'Tap tile to pin'}>
                    <FaThumbtack />
                </span>
            )}
            <video playsInline autoPlay muted={muted} ref={ref} className={`video-stream ${isVideoOff ? 'hidden' : ''}`} />
            {isVideoOff && (
                <div className="video-off-placeholder">
                    <FaUser size={40} />
                </div>
            )}
            <span className={`video-label ${variant === 'stage' ? 'stage-label' : ''}`}>
                <span>{label}</span>
                {isHost && <span className="host-badge">Host</span>}
                <span className="media-status-icons">
                    {raisedHand && <span className="raised-hand-pill" title="Hand raised">✋</span>}
                    {isMuted && <FaMicrophoneSlash className="status-icon" title="Muted" />}
                </span>
            </span>
        </div>
    );
};

export default VideoMeeting;
