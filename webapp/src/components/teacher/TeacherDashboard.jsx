import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../../firebase';
import { ref, push, onValue, get, update } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './TeacherDashboard.css';

const PICTURE_POOL = [
  'cat', 'dog', 'apple', 'car', 'star', 'tree', 'fish', 'book', 'hat', 'ball',
  'sun', 'moon', 'leaf', 'shoe', 'cup', 'bird', 'cake', 'bus', 'key', 'frog'
];

function getRandomPicturePassword() {
  const pool = [...PICTURE_POOL];
  const result = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function TeacherDashboard() {
  const navigate = useNavigate();

  // Auth & User
  const [user, setUser] = useState(null);
  
  // Navigation
  const [activeTab, setActiveTab] = useState('overview'); // overview, students, analytics, sessions
  
  // Classroom & Students
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [error, setError] = useState('');
  
  // Analytics
  const [sessions, setSessions] = useState({});
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/teacher-login');
        return;
      }

      setUser(firebaseUser);

      // Load classrooms
      const classRef = ref(database, `teachers/${firebaseUser.uid}/classrooms`);
      onValue(classRef, (snapshot) => {
        const data = snapshot.val() || {};
        setClassrooms(
          Object.entries(data).map(([id, val]) => ({ id, ...val }))
        );
      });

      // Load students
      const studentRef = ref(database, `teachers/${firebaseUser.uid}/students`);
      onValue(studentRef, (snapshot) => {
        const data = snapshot.val() || {};
        setStudents(
          Object.entries(data).map(([id, val]) => ({ id, ...val }))
        );
      });

      // Load session history
      const historyRef = ref(database, '/sessions/history');
      onValue(historyRef, (snapshot) => {
        if (snapshot.exists()) {
          setSessions(snapshot.val());
        }
      });
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    setError('');
    if (!className.trim()) {
      setError('Class name required');
      return;
    }

    const allClassroomsRef = ref(database, 'teachers');
    let duplicate = false;
    try {
      const snapshot = await get(allClassroomsRef);
      if (snapshot.exists()) {
        const teachers = snapshot.val();
        for (const teacherId in teachers) {
          const classrooms = teachers[teacherId]?.classrooms || {};
          for (const classId in classrooms) {
            if (classrooms[classId].name.trim().toLowerCase() === className.trim().toLowerCase()) {
              duplicate = true;
              break;
            }
          }
          if (duplicate) break;
        }
      }
    } catch (err) {
      setError('Error checking class names.');
      return;
    }
    if (duplicate) {
      setError('Class name already exists. Please choose a unique name.');
      return;
    }

    const classRef = ref(database, `teachers/${user.uid}/classrooms`);
    await push(classRef, { name: className });
    setClassName('');
    setError('');
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');

    if (!studentName.trim() || !selectedClass) {
      setError('Student name and class required');
      return;
    }

    const password = getRandomPicturePassword();
    const studentRef = ref(database, `teachers/${user.uid}/students`);

    await push(studentRef, {
      name: studentName,
      classId: selectedClass,
      parentEmail: parentEmail.trim() || null,
      picturePassword: password,
      createdAt: Date.now()
    });

    setStudentName('');
    setParentEmail('');
    setError('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/teacher-login');
  };

  // Analytics Functions
  const getStats = () => {
    const sessionList = Object.values(sessions);
    const totalSessions = sessionList.length;
    const totalPoints = sessionList.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
    const avgScore = totalSessions > 0 ? (totalPoints / totalSessions).toFixed(1) : 0;
    const uniqueStudents = new Set(sessionList.map(s => s.studentId)).size;

    return { totalSessions, totalPoints, avgScore, uniqueStudents };
  };

  const calculateAccuracy = (attempts) => {
    if (!attempts) return 0;
    const attemptList = Object.values(attempts);
    const correct = attemptList.filter(a => a.isCorrect).length;
    return attemptList.length > 0 ? ((correct / attemptList.length) * 100).toFixed(0) : 0;
  };

  const getFilteredSessions = () => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    return Object.entries(sessions).filter(([id, session]) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'today') return session.startTime > oneDayAgo;
      if (activeFilter === 'week') return session.startTime > oneWeekAgo;
      return true;
    });
  };

  const getStrugglingStudents = () => {
    const studentPerformance = {};

    Object.values(sessions).forEach(session => {
      const studentId = session.studentId;
      if (!studentPerformance[studentId]) {
        studentPerformance[studentId] = { sessions: 0, totalAttempts: 0, correctAttempts: 0 };
      }

      studentPerformance[studentId].sessions++;

      if (session.attempts) {
        Object.values(session.attempts).forEach(attempt => {
          studentPerformance[studentId].totalAttempts++;
          if (attempt.isCorrect) studentPerformance[studentId].correctAttempts++;
        });
      }
    });

    return Object.entries(studentPerformance)
      .filter(([id, perf]) => {
        const accuracy = (perf.correctAttempts / perf.totalAttempts) * 100;
        return accuracy < 70;
      })
      .map(([id, perf]) => ({
        studentId: id,
        name: students.find(s => s.id === id)?.name || id,
        accuracy: ((perf.correctAttempts / perf.totalAttempts) * 100).toFixed(0),
        sessions: perf.sessions
      }));
  };

  const getChallengingQuestions = () => {
    const questionStats = {};

    Object.values(sessions).forEach(session => {
      if (session.attempts) {
        Object.values(session.attempts).forEach(attempt => {
          const qId = attempt.questionId;
          if (!questionStats[qId]) {
            questionStats[qId] = { total: 0, correct: 0, totalAttempts: 0 };
          }

          questionStats[qId].total++;
          questionStats[qId].totalAttempts += attempt.attemptNumber;
          if (attempt.isCorrect) questionStats[qId].correct++;
        });
      }
    });

    return Object.entries(questionStats)
      .map(([qId, stats]) => ({
        questionId: qId,
        letter: qId.replace('q', ''),
        accuracy: ((stats.correct / stats.total) * 100).toFixed(0),
        avgAttempts: (stats.totalAttempts / stats.total).toFixed(1)
      }))
      .sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy));
  };

  if (!user) {
    return <div className="loading-dashboard">Loading...</div>;
  }

  const stats = getStats();
  const filteredSessions = getFilteredSessions();
  const strugglingStudents = getStrugglingStudents();
  const challengingQuestions = getChallengingQuestions();

  return (
    <div className="teacher-dashboard-wrapper">
      
      {/* TOP NAVIGATION */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🎓 SoundBuddy Teacher Portal</h1>
        </div>
        <div className="nav-tabs">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={activeTab === 'students' ? 'active' : ''}
            onClick={() => setActiveTab('students')}
          >
            👥 Students
          </button>
          <button 
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Analytics
          </button>
          <button 
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            📋 Sessions
          </button>
        </div>
        <div className="nav-user">
          <span>👤 {user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2>📊 Dashboard Overview</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{students.length}</div>
                  <div className="stat-label">Total Students</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🏫</div>
                <div className="stat-info">
                  <div className="stat-value">{classrooms.length}</div>
                  <div className="stat-label">Classrooms</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalSessions}</div>
                  <div className="stat-label">Total Sessions</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.avgScore}</div>
                  <div className="stat-label">Avg Score (out of 75)</div>
                </div>
              </div>
            </div>

            {strugglingStudents.length > 0 && (
              <div className="alert-box">
                <h3>⚠️ Students Needing Attention</h3>
                <ul>
                  {strugglingStudents.map((s, idx) => (
                    <li key={idx}>
                      <strong>{s.name}</strong> - {s.accuracy}% accuracy ({s.sessions} sessions)
                    </li>
                  ))}
                </ul>
                <p className="recommendation">💡 Schedule 1-on-1 support sessions</p>
              </div>
            )}

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <button onClick={() => setActiveTab('students')} className="action-btn">
                ➕ Add New Student
              </button>
              <button onClick={() => setActiveTab('analytics')} className="action-btn">
                📊 View Analytics
              </button>
              <button onClick={() => setActiveTab('sessions')} className="action-btn">
                📋 View All Sessions
              </button>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="tab-content">
            <h2>👥 Student Management</h2>

            <div className="form-section">
              <h3>Create Classroom</h3>
              <form onSubmit={handleAddClassroom} className="inline-form">
                <input
                  type="text"
                  placeholder="Classroom Name (e.g., Grade 1A)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <button type="submit">Add Classroom</button>
              </form>
            </div>

            <div className="form-section">
              <h3>Add Student</h3>
              <form onSubmit={handleAddStudent} className="student-form">
                <input
                  type="text"
                  placeholder="Student Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Select Classroom</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="email"
                  placeholder="Parent Email (optional)"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                />
                <button type="submit">Add Student</button>
              </form>
              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="students-list">
              <h3>All Students ({students.length})</h3>
              {students.length === 0 ? (
                <p className="empty-state">No students yet. Add your first student above!</p>
              ) : (
                <div className="students-grid">
                  {students.map((s) => (
                    <div key={s.id} className="student-card">
                      <div className="student-header">
                        <h4>{s.name}</h4>
                        <span className="student-badge">
                          {classrooms.find(c => c.id === s.classId)?.name || 'N/A'}
                        </span>
                      </div>
                      <div className="student-details">
                        <p><strong>🔑 Picture Password:</strong></p>
                        <div className="password-pictures">
                          {s.picturePassword?.map((pic, i) => (
                            <span key={i} className="picture-badge">{pic}</span>
                          ))}
                        </div>
                        {s.parentEmail && (
                          <p><strong>📧 Parent:</strong> {s.parentEmail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="tab-content">
            <h2>📈 Performance Analytics</h2>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>📚 Most Challenging Questions</h3>
                {challengingQuestions.length === 0 ? (
                  <p className="empty-state">No session data yet</p>
                ) : (
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Letter</th>
                        <th>Avg Attempts</th>
                        <th>Accuracy</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challengingQuestions.slice(0, 5).map((q, idx) => (
                        <tr key={idx}>
                          <td>{q.questionId.toUpperCase()}</td>
                          <td className="letter-cell">
                            {String.fromCharCode(96 + parseInt(q.letter)).toUpperCase()}
                          </td>
                          <td>{q.avgAttempts}</td>
                          <td>{q.accuracy}%</td>
                          <td>
                            <span className={`badge ${q.accuracy >= 80 ? 'good' : q.accuracy >= 60 ? 'medium' : 'needs-review'}`}>
                              {q.accuracy >= 80 ? '✅' : q.accuracy >= 60 ? '📝' : '⚠️'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="analytics-card">
                <h3>📊 Class Performance Distribution</h3>
                <div className="performance-bars">
                  <div className="perf-bar">
                    <span>90-100%:</span>
                    <div className="bar excellent"></div>
                  </div>
                  <div className="perf-bar">
                    <span>80-89%:</span>
                    <div className="bar good"></div>
                  </div>
                  <div className="perf-bar">
                    <span>70-79%:</span>
                    <div className="bar medium"></div>
                  </div>
                  <div className="perf-bar">
                    <span>&lt;70%:</span>
                    <div className="bar needs-help"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div className="tab-content">
            <h2>📋 Session History</h2>

            <div className="filter-buttons">
              <button 
                className={activeFilter === 'all' ? 'active' : ''}
                onClick={() => setActiveFilter('all')}
              >
                All Time
              </button>
              <button 
                className={activeFilter === 'today' ? 'active' : ''}
                onClick={() => setActiveFilter('today')}
              >
                Today
              </button>
              <button 
                className={activeFilter === 'week' ? 'active' : ''}
                onClick={() => setActiveFilter('week')}
              >
                This Week
              </button>
            </div>

            <div className="sessions-table-container">
              {filteredSessions.length === 0 ? (
                <p className="empty-state">No sessions found</p>
              ) : (
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Student</th>
                      <th>Points</th>
                      <th>Accuracy</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions
                      .sort((a, b) => (b[1].startTime || 0) - (a[1].startTime || 0))
                      .map(([sessionId, session]) => (
                        <tr key={sessionId}>
                          <td>{new Date(session.startTime).toLocaleString()}</td>
                          <td>{students.find(s => s.id === session.studentId)?.name || session.studentId}</td>
                          <td><strong>{session.totalPoints}/75</strong></td>
                          <td>{calculateAccuracy(session.attempts)}%</td>
                          <td>
                            <button 
                              className="view-btn"
                              onClick={() => setSelectedSession({ id: sessionId, data: session })}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* SESSION DETAIL MODAL */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Session Details</h2>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="session-info-box">
                <p><strong>Student:</strong> {students.find(s => s.id === selectedSession.data.studentId)?.name || 'Unknown'}</p>
                <p><strong>Date:</strong> {new Date(selectedSession.data.startTime).toLocaleString()}</p>
                <p><strong>Points:</strong> {selectedSession.data.totalPoints}/75</p>
                <p><strong>Accuracy:</strong> {calculateAccuracy(selectedSession.data.attempts)}%</p>
              </div>

              <h3>Attempt Log:</h3>
              <div className="attempts-log">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Question</th>
                      <th>Scanned</th>
                      <th>Expected</th>
                      <th>Result</th>
                      <th>Attempt #</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSession.data.attempts && 
                      Object.entries(selectedSession.data.attempts)
                        .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
                        .map(([attemptId, attempt]) => (
                          <tr key={attemptId} className={attempt.isCorrect ? 'correct-row' : 'wrong-row'}>
                            <td>{new Date(attempt.timestamp).toLocaleTimeString()}</td>
                            <td>{attempt.questionId}</td>
                            <td>{attempt.scannedLetter?.toUpperCase()}</td>
                            <td>{attempt.correctLetter?.toUpperCase()}</td>
                            <td>{attempt.isCorrect ? '✅' : '❌'}</td>
                            <td>{attempt.attemptNumber}</td>
                            <td>+{attempt.pointsAwarded || 0}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;