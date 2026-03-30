import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { conferenceAPI, registrationAPI } from '../../utils/api';
import { formatDate, formatTime, handleApiError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import Loading from '../../components/ui/Loading';
import './Meetings.css';

const Meetings = () => {
  const { isAuthenticated, canManageEvents, user } = useAuth();
  const [conferences, setConferences] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Always call hooks at the top level

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        setLoading(true);
        const conferenceResponse = await conferenceAPI.getAll({ status: 'all' });
        setConferences(conferenceResponse.data.conferences || []);

        if (isAuthenticated && !canManageEvents) {
          const registrationResponse = await registrationAPI.getMyRegistrations();
          const ids = (registrationResponse.data.registrations || []).map(
            (registration) => registration.conferenceId?._id
          );
          setRegisteredIds(ids);
        }
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    loadMeetings();
  }, [isAuthenticated, canManageEvents]);

  const visibleConferences = useMemo(() => {
    return conferences.filter((conference) => ['ongoing', 'upcoming'].includes(conference.status));
  }, [conferences]);

  const ongoingConferences = useMemo(() => visibleConferences.filter((conference) => conference.status === 'ongoing'), [visibleConferences]);
  const upcomingConferences = useMemo(() => visibleConferences.filter((conference) => conference.status === 'upcoming'), [visibleConferences]);
  const totalVisible = visibleConferences.length;

  // Early return for loading
  if (loading) {
    return <Loading message="Loading meetings..." />;
  }

  // Early return for not authenticated
  if (!isAuthenticated) {
    return (
      <div className="meetings-page">
        <div className="meetings-container">
          <div className="meetings-header">
            <h1>Conference Meetings</h1>
            <p>Please log in to view and join meetings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="meetings-page">
      <div className="meetings-container">
        <div className="meetings-header">
          <h1>Conference Meetings</h1>
          <p>Join live conferences from your account across any device.</p>
          <div className="meeting-summary-row">
            <div className="meeting-summary-chip">
              <span className="summary-label">Live Now</span>
              <strong>{ongoingConferences.length}</strong>
            </div>
            <div className="meeting-summary-chip">
              <span className="summary-label">Upcoming</span>
              <strong>{upcomingConferences.length}</strong>
            </div>
            <div className="meeting-summary-chip">
              <span className="summary-label">Available to You</span>
              <strong>{totalVisible}</strong>
            </div>
          </div>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        <section className="meetings-section">
          <h2>Ongoing Now</h2>
          {ongoingConferences.length === 0 ? (
            <p className="empty-note">No ongoing conference right now.</p>
          ) : (
            <div className="meetings-grid">
              {ongoingConferences.map((conference) => (
                <article key={conference._id} className="meeting-card live">
                  <span className="meeting-status">Ongoing</span>
                  <h3>{conference.title}</h3>
                  <p>{conference.department} Department</p>
                  <p>{formatDate(conference.date)}</p>
                  <p>{formatTime(conference.date)}{conference.endDate && <> - {formatTime(conference.endDate)}</>}</p>
                  <div className="meeting-actions">
                    <Link
                      to={`/conference/${conference._id}/meeting`}
                      className="btn btn-primary"
                    >
                      Join Live Session
                    </Link>
                    <Link to={`/conference/${conference._id}`} className="btn btn-outline">
                      View Details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="meetings-section">
          <h2>Upcoming Meetings</h2>
          {upcomingConferences.length === 0 ? (
            <p className="empty-note">No upcoming meetings available.</p>
          ) : (
            <div className="meetings-grid">
              {upcomingConferences.map((conference) => {
                // Staff who created the conference should only see 'Join Live Meeting'
                const creatorId = typeof conference.createdBy === 'object' ? conference.createdBy?._id : conference.createdBy;
                const isCreator = !!(user && creatorId && user._id === creatorId);
                const canJoin = canManageEvents || registeredIds.includes(conference._id) || isCreator;
                return (
                  <article key={conference._id} className="meeting-card">
                    <span className={`meeting-status meeting-status-${conference.status}`}>
                      {conference.status === 'ongoing' && 'Live'}
                      {conference.status === 'upcoming' && 'Upcoming'}
                      {conference.status === 'completed' && 'Completed'}
                      {conference.status === 'cancelled' && 'Cancelled'}
                    </span>
                    <h3>{conference.title}</h3>
                    <p>{conference.department} Department</p>
                    <p>{formatDate(conference.date)}</p>
                    <p>{formatTime(conference.date)}{conference.endDate && <> - {formatTime(conference.endDate)}</>}</p>
                    <div className="meeting-actions">
                      {['ongoing', 'upcoming'].includes(conference.status) ? (
                        canJoin ? (
                          <Link
                            to={`/conference/${conference._id}/meeting`}
                            className="btn btn-primary"
                          >
                            {conference.status === 'ongoing' ? 'Join Live Session' : 'Open Meeting Room'}
                          </Link>
                        ) : (
                          <Link
                            to={`/conference/${conference._id}`}
                            className="btn btn-outline"
                          >
                            Register to Join
                          </Link>
                        )
                      ) : (
                        <span className="link-pending">Meeting is over.</span>
                      )}
                      <Link to={`/conference/${conference._id}`} className="btn btn-outline">
                        View Details
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Meetings;
