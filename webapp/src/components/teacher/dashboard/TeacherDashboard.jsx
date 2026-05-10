import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../../../firebase';
import { ref, push, onValue, get, update } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './TeacherDashboard.css';

const PICTURE_POOL = [
  'kucing','anjing','epal','kereta','bintang',
  'pokok','ikan','buku','topi','bola',
  'pisang','bulan','daun','kasut','cawan',
  'burung','kek','bas','kunci','katak'
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
          <h1>Portal Guru RakanBunyi</h1>
        </div>
        <div className="nav-tabs">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Gambaran Keseluruhan
          </button>
          <button 
            className={activeTab === 'students' ? 'active' : ''}
            onClick={() => setActiveTab('students')}
          >
            Pelajar
          </button>
          <button 
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Analitik
          </button>
          <button 
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            Sesi
          </button>
        </div>
        <div className="nav-user">
          <span> {user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Log Keluar</button>
        </div>
      </nav>

      <div className="dashboard-content">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2> Gambaran Keseluruhan</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{students.length}</div>
                  <div className="stat-label">Jumlah Pelajar</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🏫</div>
                <div className="stat-info">
                  <div className="stat-value">{classrooms.length}</div>
                  <div className="stat-label">Kelas</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalSessions}</div>
                  <div className="stat-label">Jumlah Sesi</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.avgScore}</div>
                  <div className="stat-label">Skor Purata (daripada 75)</div>
                </div>
              </div>
            </div>

            {strugglingStudents.length > 0 && (
              <div className="alert-box">
                 <h3>⚠️ Pelajar Memerlukan Perhatian</h3>
                <ul>
                  {strugglingStudents.map((s, idx) => (
                    <li key={idx}>
                      <strong>{s.name}</strong> - {s.accuracy}% ketepatan({s.sessions} sessions)
                    </li>
                  ))}
                </ul>
                <p className="recommendation">💡 Jadualkan sesi bimbingan individu
</p>
              </div>
            )}

            <div className="quick-actions">
              <h3>Tindakan Pantas</h3>
              <button onClick={() => setActiveTab('students')} className="action-btn">
                ➕ Tambah Pelajar Baharu
              </button>
              <button onClick={() => setActiveTab('analytics')} className="action-btn">
                📊 Lihat Analitik
              </button>
              <button onClick={() => setActiveTab('sessions')} className="action-btn">
                📋 Lihat Semua Sesi
              </button>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="tab-content">
            <h2>Pengurusan Pelajar</h2>

            <div className="form-section">
              <h3>Cipta Kelas</h3>
              <form onSubmit={handleAddClassroom} className="inline-form">
                <input
                  type="text"
                  placeholder="Nama Kelas (contoh: Tahun 1A)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
                <button type="submit">Tambah Kelas</button>
              </form>
            </div>

            <div className="form-section">
              <h3>Tambah Pelajar</h3>
              <form onSubmit={handleAddStudent} className="student-form">
                <input
                  type="text"
                  placeholder="Nama Pelajar"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Pilih Kelas</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="email"
                  placeholder="Emel Ibu Bapa (pilihan)"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                />
                <button type="submit">Tambah Pelajar</button>
              </form>
              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="students-list">
              <h3>Senarai Pelajar ({students.length})</h3>
              {students.length === 0 ? (
                <p className="empty-state">Belum ada pelajar. Tambah pelajar pertama anda di atas!
</p>
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
                        <p><strong>🔑Kata Laluan Gambar:</strong></p>
                        <div className="password-pictures">
                          {s.picturePassword?.map((pic, i) => (
                            <span key={i} className="picture-badge">{pic}</span>
                          ))}
                        </div>
                        {s.parentEmail && (
                          <p><strong>📧 Ibu Bapa:</strong> {s.parentEmail}</p>
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
            <h2> Analisis Prestasi</h2>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Soalan Paling Mencabar</h3>
                {challengingQuestions.length === 0 ? (
                  <p className="empty-state">Tiada sesi dijumpai</p>
                ) : (
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Soalan</th>
                        <th>Huruf</th>
                        <th>Purata Cubaan</th>
                        <th>Ketepatan</th>
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
                <h3> Taburan Prestasi Kelas</h3>
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
            <h2> Sesi Histori</h2>

            <div className="filter-buttons">
              <button 
                className={activeFilter === 'all' ? 'active' : ''}
                onClick={() => setActiveFilter('all')}
              >
                Sepanjang Masa
              </button>
              <button 
                className={activeFilter === 'today' ? 'active' : ''}
                onClick={() => setActiveFilter('today')}
              >
                Hari Ini
              </button>
              <button 
                className={activeFilter === 'week' ? 'active' : ''}
                onClick={() => setActiveFilter('week')}
              >
                Minggu Ini
              </button>
            </div>

            <div className="sessions-table-container">
              {filteredSessions.length === 0 ? (
                <p className="empty-state">Tiada sesi dijumpai</p>
              ) : (
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>Tarikh & Masa</th>
                      <th>Pelajar</th>
                      <th>Mata</th>
                      <th>Ketepatan</th>
                      <th>Tindakan</th>
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
                              Lihat Butiran
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
              <h2>Butiran Sesi</h2>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="session-info-box">
                <p><strong>Pelajar:</strong> {students.find(s => s.id === selectedSession.data.studentId)?.name || 'Unknown'}</p>
                <p><strong>Tarikh:</strong> {new Date(selectedSession.data.startTime).toLocaleString()}</p>
                <p><strong>Mata:</strong> {selectedSession.data.totalPoints}/75</p>
                <p><strong>Ketepatan:</strong> {calculateAccuracy(selectedSession.data.attempts)}%</p>
              </div>

              <h3>Log Percubaan:</h3>
              <div className="attempts-log">
                <table>
                  <thead>
                    <tr>
                      <th>Masa</th>
                      <th>Soalan</th>
                      <th>Imbas</th>
                      <th>Sepatutnya</th>
                      <th>Keputusan</th>
                      <th>Cubaan</th>
                      <th>Mata</th>
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