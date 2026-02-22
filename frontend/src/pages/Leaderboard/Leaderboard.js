import React, { useEffect, useState, useCallback } from 'react';
import { leaderboardAPI } from '../../utils/api';
import { handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { useAuth } from '../../context/AuthContext';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [myPosition, setMyPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('global');
  const { user, isAuthenticated } = useAuth();

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      let response;

      if (filter === 'department' && user?.department) {
        response = await leaderboardAPI.getDepartmentLeaderboard(user.department);
      } else {
        response = await leaderboardAPI.getLeaderboard({ limit: 100 });
      }

      setLeaderboard(response.data.leaderboard || []);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter, user?.department]);

  const fetchMyPosition = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await leaderboardAPI.getMyLeaderboard();
      setMyPosition(response.data);
    } catch (err) {
      console.error('Error fetching my position:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchLeaderboard();
    fetchMyPosition();
  }, [fetchLeaderboard, fetchMyPosition]);

  if (loading) return <Loading />;

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <h1>Conference Leaderboard</h1>

        <div className="leaderboard-filters">
          <button
            className={`filter-btn ${filter === 'global' ? 'active' : ''}`}
            onClick={() => setFilter('global')}
          >
            Global
          </button>
          {isAuthenticated && (
            <button
              className={`filter-btn ${filter === 'department' ? 'active' : ''}`}
              onClick={() => setFilter('department')}
            >
              My Department
            </button>
          )}
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        {isAuthenticated && myPosition && (
          <div className="my-position-card">
            <h3>Your Position</h3>
            <div className="position-content">
              <div className="position-rank">#{myPosition.position}</div>
              <div className="position-info">
                <p><strong>{myPosition.leaderboard.userId?.name}</strong></p>
                <p>Points: {myPosition.leaderboard.totalPoints}</p>
                <p>Conferences: {myPosition.leaderboard.conferenceAttended}</p>
              </div>
            </div>
          </div>
        )}

        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Department</th>
                <th>Points</th>
                <th>Conferences</th>
                <th>Questions</th>
                <th>Certificates</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                entry.userId && (
                  <tr key={entry._id} className={index < 3 ? 'top-rank' : ''}>
                    <td className="rank">#{index + 1}</td>
                    <td className="name">{entry.userId.name}</td>
                    <td>{entry.userId.department}</td>
                    <td className="points">{entry.totalPoints}</td>
                    <td>{entry.conferenceAttended}</td>
                    <td>{entry.questionsAsked}</td>
                    <td>{entry.certificatesEarned}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length === 0 && (
          <div className="empty-state">
            <p>No leaderboard data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
