import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
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
} from 'react-icons/fa';
import './VideoMeeting.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace('/api', '');

const VideoMeeting = () => {
    const { id: conferenceId } = useParams();
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

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

    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [activePanelTab, setActivePanelTab] = useState('participants');
    const [layoutMode, setLayoutMode] = useState('focus');
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [quickReaction, setQuickReaction] = useState('');
    const [connectionState, setConnectionState] = useState('connecting');
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

    useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        const initMeeting = async () => {
            let isHostVal = false;
            try {
                const res = await conferenceAPI.getById(conferenceId);
                const conference = res.data.conference;
                const confCreator = conference?.createdBy;
                const creatorId = typeof confCreator === 'object' ? confCreator._id : confCreator;
                isHostVal = creatorId === user?._id;
                setIsHost(isHostVal);
                setConferenceTitle(conference?.title || 'Live Session');
                setConferenceSchedule(Array.isArray(conference?.schedule) ? conference.schedule : []);
            } catch (err) {
                console.error('Failed to fetch conference details for host check', err);
            }

            socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
            setConnectionState('connecting');

            try {
                const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(currentStream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = currentStream;
                }

                setupSocketListeners(currentStream, isHostVal);
            } catch (err) {
                console.error('Failed to get local stream', err);
                setError('Camera and microphone permissions are required to join the meeting.');
            }
        };

        initMeeting();

        const currentPeers = peersRef.current;
        const currentSocket = socketRef.current;

        return () => {
            if (currentPeers) {
                Object.values(currentPeers).forEach((peerObj) => {
                    peerObj.peer.close();
                });
                peersRef.current = {};
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (currentSocket) {
                currentSocket.disconnect();
            }
            setPeers({});
            setPeersInfo({});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conferenceId]);

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = isScreenSharing && screenStream ? screenStream : stream;
        }
    }, [stream, screenStream, isScreenSharing]);

    useEffect(() => {
        const peerIds = Object.keys(peers);
        if (activeSpeakerSocketId && !peerIds.includes(activeSpeakerSocketId)) {
            setActiveSpeakerSocketId(peerIds[0] || null);
            return;
        }
        if (!activeSpeakerSocketId && peerIds.length > 0) {
            setActiveSpeakerSocketId(peerIds[0]);
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

        socketRef.current.on('video-room-state', ({ handStates = {}, recentChat = [], recentReactions = [] }) => {
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
            setError(message || 'Session expired. Please login again.');
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

        socketRef.current.on('meeting-ended-by-host', () => {
            alert('The host has ended this meeting across all participants.');
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
            navigate(`/conference/${conferenceId}`);
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
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        navigate(`/conference/${conferenceId}`);
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

        socketRef.current?.emit('video-chat-message', {
            roomId: conferenceId,
            text,
        });
        setChatInput('');
    };

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
                <div className="meeting-code">Room: {conferenceId.slice(0, 10)}</div>
            </div>

            <div className="meeting-layout">
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
                            {!stageIsRemote && peersArray.map(([socketId, peerStream]) => (
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
                                    />
                                </button>
                            ))}

                            {stageIsRemote && (
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
                                    />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {isPanelOpen && (
                    <aside className="participants-panel" aria-label="Meeting side panel">
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
                        </div>

                        {activePanelTab === 'participants' && (
                            <div className="participants-list">
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
                                                <strong>{message.author}</strong>
                                                <span>{new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p>{message.text}</p>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                <div className="meeting-chat-input-row">
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
                    </aside>
                )}
            </div>

            {quickReaction && <div className="reaction-toast">{quickReaction}</div>}

            <div className="video-controls">
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
                    className="control-btn"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                    aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                >
                    {isFullscreen ? <FaCompress /> : <FaExpand />}
                </button>

                <button
                    className={`control-btn ${layoutMode === 'grid' ? 'sharing' : ''}`}
                    onClick={() => setLayoutMode((prev) => (prev === 'focus' ? 'grid' : 'focus'))}
                    title={layoutMode === 'grid' ? 'Switch to Focus mode' : 'Switch to Gallery mode'}
                    aria-label={layoutMode === 'grid' ? 'Switch to focus layout' : 'Switch to gallery layout'}
                >
                    {layoutMode === 'grid' ? <FaColumns /> : <FaTh />}
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

                <button
                    className="control-btn"
                    onClick={() => sendReaction('👏')}
                    title="Send applause"
                    aria-label="Send applause reaction"
                >
                    <FaRegSmile />
                </button>

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

const VideoPlayer = ({ stream, label, isHost, isMuted, isVideoOff, raisedHand, variant = 'grid', muted = false }) => {
    const ref = useRef();

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={`video-container ${variant === 'stage' ? 'stage-tile' : ''} ${variant === 'filmstrip' ? 'filmstrip-tile' : ''}`}>
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
