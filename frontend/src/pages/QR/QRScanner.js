import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDate, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './QRScanner.css';

const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '/api';

const QRScanner = () => {
  const { conferenceId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conference, setConference] = useState(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [manualTicket, setManualTicket] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [lastScanned, setLastScanned] = useState(null); // stores rich student info
  const streamRef = useRef(null);

  // Dynamically import jsQR
  const [jsQR, setJsQR] = useState(null);

  // Define all callbacks first, before useEffect
  const fetchConfDetails = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/conferences/${conferenceId}`);
      setConference(response.data.data);
    } catch (err) {
      setError('Failed to fetch conference details');
    } finally {
      setLoading(false);
    }
  }, [conferenceId]);

  const handleQRScanned = useCallback(async (qrData) => {
    try {
      setScanning(false);
      setSuccess('');
      setError('');

      await axios.post(`${API_URL}/attendance/mark`, {
        registrationId: qrData.registrationId,
        ticketNumber: qrData.ticketNumber,
      });

      setLastScanned({
        name: qrData.studentName || 'Student',
        department: qrData.department || '—',
        ticket: qrData.ticketNumber,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setSuccess(`Attendance marked for ticket ${qrData.ticketNumber}`);
      setScannedCount((prev) => prev + 1);

      // Resume scanning after 3 seconds
      setTimeout(() => {
        setScanning(true);
        setLastScanned(null);
      }, 3500);
    } catch (err) {
      setError(handleApiError(err));
      setScanning(true);
    }
  }, []);

  const startScanning = useCallback(() => {
    if (!jsQR || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const scanInterval = setInterval(() => {
      if (!scanning) {
        clearInterval(scanInterval);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (code && code.data) {
        try {
          const qrData = JSON.parse(code.data);
          handleQRScanned(qrData);
          clearInterval(scanInterval);
        } catch (e) {
          // Not a valid JSON QR code, continue scanning
        }
      }
    }, 100);
  }, [jsQR, scanning, handleQRScanned]);

  const initScanner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions and try again.');
      setScanning(false);
    }
  }, []);

  // useEffect that loads jsQR library
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => {
      setJsQR(() => window.jsQR);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // useEffect to initialize scanner when jsQR loads
  useEffect(() => {
    if (jsQR) {
      initScanner();
    }
  }, [jsQR, initScanner]);

  // useEffect to start scanning when video is ready
  useEffect(() => {
    if (jsQR && videoRef.current && videoRef.current.readyState === 4) {
      startScanning();
    }
  }, [jsQR, startScanning]);

  // useEffect to fetch conference details
  useEffect(() => {
    fetchConfDetails();
  }, [fetchConfDetails]);

  const handleManualEntry = async () => {
    if (!manualTicket) {
      setError('Please enter a ticket number');
      return;
    }

    try {
      const registrations = await axios.get(`${API_URL}/registrations/my`);
      const registration = registrations.data.registrations?.find(
        (r) => r.ticketNumber === manualTicket && r.conferenceId._id === conferenceId
      );

      if (!registration) {
        setError('Ticket number not found for this conference');
        return;
      }

      await handleQRScanned({
        registrationId: registration._id,
        ticketNumber: registration.ticketNumber,
      });
      setManualTicket('');
      setShowManualEntry(false);
    } catch (err) {
      setError('Failed to mark attendance');
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!conference) {
    return (
      <div className="scanner-container">
        <ErrorMessage message={error || 'Conference not found'} />
        <button onClick={() => navigate('/conferences')} className="btn">
          Back to Conferences
        </button>
      </div>
    );
  }

  return (
    <div className="scanner-container">
      <div className="scanner-header">
        <h2>QR Code Attendance Scanner</h2>
        <div className="conference-header">
          <p className="conference-name">{conference.title}</p>
          <p className="conference-date">{formatDate(conference.date)}</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {success && (
        <div className="success-message">
          {lastScanned ? (
            <div className="scanned-info">
              <div className="scanned-check">&#10003;</div>
              <div className="scanned-details">
                <p className="scanned-name">{lastScanned.name}</p>
                <p className="scanned-meta">{lastScanned.department} &nbsp;|&nbsp; {lastScanned.ticket}</p>
                <p className="scanned-time">Marked at {lastScanned.time}</p>
              </div>
            </div>
          ) : (
            success
          )}
        </div>
      )}

      <div className="scanner-content">
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="scanner-video"
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className={`scanner-overlay ${scanning ? 'active' : 'inactive'}`}>
            {scanning ? (
              <>
                <div className="scan-frame"></div>
                <p className="scan-text">Position QR code within frame</p>
              </>
            ) : (
              <p className="processing-text">Processing...</p>
            )}
          </div>
        </div>

        <div className="scanner-stats">
          <div className="stat">
            <span className="stat-label">Scanned Today</span>
            <span className="stat-value">{scannedCount}</span>
          </div>
        </div>

        <div className="scanner-controls">
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="btn btn-secondary"
          >
            {showManualEntry ? 'Close Manual Entry' : 'Manual Entry'}
          </button>
        </div>

        {showManualEntry && (
          <div className="manual-entry">
            <div className="manual-form">
              <label>Enter Ticket Number:</label>
              <input
                type="text"
                value={manualTicket}
                onChange={(e) => setManualTicket(e.target.value.toUpperCase())}
                placeholder="e.g., CONF-20240115-001"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualEntry();
                  }
                }}
              />
              <button onClick={handleManualEntry} className="btn">
                Mark Attendance
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/conferences')}
          className="btn btn-back"
        >
          Back to Conferences
        </button>
      </div>
    </div>
  );
};

export default QRScanner;
