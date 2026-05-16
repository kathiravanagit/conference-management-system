import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { registrationAPI, certificateAPI, attendanceAPI } from '../../utils/api';
import { formatDate, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './MyRegistrations.css';

const MyRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [certificates, setCertificates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMyRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const [registrationsResponse, certificatesResponse] = await Promise.all([
        registrationAPI.getMyRegistrations(),
        certificateAPI.getMyCertificates(),
      ]);
      setRegistrations(registrationsResponse.data.registrations || []);
      const certificateMap = (certificatesResponse.data.certificates || []).reduce(
        (acc, cert) => {
          if (cert.conferenceId?._id) {
            acc[cert.conferenceId._id] = cert;
          }
          return acc;
        },
        {}
      );
      setCertificates(certificateMap);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRegistrations();
  }, [fetchMyRegistrations]);

  const generateCertificate = async (registrationId) => {
    try {
      await certificateAPI.generateCertificate(registrationId);
      alert('Certificate generated successfully!');
      fetchMyRegistrations();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleCancel = async (registrationId) => {
    if (window.confirm('Are you sure you want to cancel this registration?')) {
      try {
        await registrationAPI.cancel(registrationId);
        alert('Registration cancelled');
        fetchMyRegistrations();
      } catch (err) {
        setError(handleApiError(err));
      }
    }
  };

  const handleMarkAttendance = async (registration) => {
    const ticketNumber = window.prompt('Enter your ticket number to mark attendance.');
    if (!ticketNumber) return;

    try {
      await attendanceAPI.markAttendance({
        registrationId: registration._id,
        ticketNumber,
      });
      alert('Attendance marked successfully.');
      fetchMyRegistrations();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="my-registrations">
      <div className="registrations-container">
        <h1>My Conference Registrations</h1>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        {registrations.length === 0 ? (
          <div className="empty-state">
            <p>You haven't registered for any conferences yet</p>
          </div>
        ) : (
          <div className="registrations-list">
            {registrations.map((reg) => (
              <div key={reg._id} className="registration-card">
                <div className="registration-header">
                  <h3>{reg.conferenceId?.title}</h3>
                  <span className={`status ${reg.status}`}>{reg.status}</span>
                </div>

                <div className="registration-details">
                  <p><strong>Date:</strong> {formatDate(reg.conferenceId?.date)}</p>
                  <p><strong>Speaker:</strong> {reg.conferenceId?.speaker?.name}</p>
                  <p><strong>Ticket:</strong> {reg.ticketNumber}</p>
                </div>

                <div className="registration-actions">
                  <Link
                    to={`/qr/${reg._id}`}
                    className="btn-join"
                  >
                    Show QR Code
                  </Link>

                  <Link
                    to={`/conference/${reg.conferenceId?._id}/meeting`}
                    className="btn-join"
                  >
                    Join Live Session
                  </Link>

                  {!reg.attendanceStatus && reg.status === 'registered' && (
                    <button
                      onClick={() => handleMarkAttendance(reg)}
                      className="btn-generate-cert"
                    >
                      Mark Attendance
                    </button>
                  )}

                  {reg.attendanceStatus && !reg.certificateGenerated && (
                    <button
                      onClick={() => generateCertificate(reg._id)}
                      className="btn-generate-cert"
                    >
                      Generate Certificate
                    </button>
                  )}

                  {reg.certificateGenerated && certificates[reg.conferenceId?._id] && (
                    <Link
                      to={`/certificate/${certificates[reg.conferenceId._id]._id}`}
                      className="btn-generate-cert"
                    >
                      View Certificate
                    </Link>
                  )}

                  {reg.status !== 'attended' && (
                    <button
                      onClick={() => handleCancel(reg._id)}
                      className="btn-cancel"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRegistrations;
