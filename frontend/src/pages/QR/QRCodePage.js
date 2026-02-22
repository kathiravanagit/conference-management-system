import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { formatDate, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './QRCodePage.css';

const QRCodePage = () => {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState(null);
  const [conference, setConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReg = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/registrations/my');
      const reg = response.data.registrations?.find((r) => r._id === registrationId);
      if (!reg) {
        setError('Registration not found');
        return;
      }
      setRegistration(reg);
      setConference(reg.conferenceId);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    fetchReg();
  }, [fetchReg]);

  const downloadQRCode = () => {
    const element = document.getElementById('qrcode');
    const canvas = element.querySelector('canvas');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-qr-${registration?.ticketNumber}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printQRCode = () => {
    window.print();
  };

  if (loading) return <Loading />;

  if (!registration || !conference) {
    return (
      <div className="qr-container">
        <ErrorMessage message={error || 'Registration details not found'} />
        <button onClick={() => navigate('/my-registrations')} className="btn">
          Back to My Registrations
        </button>
      </div>
    );
  }

  const qrData = JSON.stringify({
    registrationId: registration._id,
    ticketNumber: registration.ticketNumber,
    userId: registration.userId,
    studentName: registration.userId?.name || 'Unknown',
    department: registration.conferenceId?.department || '',
  });

  return (
    <div className="qr-container">
      <div className="qr-card">
        <h2>Your Attendance QR Code</h2>

        <div className="qr-conference-info">
          <div className="info-row">
            <span className="label">Conference:</span>
            <span className="value">{conference.title}</span>
          </div>
          <div className="info-row">
            <span className="label">Date:</span>
            <span className="value">{formatDate(conference.date)}</span>
          </div>
          <div className="info-row">
            <span className="label">Ticket Number:</span>
            <span className="value" style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              {registration.ticketNumber}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Status:</span>
            <span className={`status status-${registration.status}`}>
              {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
            </span>
          </div>
        </div>

        <div className="qr-code-section">
          <p className="qr-instruction">
            Show this QR code at the conference entrance. Staff will scan it to mark your attendance.
          </p>
          <div id="qrcode" className="qr-code-wrapper">
            <QRCodeCanvas
              value={qrData}
              size={300}
              level="H"
              includeMargin={true}
            />
          </div>
        </div>

        <div className="qr-actions">
          <button onClick={downloadQRCode} className="btn btn-secondary">
            Download QR Code
          </button>
          <button onClick={printQRCode} className="btn btn-secondary">
            Print
          </button>
        </div>

        <div className="qr-info-box">
          <h4>Important Information</h4>
          <ul>
            <li>Keep this QR code safe until the conference date</li>
            <li>You can view it anytime from your registrations</li>
            <li>Only one person can use this QR code (your ticket number)</li>
            <li>Your attendance will be marked when staff scans this code</li>
          </ul>
        </div>

        <div className="qr-navigation">
          <button onClick={() => navigate('/my-registrations')} className="btn">
            Back to My Registrations
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodePage;
