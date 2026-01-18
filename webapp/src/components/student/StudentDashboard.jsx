import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import StudentHeader from './StudentHeader';
import './StudentDashboard.css';

function StudentDashboard() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load session ONCE
  useEffect(() => {
    const stored = localStorage.getItem('studentSession');
    if (!stored) {
      navigate('/student-login');
      return;
    }
    setSession(JSON.parse(stored));
  }, [navigate]);

  // ✅ Load progress AFTER session exists
  useEffect(() => {
    if (!session) return;

    const { studentId, teacherId } = session;

    const progressRef = ref(
      database,
      `teachers/${teacherId}/students/${studentId}/progress`
    );

    get(progressRef).then(snapshot => {
      setProgress(snapshot.val() || {});
      setLoading(false);
    });
  }, [session]);

  if (!session || loading) {
    return (
      <div className="student-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const { studentName } = session;

  // ✅ Calculate stats from progress
  const totalPoints = progress 
    ? Object.values(progress).reduce((sum, q) => sum + (q.points || 0), 0)
    : 0;
  
  const questionsCompleted = progress ? Object.keys(progress).length : 0;
  
  const correctAnswers = progress
    ? Object.values(progress).filter(q => q.isCorrect).length
    : 0;

  return (
    <>
      <StudentHeader studentName={studentName} />

      <div className="student-dashboard-container">
        
        {/* Welcome Header */}
        <div className="student-welcome-header">
          <div className="student-avatar">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <h2>Welcome back, {studentName}! 👋</h2>
          <p>Ready to continue your phonics adventure?</p>
        </div>

        {/* Progress Section */}
        <div className="student-progress-section">
          <h3>📊 Your Progress</h3>
          
          {/* Stats Grid */}
          <div className="progress-stats-grid">
            <div className="progress-stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-value">{totalPoints}</div>
              <div className="stat-label">Total Points</div>
            </div>
            
            <div className="progress-stat-card">
              <div className="stat-icon">📝</div>
              <div className="stat-value">{questionsCompleted}</div>
              <div className="stat-label">Completed</div>
            </div>
            
            <div className="progress-stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{correctAnswers}</div>
              <div className="stat-label">Correct</div>
            </div>
          </div>

          {/* Question Progress List */}
          {progress && Object.keys(progress).length > 0 ? (
            <ul>
              {Object.entries(progress).map(([questionId, data]) => (
                <li key={questionId} className="module-item">
                  <div className="module-info">
                    <div className="module-title">
                      Question {questionId.toUpperCase()}
                    </div>
                    <div className="module-description">
                      {data.attempts} {data.attempts === 1 ? 'attempt' : 'attempts'} • {data.points} points
                    </div>
                  </div>
                  <div className="module-status">
                    {data.isCorrect ? '✅' : '❌'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-progress">
              <h3>🎯 Start Your Journey!</h3>
              <p>No progress yet. Click below to begin learning phonics!</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="student-actions">
          <button
            className="start-learning-btn"
            onClick={() => navigate('/learning')}
          >
            {questionsCompleted > 0 ? '▶️ Continue Learning' : '🚀 Start Learning'}
          </button>
          
          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem('studentSession');
              navigate('/student-login');
            }}
          >
            🚪 Logout
          </button>
        </div>

      </div>
    </>
  );
}

export default StudentDashboard;
