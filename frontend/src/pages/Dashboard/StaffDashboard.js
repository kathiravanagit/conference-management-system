import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  certificateAPI,
  qaAPI,
  staffAPI,
  conferenceAPI,
  attendanceAPI,
} from '../../utils/api';
import ErrorMessage from '../../components/ui/ErrorMessage';
import Loading from '../../components/ui/Loading';
import { formatDate, formatTime, handleApiError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import './StaffDashboard.css';

const StaffDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [conferences, setConferences] = useState([]);
  const [upcomingConferences, setUpcomingConferences] = useState([]);
  const [ongoingConferences, setOngoingConferences] = useState([]);
  const [completedConferences, setCompletedConferences] = useState([]);
  const [topParticipants, setTopParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopyMessage, setInviteCopyMessage] = useState('');
  const { user } = useAuth();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dashboardData = await staffAPI.getDashboard();
      const data = dashboardData.data || dashboardData;
      setDashboard(data);
      setConferences(data.recentConferences || []);
      setUpcomingConferences(data.upcomingConferences || []);
      setOngoingConferences(data.ongoingConferences || []);

      // Load top participants from analytics
      try {
        const analyticsRes = await import('../../utils/api').then((m) => m.analyticsAPI.getUserParticipation({ limit: 5 }));
        setTopParticipants(analyticsRes.data?.data || []);
      } catch (analyticsError) {
        console.error('Failed to load analytics:', analyticsError);
      }
    } catch (err) {
      setError('Failed to load dashboard: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompletedConferences = useCallback(async () => {
    try {
      const res = await conferenceAPI.getCompleted();
      const data = res.data;
      if (data.success) setCompletedConferences(data.completedConferences || []);
    } catch (err) {
      // silently ignore — not critical
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (user?._id) loadCompletedConferences();
  }, [user?._id, loadCompletedConferences]);

  const [conferenceForm, setConferenceForm] = useState({
    title: '',
    description: '',
    date: '',
    endDate: '',
    registrationDeadline: '',
    speakerName: '',
    speakerDesignation: '',
    speakerEmail: '',
    speakerBio: '',
    speakerLinkedIn: '',
    department: 'ALL',
    maxAttendees: 500,
    enableCertificates: false,
    enableQA: true,
    meetingPassword: '',
    allowParticipantScreenShare: true,
    agenda: '',          // comma-separated: "9:00 Opening, 10:00 Keynote"
  });
  const [uploadConferenceId, setUploadConferenceId] = useState('');
  const [conferenceRegistrations, setConferenceRegistrations] = useState([]);
  const [uploadUserId, setUploadUserId] = useState('');
  const [certificateFile, setCertificateFile] = useState(null);
  const [qaConferenceId, setQaConferenceId] = useState('');
  const [qaMessages, setQaMessages] = useState([]);

  // Check if the current user is the creator of a conference
  const isCreator = (conference) => {
    const creatorId = conference.createdBy?._id || conference.createdBy;
    return user && creatorId && creatorId.toString() === user._id?.toString();
  };

  const handleCertificateUpload = async (event) => {
    event.preventDefault();
    if (!uploadConferenceId || !uploadUserId || !certificateFile) {
      setError('Select conference, user, and certificate file.');
      return;
    }

    const formData = new FormData();
    formData.append('conferenceId', uploadConferenceId);
    formData.append('userId', uploadUserId);
    formData.append('certificate', certificateFile);

    try {
      await certificateAPI.uploadCertificate(formData);
      setSuccess('Certificate uploaded successfully.');
      setUploadUserId('');
      setCertificateFile(null);
      await loadDashboard();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await qaAPI.deleteMessage(messageId);
      setQaMessages((prev) => prev.filter((message) => message._id !== messageId));
      setSuccess('Q&A message removed.');
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDeleteConference = async (id) => {
    if (!window.confirm('Are you sure you want to delete this conference?')) return;
    try {
      await conferenceAPI.delete(id);
      setSuccess('Conference deleted successfully.');
      await loadDashboard();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleExportCsv = async (conferenceId, title) => {
    try {
      const response = await attendanceAPI.exportAttendance(conferenceId);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_attendance.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export attendance CSV.');
    }
  };

  const handleConferenceCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');
    setInviteCopyMessage('');

    if (!conferenceForm.endDate) {
      setError('Please provide an end date/time.');
      return;
    }

    if (new Date(conferenceForm.endDate) <= new Date(conferenceForm.date)) {
      setError('End date/time must be after start date/time.');
      return;
    }

    try {
      const agendaItems = conferenceForm.agenda
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [time, ...rest] = line.split(' ');
          return { time: time || '', activity: rest.join(' ') || line };
        });

      const payload = {
        title: conferenceForm.title,
        description: conferenceForm.description,
        date: new Date(conferenceForm.date).toISOString(),
        endDate: new Date(conferenceForm.endDate).toISOString(),
        registrationDeadline: conferenceForm.registrationDeadline ? new Date(conferenceForm.registrationDeadline).toISOString() : undefined,
        department: conferenceForm.department,
        maxAttendees: conferenceForm.maxAttendees,
        enableCertificates: conferenceForm.enableCertificates,
        enableQA: conferenceForm.enableQA,
        meetingPassword: conferenceForm.meetingPassword || undefined,
        allowParticipantScreenShare: conferenceForm.allowParticipantScreenShare,
        schedule: agendaItems,
        speaker: {
          name: conferenceForm.speakerName,
          designation: conferenceForm.speakerDesignation,
          email: conferenceForm.speakerEmail,
          bio: conferenceForm.speakerBio,
          linkedin: conferenceForm.speakerLinkedIn,
        },
      };

      const createResponse = await conferenceAPI.create(payload);
      const createdConference = createResponse?.data?.conference;
      if (createdConference?._id) {
        const inviteUrl = new URL(`/conference/${createdConference._id}/meeting`, window.location.origin);
        if (conferenceForm.meetingPassword) {
          inviteUrl.searchParams.set('pwd', conferenceForm.meetingPassword);
        }
        setInviteLink(inviteUrl.toString());
      }

      setSuccess('Conference created successfully.');
      setConferenceForm({
        title: '',
        description: '',
        date: '',
        endDate: '',
        registrationDeadline: '',
        speakerName: '',
        speakerDesignation: '',
        speakerEmail: '',
        speakerBio: '',
        speakerLinkedIn: '',
        department: 'ALL',
        maxAttendees: 500,
        enableCertificates: false,
        enableQA: true,
        meetingPassword: '',
        allowParticipantScreenShare: true,
        agenda: '',
      });
      await loadDashboard();
      setSuccess('Conference created successfully. Participants can join from the Join button when the session starts.');
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopyMessage('Invite link copied.');
    } catch (_) {
      setInviteCopyMessage('Copy failed. Please copy manually.');
    }
  };

  const handleConferenceForUpload = async (id) => {
    setUploadConferenceId(id);
    if (!id) {
      setConferenceRegistrations([]);
      return;
    }
    try {
      const response = await import('../../utils/api').then((m) => m.registrationAPI.getConferenceRegistrations(id));
      setConferenceRegistrations(response.data?.data || response.data?.registrations || []);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleLoadQaMessages = async (confId) => {
    setQaConferenceId(confId);
    if (!confId) {
      setQaMessages([]);
      return;
    }
    try {
      const response = await qaAPI.getMessages(confId);
      setQaMessages(response.data?.messages || []);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) {
    return <Loading message="Loading staff dashboard..." />;
  }

  return (
    <div className="staff-dashboard">
      <div className="staff-dashboard-container">
        <div className="staff-dashboard-header">
          <h1>Staff Dashboard</h1>
          <p>Manage conferences, meetings, certificates, Q&A, and view analytics from one place.</p>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}
        {success && <p className="staff-success">{success}</p>}
        {inviteLink && (
          <div className="staff-invite-box">
            <h3>Shareable Join Link</h3>
            <p>Participants can open this link, create/login account, and join with prefilled password.</p>
            <div className="staff-invite-row">
              <input type="text" value={inviteLink} readOnly aria-label="Shareable conference invite link" />
              <button type="button" className="btn btn-primary" onClick={handleCopyInviteLink}>
                Copy Link
              </button>
            </div>
            {inviteCopyMessage && <span className="staff-invite-copy-status">{inviteCopyMessage}</span>}
          </div>
        )}

        <section className="staff-stats-grid">
          {/* Ongoing Conferences Section */}
          <section className="staff-card">
            <h2>Ongoing Conferences</h2>
            <div className="conf-card-list">
              {ongoingConferences.length === 0 ? (
                <p className="conf-empty">No ongoing conferences right now.</p>
              ) : (
                ongoingConferences.map((conf) => (
                  <div className="conf-row" key={conf._id}>
                    <div className="conf-row-main">
                      <span className="conf-row-title">{conf.title}</span>
                      <span className="status-badge ongoing">Ongoing</span>
                    </div>
                    <div className="conf-row-meta">
                      <span>{formatDate(conf.date)}</span>
                      <span>{formatTime(conf.date)}{conf.endDate && <> – {formatTime(conf.endDate)}</>}</span>
                      <span className="conf-dept-pill">{conf.department}</span>
                      <span>Registrations: {conf.registrationCount ?? conf.attendeeCount ?? 0}</span>
                    </div>
                    <div className="action-btns">
                      {isCreator(conf) ? (
                        <>
                          {['ongoing', 'upcoming'].includes(conf.status) && (
                            <Link
                              className="action-btn action-join"
                              to={`/conference/${conf._id}/meeting`}
                            >
                              Join
                            </Link>
                          )}
                          <Link to={`/conference/${conf._id}`} className="action-btn action-view">View</Link>
                          <button
                            className="action-btn action-view"
                            onClick={() => handleExportCsv(conf._id, conf.title)}
                          >
                            Export CSV
                          </button>
                          <button
                            className="action-btn action-delete"
                            onClick={() => handleDeleteConference(conf._id)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <Link to={`/conference/${conf._id}`} className="action-btn action-view">View</Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Upcoming Conferences Section */}
          <section className="staff-card">
            <h2>Upcoming Conferences</h2>
            <div className="conf-card-list">
              {upcomingConferences.length === 0 ? (
                <p className="conf-empty">No upcoming conferences found.</p>
              ) : (
                upcomingConferences.map((conf) => (
                  <div className="conf-row" key={conf._id}>
                    <div className="conf-row-main">
                      <span className="conf-row-title">{conf.title}</span>
                      <span className="status-badge upcoming">Upcoming</span>
                    </div>
                    <div className="conf-row-meta">
                      <span>{formatDate(conf.date)}</span>
                      <span>{formatTime(conf.date)}{conf.endDate && <> – {formatTime(conf.endDate)}</>}</span>
                      <span className="conf-dept-pill">{conf.department}</span>
                      <span>Registrations: {conf.registrationCount ?? conf.attendeeCount ?? 0}</span>
                    </div>
                    <div className="action-btns">
                      {isCreator(conf) ? (
                        <>
                          <Link to={`/conference/${conf._id}`} className="action-btn action-view">View</Link>
                          <button
                            className="action-btn action-delete"
                            onClick={() => handleDeleteConference(conf._id)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <Link to={`/conference/${conf._id}`} className="action-btn action-view">View</Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Completed Conferences Section — only mine */}
          {completedConferences.length > 0 && (
            <section className="staff-card">
              <h2>My Completed Conferences</h2>
              <div className="conf-card-list">
                {completedConferences.map((conf) => (
                  <div className="conf-row" key={conf._id}>
                    <div className="conf-row-main">
                      <span className="conf-row-title">{conf.title}</span>
                      <span className="status-badge completed">Completed</span>
                    </div>
                    <div className="conf-row-meta">
                      <span>{formatDate(conf.date)}</span>
                      {conf.endDate && <span>– {formatDate(conf.endDate)}</span>}
                      <span className="conf-dept-pill">{conf.department}</span>
                      <span>Registrations: {conf.registrationCount ?? conf.attendeeCount ?? 0}</span>
                    </div>
                    <div className="action-btns" style={{ marginTop: '0.8rem' }}>
                      <button
                        className="action-btn action-view"
                        onClick={() => handleExportCsv(conf._id, conf.title)}
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stats Cards */}
          <div className="staff-stat-card">
            <h3>Total Conferences</h3>
            <p>{dashboard?.stats?.totalConferences || 0}</p>
          </div>
          <div className="staff-stat-card">
            <h3>Ongoing</h3>
            <p>{dashboard?.stats?.ongoingCount || 0}</p>
          </div>
          <div className="staff-stat-card">
            <h3>Registrations</h3>
            <p>{dashboard?.stats?.registrationsCount || 0}</p>
          </div>
          <div className="staff-stat-card">
            <h3>Certificates</h3>
            <p>{dashboard?.stats?.certificatesCount || 0}</p>
          </div>
        </section>

        {/* Current Ongoing Conference highlight */}
        <section className="staff-card">
          <h2>Current Ongoing Conference</h2>
          {dashboard?.ongoingConference ? (
            <div className="ongoing-card">
              <div>
                <h3>{dashboard.ongoingConference.title}</h3>
                <p>{formatDate(dashboard.ongoingConference.date)}</p>
                <p>
                  {formatTime(dashboard.ongoingConference.date)}
                  {dashboard.ongoingConference.endDate && <> – {formatTime(dashboard.ongoingConference.endDate)}</>}
                </p>
                <p>{dashboard.ongoingConference.department} Department</p>
              </div>
              <Link
                className="btn btn-primary"
                to={`/conference/${dashboard.ongoingConference._id}/meeting`}
              >
                Join Live Session
              </Link>
            </div>
          ) : (
            <p>No ongoing conference right now. Upcoming events are shown above.</p>
          )}
        </section>

        <div className="staff-grid-two">
          {/* Create Conference Form */}
          <section className="staff-card">
            <h2>Create Conference</h2>
            <form className="staff-form" onSubmit={handleConferenceCreate}>
              <input
                type="text"
                placeholder="Conference title"
                value={conferenceForm.title}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
              <textarea
                placeholder="Description"
                value={conferenceForm.description}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                required
              />

              {/* Start and End DateTime side by side */}
              <div className="datetime-group">
                <div className="datetime-field">
                  <label>Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={conferenceForm.date}
                    onChange={(event) =>
                      setConferenceForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="datetime-field">
                  <label>End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={conferenceForm.endDate}
                    onChange={(event) =>
                      setConferenceForm((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Registration Deadline */}
              <div className="datetime-field" style={{ marginBottom: '0.8rem' }}>
                <label>Registration Deadline (optional)</label>
                <input
                  type="datetime-local"
                  value={conferenceForm.registrationDeadline}
                  onChange={(event) =>
                    setConferenceForm((prev) => ({ ...prev, registrationDeadline: event.target.value }))
                  }
                />
              </div>

              <input
                type="text"
                placeholder="Speaker name"
                value={conferenceForm.speakerName}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, speakerName: event.target.value }))
                }
                required
              />
              <input
                type="text"
                placeholder="Speaker designation"
                value={conferenceForm.speakerDesignation}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, speakerDesignation: event.target.value }))
                }
              />
              <input
                type="email"
                placeholder="Speaker email"
                value={conferenceForm.speakerEmail}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, speakerEmail: event.target.value }))
                }
              />
              <textarea
                placeholder="Speaker bio (optional)"
                value={conferenceForm.speakerBio}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, speakerBio: event.target.value }))
                }
                rows={2}
              />
              <input
                type="url"
                placeholder="Speaker LinkedIn URL (optional)"
                value={conferenceForm.speakerLinkedIn}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, speakerLinkedIn: event.target.value }))
                }
              />
              <select
                value={conferenceForm.department}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, department: event.target.value }))
                }
              >
                <option value="ALL">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="MECH">MECH</option>
                <option value="AIML">AIML</option>
                <option value="EEE">EEE</option>
                <option value="FT">FT</option>
                <option value="IT">IT</option>
              </select>
              <input
                type="number"
                min="1"
                placeholder="Max attendees"
                value={conferenceForm.maxAttendees}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, maxAttendees: event.target.value }))
                }
              />

              <input
                type="text"
                placeholder="Meeting password (required for participants)"
                value={conferenceForm.meetingPassword}
                onChange={(event) =>
                  setConferenceForm((prev) => ({ ...prev, meetingPassword: event.target.value }))
                }
                required
                minLength={4}
              />

              {/* Agenda / Schedule */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--ink-600)', display: 'block', marginBottom: '0.3rem' }}>
                  Schedule / Agenda (one line per slot: <em>09:00 Opening Ceremony</em>)
                </label>
                <textarea
                  placeholder={`09:00 Opening Ceremony\n10:00 Keynote Address\n11:30 Q&A Session`}
                  value={conferenceForm.agenda}
                  onChange={(event) =>
                    setConferenceForm((prev) => ({ ...prev, agenda: event.target.value }))
                  }
                  rows={4}
                />
              </div>

              {/* Certificate & QA toggles */}
              <div className="toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={conferenceForm.enableCertificates}
                    onChange={(event) =>
                      setConferenceForm((prev) => ({ ...prev, enableCertificates: event.target.checked }))
                    }
                  />
                  <span>Enable Certificates (auto-generated on attendance)</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={conferenceForm.enableQA}
                    onChange={(event) =>
                      setConferenceForm((prev) => ({ ...prev, enableQA: event.target.checked }))
                    }
                  />
                  <span>Enable Q&A</span>
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={conferenceForm.allowParticipantScreenShare}
                    onChange={(event) =>
                      setConferenceForm((prev) => ({ ...prev, allowParticipantScreenShare: event.target.checked }))
                    }
                  />
                  <span>Allow participants to share screen</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary">Create Conference</button>
            </form>
          </section>

          <section className="staff-card">
            <h2 className="staff-subtitle">Upload User Certificate</h2>
            <form className="staff-form" onSubmit={handleCertificateUpload}>
              <select
                value={uploadConferenceId}
                onChange={(event) => handleConferenceForUpload(event.target.value)}
                required
              >
                <option value="">Select conference</option>
                {conferences.map((conference) => (
                  <option key={conference._id} value={conference._id}>
                    {conference.title}
                  </option>
                ))}
              </select>

              <select
                value={uploadUserId}
                onChange={(event) => setUploadUserId(event.target.value)}
                disabled={!uploadConferenceId}
                required
              >
                <option value="">Select registered student</option>
                {conferenceRegistrations.map((registration) => (
                  <option key={registration._id} value={registration.userId?._id}>
                    {registration.userId?.name} ({registration.userId?.email})
                  </option>
                ))}
              </select>

              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setCertificateFile(event.target.files?.[0] || null)}
                required
              />

              <button type="submit" className="btn btn-primary">Upload Certificate</button>
            </form>
          </section>
        </div>

        <div className="staff-grid-two">
          <section className="staff-card">
            <h2>Q&A Moderation</h2>
            <select
              value={qaConferenceId}
              onChange={(event) => handleLoadQaMessages(event.target.value)}
              className="staff-select"
            >
              <option value="">Select conference</option>
              {conferences.map((conference) => (
                <option key={conference._id} value={conference._id}>
                  {conference.title}
                </option>
              ))}
            </select>

            <div className="qa-list">
              {qaMessages.length === 0 ? (
                <p>No Q&A messages for this conference.</p>
              ) : (
                qaMessages.slice(0, 12).map((message) => (
                  <div key={message._id} className="qa-item">
                    <div>
                      <strong>{message.userId?.name || 'User'}</strong>
                      <p>{message.message}</p>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDeleteMessage(message._id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="staff-card">
            <h2>Top Participants (Most Active)</h2>
            <div className="leaderboard-list">
              {topParticipants.length === 0 ? (
                <p>No participant data available.</p>
              ) : (
                topParticipants.map((participant, index) => (
                  <div key={participant._id} className="leaderboard-item">
                    <span>#{index + 1}</span>
                    <div>
                      <strong>{participant.name}</strong>
                      <p>{participant.email}</p>
                    </div>
                    <strong>{participant.registrationCount} conf</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div >
  );
};


export default StaffDashboard;
