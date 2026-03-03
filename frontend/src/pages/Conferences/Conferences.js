import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { conferenceAPI, registrationAPI } from '../../utils/api';
import { handleApiError } from '../../utils/helpers';
import ConferenceCard from '../../components/conference/ConferenceCard';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { FaCalendarTimes } from 'react-icons/fa';
import './Conferences.css';

const Conferences = () => {
  const [conferences, setConferences] = useState([]);
  const [completedConferences, setCompletedConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({
    department: 'ALL',
    status: 'upcoming',
  });
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const fetchConferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await conferenceAPI.getAll({
        department: filter.department === 'ALL' ? undefined : filter.department,
        status: filter.status === 'all' ? undefined : filter.status,
      });
      setConferences(response.data.conferences || []);
      setError('');
      if (filter.status === 'completed' || filter.status === 'all') {
        try {
          const completedRes = await conferenceAPI.getCompleted();
          setCompletedConferences(completedRes.data.completedConferences || []);
        } catch (err) {
          // Ignore completed fetch error
        }
      } else {
        setCompletedConferences([]);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchMyRegistrations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await registrationAPI.getMyRegistrations();
      const regIds = response.data.registrations.map((r) => r.conferenceId._id);
      setRegistrations(regIds);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchConferences();
    fetchMyRegistrations();
  }, [fetchConferences, fetchMyRegistrations]);

  const handleRegister = async (conferenceId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await registrationAPI.register(conferenceId);
      setRegistrations([...registrations, conferenceId]);
      toast.success('Registered successfully! Check My Tickets for your QR code.');
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  // Combine with completed conferences (archived ones) while keeping them unique
  const mappedCompleted = completedConferences.map(cc => ({ ...cc, _id: cc.originalId || cc._id }));
  const mergedConferences = [...conferences, ...mappedCompleted.filter(cc => !conferences.some(c => c._id === cc._id))];

  // Restrict visibility based on user role
  let visibleConferences = mergedConferences;
  if (user) {
    if (user.role === 'student') {
      // Students only see conferences for their department or for ALL departments
      visibleConferences = visibleConferences.filter(c => c.department === user.department || c.department === 'ALL');
    }
    // staff and admin can see ALL conferences (isCreator only controls action buttons, not visibility)
  }

  const ongoingConferences = visibleConferences.filter((c) => c.status === 'ongoing');
  const upcomingConferences = visibleConferences.filter((c) => c.status === 'upcoming');
  const completedConfs = visibleConferences.filter((c) => c.status === 'completed');
  const otherConferences = visibleConferences.filter(
    (c) => c.status !== 'ongoing' && c.status !== 'upcoming' && c.status !== 'completed'
  );

  // Keyword search filter applied on top
  const applySearch = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.speaker?.name?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  };

  const isStaff = user && ['admin', 'staff'].includes(user.role);

  const isCreator = (conference) => {
    const creatorId = conference.createdBy?._id || conference.createdBy;
    return user && creatorId && creatorId.toString() === user._id?.toString();
  };

  const EmptyState = ({ status }) => (
    <div className="no-conferences">
      <div className="empty-icon">
        <FaCalendarTimes />
      </div>
      <h3>No {status} conferences</h3>
      <p>There are no {status} conferences at the moment. Check back later or explore other categories!</p>
    </div>
  );

  const renderSection = (title, confs, emoji) => {
    if (confs.length === 0) return null;
    return (
      <div className="conferences-section">
        <h2 className="section-title">{emoji} {title}</h2>
        <div className="conferences-grid">
          {confs.map((conference) => (
            <ConferenceCard
              key={conference._id}
              conference={conference}
              onRegister={handleRegister}
              isRegistered={registrations.includes(conference._id)}
              isCreator={isCreator(conference)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="conferences-page">
      <div className="conferences-container">
        <h1>Conferences</h1>

        {/* Search bar */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search by title, speaker, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              color: 'var(--ink-900)',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              value={filter.department}
              onChange={(e) => setFilter({ ...filter, department: e.target.value })}
            >
              <option value="ALL">All Departments</option>
              <option value="CSE">Computer Science (CSE)</option>
              <option value="ECE">Electronics (ECE)</option>
              <option value="MECH">Mechanical (MECH)</option>
              <option value="AIML">AI & Machine Learning (AIML)</option>
              <option value="EEE">Electrical & Electronics (EEE)</option>
              <option value="FT">Food Technology (FT)</option>
              <option value="IT">Information Technology (IT)</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              {isStaff && <option value="completed">Completed</option>}
              <option value="all">All Status</option>
            </select>
          </div>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        {loading ? (
          <Loading message="Loading conferences..." />
        ) : (
          <>
            {filter.status === 'all' ? (
              <>
                {renderSection('Ongoing Conferences', applySearch(ongoingConferences), '')}
                {renderSection('Upcoming Conferences', applySearch(upcomingConferences), '')}
                {isStaff && completedConfs.length > 0 && (
                  <div className="conferences-section">
                    <h2 className="section-title">Completed Conferences</h2>
                    <div className="conferences-grid">
                      {applySearch(completedConfs).map((conference) => (
                        <ConferenceCard
                          key={conference._id}
                          conference={conference}
                          isRegistered={false}
                          onRegister={null}
                          isCreator={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {renderSection('Other Conferences', applySearch(otherConferences), '')}
                {applySearch(visibleConferences).length === 0 && (
                  <EmptyState status="matching" />
                )}
              </>
            ) : filter.status === 'completed' ? (
              <div className="conferences-section">
                <h2 className="section-title">Completed Conferences</h2>
                {applySearch(completedConfs).length === 0 ? (
                  <EmptyState status="completed" />
                ) : (
                  <div className="conferences-grid">
                    {applySearch(completedConfs).map((conference) => (
                      <ConferenceCard
                        key={conference._id}
                        conference={conference}
                        isRegistered={false}
                        onRegister={null}
                        isCreator={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {applySearch(visibleConferences).filter(c => c.status === filter.status).length === 0 ? (
                  <EmptyState status={filter.status} />
                ) : (
                  <div className="conferences-grid">
                    {applySearch(visibleConferences).filter(c => c.status === filter.status).map((conference) => (
                      <ConferenceCard
                        key={conference._id}
                        conference={conference}
                        onRegister={handleRegister}
                        isRegistered={registrations.includes(conference._id)}
                        isCreator={isCreator(conference)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Conferences;
