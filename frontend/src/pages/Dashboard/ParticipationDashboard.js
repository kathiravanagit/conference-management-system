import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDate, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './ParticipationDashboard.css';

const ParticipationDashboard = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [certificates, setCertificates] = useState({});
  const [stats, setStats] = useState({
    totalRegistered: 0,
    totalAttended: 0,
    totalCertificates: 0,
    currentPoints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, registered, attended, certified
  const [feedbackForm, setFeedbackForm] = useState({}); // { [conferenceId]: { rating, comment, submitted } }

  const fetchParticipationData = useCallback(async () => {
    try {
      setLoading(true);
      const [regsResponse, certsResponse, profileResponse] = await Promise.all([
        axios.get('/api/registrations/my'),
        axios.get('/api/certificates/my'),
        axios.get('/api/auth/me'),
      ]);

      const registrations = regsResponse.data.registrations || [];
      const certificates = certsResponse.data.certificates || [];

      setRegistrations(registrations);

      // Create certificate map
      const certMap = {};
      certificates.forEach((cert) => {
        certMap[cert.conferenceId?._id] = cert;
      });
      setCertificates(certMap);

      // Calculate statistics
      const stats = {
        totalRegistered: registrations.length,
        totalAttended: registrations.filter((r) => r.status === 'attended').length,
        totalCertificates: certificates.length,
        currentPoints: profileResponse.data.user?.participationCount || 0,
      };
      setStats(stats);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipationData();
  }, [fetchParticipationData]);

  const getFilteredRegistrations = () => {
    switch (filter) {
      case 'registered':
        return registrations.filter((r) => r.status === 'registered');
      case 'attended':
        return registrations.filter((r) => r.status === 'attended');
      case 'certified':
        return registrations.filter((r) => certificates[r.conferenceId?._id]);
      default:
        return registrations;
    }
  };

  const getStatusBadge = (registration) => {
    if (certificates[registration.conferenceId?._id]) {
      return <span className="badge badge-certified">Certified</span>;
    }
    if (registration.status === 'attended') {
      return <span className="badge badge-attended">Attended</span>;
    }
    if (registration.status === 'registered') {
      return <span className="badge badge-registered">Registered</span>;
    }
    if (registration.status === 'waitlisted') {
      return <span className="badge badge-waitlisted">Waitlisted</span>;
    }
    return <span className="badge badge-cancelled">Cancelled</span>;
  };

  const handleFeedbackSubmit = async (conferenceId) => {
    const f = feedbackForm[conferenceId];
    if (!f?.rating) return;
    try {
      await axios.post('/api/feedback', {
        conferenceId,
        rating: f.rating,
        comment: f.comment || '',
      });
      setFeedbackForm((prev) => ({
        ...prev,
        [conferenceId]: { ...prev[conferenceId], submitted: true },
      }));
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const getProgressPercentage = () => {
    if (stats.totalRegistered === 0) return 0;
    return Math.round((stats.totalAttended / stats.totalRegistered) * 100);
  };

  if (loading) return <Loading />;

  const filteredRegistrations = getFilteredRegistrations();

  return (
    <div className="participation-dashboard">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Your Participation Dashboard</h1>
          <p className="subtitle">Track your conference attendance and certificates</p>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon--reg">▤</div>
            <div className="stat-content">
              <p className="stat-label">Registered For</p>
              <p className="stat-number">{stats.totalRegistered}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon--att">✓</div>
            <div className="stat-content">
              <p className="stat-label">Attended</p>
              <p className="stat-number">{stats.totalAttended}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon--cert">◈</div>
            <div className="stat-content">
              <p className="stat-label">Certificates</p>
              <p className="stat-number">{stats.totalCertificates}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon--pts">◆</div>
            <div className="stat-content">
              <p className="stat-label">Points</p>
              <p className="stat-number">{stats.currentPoints}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-header">
            <span>Attendance Progress</span>
            <span className="progress-percentage">{getProgressPercentage()}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
          <p className="progress-text">
            You've attended {stats.totalAttended} out of {stats.totalRegistered}{' '}
            registered conferences
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Registrations ({registrations.length})
          </button>
          <button
            className={`filter-tab ${filter === 'registered' ? 'active' : ''}`}
            onClick={() => setFilter('registered')}
          >
            Registered (
            {registrations.filter((r) => r.status === 'registered').length})
          </button>
          <button
            className={`filter-tab ${filter === 'attended' ? 'active' : ''}`}
            onClick={() => setFilter('attended')}
          >
            Attended ({stats.totalAttended})
          </button>
          <button
            className={`filter-tab ${filter === 'certified' ? 'active' : ''}`}
            onClick={() => setFilter('certified')}
          >
            Certified ({stats.totalCertificates})
          </button>
        </div>

        {/* Registrations List */}
        {filteredRegistrations.length === 0 ? (
          <div className="empty-state">
            <p>No registrations to show</p>
            <button
              onClick={() => navigate('/conferences')}
              className="btn"
              style={{ marginTop: '20px' }}
            >
              Browse Conferences
            </button>
          </div>
        ) : (
          <div className="registrations-list">
            {filteredRegistrations.map((reg) => (
              <div key={reg._id} className="participation-card">
                <div className="card-header">
                  <h3>{reg.conferenceId?.title}</h3>
                  {getStatusBadge(reg)}
                </div>

                <div className="card-details">
                  <div className="detail-row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(reg.conferenceId?.date)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Speaker:</span>
                    <span className="value">{reg.conferenceId?.speaker?.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Ticket:</span>
                    <span className="value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {reg.ticketNumber}
                    </span>
                  </div>

                  {reg.status === 'attended' && (
                    <div className="detail-row">
                      <span className="label">Attended At:</span>
                      <span className="value">{formatDate(reg.attendanceTime)}</span>
                    </div>
                  )}

                  {certificates[reg.conferenceId?._id] && (
                    <div className="detail-row">
                      <span className="label">Certificate #:</span>
                      <span className="value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {certificates[reg.conferenceId._id].certificateNumber}
                      </span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    onClick={() => navigate(`/qr/${reg._id}`)}
                    className="action-btn action-qr"
                  >
                    Show QR
                  </button>

                  {reg.status === 'attended' && certificates[reg.conferenceId?._id] && (
                    <button
                      onClick={() =>
                        navigate(`/certificate/${certificates[reg.conferenceId._id]._id}`)
                      }
                      className="action-btn action-cert"
                    >
                      View Certificate
                    </button>
                  )}

                  {reg.status === 'registered' && (
                    <button
                      onClick={() => navigate(`/qr/${reg._id}`)}
                      className="action-btn action-attend"
                    >
                      Attend Now
                    </button>
                  )}

                  {/* Inline feedback for attended conferences */}
                  {reg.status === 'attended' && !feedbackForm[reg.conferenceId?._id]?.submitted && (
                    <div className="feedback-inline">
                      <p className="feedback-label">Rate this conference:</p>
                      <div className="star-row">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            className={`star-btn ${(feedbackForm[reg.conferenceId._id]?.rating || 0) >= star ? 'star-filled' : ''
                              }`}
                            onClick={() =>
                              setFeedbackForm((prev) => ({
                                ...prev,
                                [reg.conferenceId._id]: {
                                  ...prev[reg.conferenceId._id],
                                  rating: star,
                                },
                              }))
                            }
                          >&#9733;</button>
                        ))}
                      </div>
                      <textarea
                        className="feedback-comment"
                        placeholder="Comment (optional)"
                        rows={2}
                        value={feedbackForm[reg.conferenceId._id]?.comment || ''}
                        onChange={(e) =>
                          setFeedbackForm((prev) => ({
                            ...prev,
                            [reg.conferenceId._id]: {
                              ...prev[reg.conferenceId._id],
                              comment: e.target.value,
                            },
                          }))
                        }
                      />
                      <button
                        className="action-btn action-attend"
                        onClick={() => handleFeedbackSubmit(reg.conferenceId._id)}
                        disabled={!feedbackForm[reg.conferenceId._id]?.rating}
                      >Submit Feedback</button>
                    </div>
                  )}

                  {feedbackForm[reg.conferenceId?._id]?.submitted && (
                    <p className="feedback-done">Feedback submitted. Thank you!</p>
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

export default ParticipationDashboard;
