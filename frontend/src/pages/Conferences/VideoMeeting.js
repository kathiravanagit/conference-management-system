import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { conferenceAPI } from '../../utils/api';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaExpand, FaCompress, FaDesktop, FaStopCircle, FaUsers, FaPowerOff, FaUser } from 'react-icons/fa';
import './VideoMeeting.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// Automatically extract the base URL for the WebSocket connection
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

    const socketRef = useRef();
    const localVideoRef = useRef();
    const peersRef = useRef({}); // keep track of RTCPeerConnections
    const containerRef = useRef();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        // Connect to WebSocket and initialize meeting
        const initMeeting = async () => {
            let isHostVal = false;
            // Check if user is the meeting host
            try {
                const res = await conferenceAPI.getById(conferenceId);
                const confCreator = res.data.conference?.createdBy;
                const creatorId = typeof confCreator === 'object' ? confCreator._id : confCreator;
                isHostVal = (creatorId === user?._id);
                setIsHost(isHostVal);
            } catch (err) {
                console.error("Failed to fetch conference details for host check", err);
            }

            socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });

            // Request webcam/microphone permissions
            try {
                const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(currentStream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = currentStream;
                }

                // Setup socket listeners for WebRTC
                setupSocketListeners(currentStream, isHostVal);

                // Join the room
                socketRef.current.emit('join-video-room', conferenceId, user._id);
            } catch (err) {
                console.error('Failed to get local stream', err);
                setError('Camera and microphone permissions are required to join the meeting.');
            }
        };

        initMeeting();

        const currentPeers = peersRef.current;
        const currentSocket = socketRef.current;

        return () => {
            // Cleanup WebRTC connections and Socket
            if (currentPeers) {
                Object.values(currentPeers).forEach((peerObj) => {
                    peerObj.peer.close();
                });
                peersRef.current = {};
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (currentSocket) {
                currentSocket.disconnect();
            }
            setPeers({});
            setPeersInfo({});
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conferenceId]);

    const setupSocketListeners = (localStream, isHostVal) => {
        // Other user joined -> We, as an existing user, create an Offer
        socketRef.current.on('user-connected', async ({ userId, socketId }) => {
            console.log('User connected, creating offer for:', socketId);
            const peer = createPeerConnection(socketId, localStream);
            peersRef.current[socketId] = { peer, socketId };

            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socketRef.current.emit('video-offer', {
                    target: socketId,
                    sdp: offer,
                    userInfo: { userName: user.name, isHost: isHostVal }
                });
            } catch (err) {
                console.error('Error creating offer', err);
            }
        });

        // Receive Offer -> Create Answer
        socketRef.current.on('video-offer', async ({ caller, sdp, userInfo }) => {
            console.log('Received video offer from:', caller);
            if (userInfo) {
                setPeersInfo(prev => ({ ...prev, [caller]: userInfo }));
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
                    userInfo: { userName: user.name, isHost: isHostVal }
                });
            } catch (err) {
                console.error('Error handling offer', err);
            }
        });

        // Receive Answer
        socketRef.current.on('video-answer', async ({ caller, sdp, userInfo }) => {
            console.log('Received video answer from:', caller);
            if (userInfo) {
                setPeersInfo(prev => ({ ...prev, [caller]: userInfo }));
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

        // Receive ICE Candidate
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

        // User Disconnected
        socketRef.current.on('user-disconnected', (socketId) => {
            console.log('User disconnected:', socketId);
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

        socketRef.current.on('user-media-status', ({ socketId, type, isMuted, isVideoOff }) => {
            setPeersInfo(prev => {
                const info = prev[socketId] || {};
                return {
                    ...prev,
                    [socketId]: {
                        ...info,
                        isMuted: type === 'audio' ? isMuted : info.isMuted,
                        isVideoOff: type === 'video' ? isVideoOff : info.isVideoOff
                    }
                };
            });
        });

        // Host triggered actions
        socketRef.current.on('trigger-mute-all', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.enabled) {
                    audioTrack.enabled = false;
                    setIsMuted(true);
                    // Note: To show a notification to the user, you'd add a toast here
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

        // Add our local stream tracks to the peer connection
        localStream.getTracks().forEach((track) => {
            peer.addTrack(track, localStream);
        });

        // Send ICE candidates to the other peer via socket
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('new-ice-candidate', {
                    target: targetSocketId,
                    candidate: event.candidate,
                });
            }
        };

        // Receive remote stream tracks
        peer.ontrack = (event) => {
            setPeers((prevPeers) => ({
                ...prevPeers,
                [targetSocketId]: event.streams[0],
            }));
        };

        return peer;
    };

    const toggleMute = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const newMuted = !audioTrack.enabled;
                setIsMuted(newMuted);
                socketRef.current.emit('user-media-status', { roomId: conferenceId, type: 'audio', isMuted: newMuted });
            }
        }
    };

    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const newVideoOff = !videoTrack.enabled;
                setIsVideoOff(newVideoOff);
                socketRef.current.emit('user-media-status', { roomId: conferenceId, type: 'video', isVideoOff: newVideoOff });
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(screen);
                const screenTrack = screen.getVideoTracks()[0];

                Object.values(peersRef.current).forEach((peerObj) => {
                    const sender = peerObj.peer.getSenders().find(s => s.track.kind === 'video');
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
                console.error("Error sharing screen", err);
            }
        } else {
            stopScreenSharing();
        }
    };

    const stopScreenSharing = () => {
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            setScreenStream(null);
        }
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            Object.values(peersRef.current).forEach((peerObj) => {
                const sender = peerObj.peer.getSenders().find(s => s.track.kind === 'video');
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
        navigate(`/conference/${conferenceId}`); // Redirect back to details page
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

    return (
        <div className="video-meeting-page" ref={containerRef}>
            <div className="video-meeting-header">
                <div className="video-meeting-header-left">
                    <h1>Live Session</h1>
                    <span className="live-clock">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="participants-count">
                    Participants: {1 + peersArray.length}
                </div>
            </div>

            <div className="video-grid">
                {/* Local Video */}
                <div className="video-container local-video-container">
                    <video
                        playsInline
                        muted
                        ref={localVideoRef}
                        autoPlay
                        className={`video-stream ${isVideoOff ? 'hidden' : ''}`}
                    />
                    {isVideoOff && (
                        <div className="video-off-placeholder">
                            <FaVideoSlash size={40} />
                        </div>
                    )}
                    <span className="video-label">You {isHost ? '(Host)' : ''} {isMuted && '(Muted)'}</span>
                </div>

                {/* Remote Videos */}
                {peersArray.map(([socketId, peerStream]) => (
                    <VideoPlayer
                        key={socketId}
                        stream={peerStream}
                        label={peersInfo[socketId]?.userName || 'Participant'}
                        isHost={peersInfo[socketId]?.isHost}
                        isMuted={peersInfo[socketId]?.isMuted}
                        isVideoOff={peersInfo[socketId]?.isVideoOff}
                    />
                ))}
            </div>

            <div className="video-controls">
                <button
                    className={`control-btn ${isMuted ? 'muted' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>
                <button
                    className={`control-btn ${isVideoOff ? 'muted' : ''}`}
                    onClick={toggleVideo}
                    title={isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
                >
                    {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
                </button>
                <button
                    className={`control-btn ${isScreenSharing ? 'sharing' : ''}`}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                    {isScreenSharing ? <FaStopCircle /> : <FaDesktop />}
                </button>
                <button
                    className="control-btn"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                >
                    {isFullscreen ? <FaCompress /> : <FaExpand />}
                </button>

                {isHost && (
                    <>
                        <button
                            className="control-btn host-action-btn"
                            onClick={() => socketRef.current.emit('mute-all-participants', conferenceId)}
                            title="Mute All Participants"
                        >
                            <FaUsers />
                        </button>
                    </>
                )}

                <button className="control-btn leave-btn" onClick={leaveMeeting} title="Leave Meeting">
                    <FaPhoneSlash /> <span>Leave</span>
                </button>

                {isHost && (
                    <button
                        className="control-btn leave-btn end-all-btn"
                        onClick={() => socketRef.current.emit('end-meeting-for-all', conferenceId)}
                        title="End Meeting for All"
                    >
                        <FaPowerOff /> <span>End for All</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// Sub-component for remote video streams
const VideoPlayer = ({ stream, label, isHost, isMuted, isVideoOff }) => {
    const ref = useRef();

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="video-container">
            <video playsInline autoPlay ref={ref} className={`video-stream ${isVideoOff ? 'hidden' : ''}`} />
            {isVideoOff && (
                <div className="video-off-placeholder">
                    <FaUser size={40} />
                </div>
            )}
            <span className="video-label">
                {label} {isHost && <span className="host-badge">Host</span>}
                <span className="media-status-icons">
                    {isMuted && <FaMicrophoneSlash className="status-icon" title="Muted" />}
                </span>
            </span>
        </div>
    );
};

export default VideoMeeting;
