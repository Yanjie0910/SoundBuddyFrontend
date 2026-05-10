import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './ParentDashboard.css';

function ParentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [sessions, setSessions] = useState({});
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/parent-login');
        return;
      }

      setUser(firebaseUser);

      // Find children linked to this parent's email
      const studentsRef = ref(database, 'teachers');
      onValue(studentsRef, (snapshot) => {
        const data = snapshot.val() || {};
        const matchedChildren = [];

        Object.values(data).forEach((teacher) => {
          if (!teacher.students) return;

          Object.entries(teacher.students).forEach(([studentId, student]) => {
            if (student.parentEmail === firebaseUser.email) {
              matchedChildren.push({
                ...student,
                id: studentId
              });
            }
          });
        });

        setChildren(matchedChildren);
        if (matchedChildren.length > 0) {
          setSelectedChild(matchedChildren[0]);
        }
        setLoading(false);
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

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/parent-login');
  };

  // Get sessions for selected child
  const getChildSessions = () => {
    if (!selectedChild) return [];
    
    return Object.entries(sessions)
      .filter(([id, session]) => session.studentId === selectedChild.id)
      .sort((a, b) => (b[1].startTime || 0) - (a[1].startTime || 0));
  };

  // Calculate child stats
  const getChildStats = () => {
    const childSessions = getChildSessions();
    
    if (childSessions.length === 0) {
      return {
        totalSessions: 0,
        totalPoints: 0,
        avgScore: 0,
        totalTime: 0,
        accuracy: 0
      };
    }

    const totalSessions = childSessions.length;
    const totalPoints = childSessions.reduce((sum, [id, s]) => sum + (s.totalPoints || 0), 0);
    const avgScore = (totalPoints / totalSessions).toFixed(1);
    
    let totalCorrect = 0;
    let totalAttempts = 0;
    
    childSessions.forEach(([id, session]) => {
      if (session.attempts) {
        Object.values(session.attempts).forEach(attempt => {
          totalAttempts++;
          if (attempt.isCorrect) totalCorrect++;
        });
      }
    });

    const accuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(0) : 0;

    return {
      totalSessions,
      totalPoints,
      avgScore,
      accuracy
    };
  };

  // Get struggling letters
  const getStrugglingLetters = () => {
    const childSessions = getChildSessions();
    const letterStats = {};

    childSessions.forEach(([id, session]) => {
      if (session.attempts) {
        Object.values(session.attempts).forEach(attempt => {
          const letter = attempt.correctLetter;
          if (!letterStats[letter]) {
            letterStats[letter] = { total: 0, correct: 0 };
          }
          letterStats[letter].total++;
          if (attempt.isCorrect) letterStats[letter].correct++;
        });
      }
    });

    return Object.entries(letterStats)
      .map(([letter, stats]) => ({
        letter,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(0),
        attempts: stats.total
      }))
      .filter(l => l.accuracy < 70)
      .sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy));
  };

  // Get strong letters
  const getStrongLetters = () => {
    const childSessions = getChildSessions();
    const letterStats = {};

    childSessions.forEach(([id, session]) => {
      if (session.attempts) {
        Object.values(session.attempts).forEach(attempt => {
          const letter = attempt.correctLetter;
          if (!letterStats[letter]) {
            letterStats[letter] = { total: 0, correct: 0 };
          }
          letterStats[letter].total++;
          if (attempt.isCorrect) letterStats[letter].correct++;
        });
      }
    });

    return Object.entries(letterStats)
      .map(([letter, stats]) => ({
        letter,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(0),
        attempts: stats.total
      }))
      .filter(l => l.accuracy >= 90)
      .sort((a, b) => parseFloat(b.accuracy) - parseFloat(a.accuracy))
      .slice(0, 5);
  };

  const calculateAccuracy = (attempts) => {
    if (!attempts) return 0;
    const attemptList = Object.values(attempts);
    const correct = attemptList.filter(a => a.isCorrect).length;
    return attemptList.length > 0 ? ((correct / attemptList.length) * 100).toFixed(0) : 0;
  };

  if (loading) {
    return (
      <div className="parent-dashboard-wrapper">
        <div className="loading-parent">Sedang memuatkan...</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="parent-dashboard-wrapper">
        <nav className="parent-nav">
          <h1>👨‍👩 SoundBuddy Parent Portal</h1>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </nav>
        <div className="empty-parent">
          <h2>Tiada Rekod Anak Dijumpai</h2>
         <p>Emel anda ({user?.email}) belum dipautkan kepada mana-mana akaun pelajar.</p>
<p>Sila hubungi guru anak anda untuk membuat pemautan akaun.</p>
        </div>
      </div>
    );
  }

  const stats = getChildStats();
  const childSessions = getChildSessions();
  const strugglingLetters = getStrugglingLetters();
  const strongLetters = getStrongLetters();

  return (
    <div className="parent-dashboard-wrapper">
      
      {/* TOP NAV */}
      <nav className="parent-nav">
        <div className="nav-left">
          <h1> Portal Ibu Bapa RakanBunyi</h1>
        </div>
        <div className="nav-right">
          <span className="parent-email"> {user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Log Keluar</button>
        </div>
      </nav>

      <div className="parent-content">
        
        {/* CHILD SELECTOR */}
        {children.length > 1 && (
          <div className="child-selector">
            <label>Melihat perkembangan untuk:</label>
            <select 
              value={selectedChild?.id} 
              onChange={(e) => setSelectedChild(children.find(c => c.id === e.target.value))}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* HEADER */}
        <div className="child-header">
          <div className="child-avatar">
            {selectedChild?.name.charAt(0).toUpperCase()}
          </div>
          <div className="child-info">
            <h2>{selectedChild?.name}</h2>
<p className="child-class">Kelas: {selectedChild?.classId || 'Belum ditetapkan'}</p>
          </div>
        </div>

        {/* STATS OVERVIEW */}
        <div className="parent-stats-grid">
          <div className="parent-stat-card">
            <div className="stat-icon">📚</div>
            <div className="stat-details">
              <div className="stat-number">{stats.totalSessions}</div>
              <div className="stat-text">Sesi Selesai</div>
            </div>
          </div>

          <div className="parent-stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-details">
              <div className="stat-number">{stats.totalPoints}</div>
              <div className="stat-text">Jumlah Mata Diperoleh</div>
            </div>
          </div>

          <div className="parent-stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-details">
              <div className="stat-number">{stats.avgScore}/75</div>
              <div className="stat-text">Skor Purata</div>
            </div>
          </div>

          <div className="parent-stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-details">
              <div className="stat-number">{stats.accuracy}%</div>
              <div className="stat-text">Ketepatan Keseluruhan</div>
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="parent-grid">
          
          {/* LEFT COLUMN */}
          <div className="parent-left">
            
            {/* STRENGTHS */}
            {strongLetters.length > 0 && (
              <div className="parent-card success-card">
                <h3>✨ Kekuatan</h3>
                <p className="card-subtitle">Huruf yang telah dikuasai oleh anak anda!</p>
                <div className="letter-badges">
                  {strongLetters.map((l, idx) => (
                    <div key={idx} className="letter-badge success">
                      <span className="badge-letter">{l.letter.toUpperCase()}</span>
                      <span className="badge-accuracy">{l.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AREAS TO PRACTICE */}
            {strugglingLetters.length > 0 && (
              <div className="parent-card warning-card">
                <h3>💡 Perlu Lebih Latihan</h3>
                <p className="card-subtitle">Huruf yang perlu lebih latihan di rumah</p>
                <div className="practice-list">
                  {strugglingLetters.map((l, idx) => (
                    <div key={idx} className="practice-item">
                      <div className="practice-letter">{l.letter.toUpperCase()}</div>
                      <div className="practice-info">
                        <div className="practice-bar">
                          <div 
                            className="practice-fill" 
                            style={{ width: `${l.accuracy}%` }}
                          ></div>
                        </div>
                        <span className="practice-text">{l.accuracy}% ketepatan</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="practice-tip">
                  <strong>💭 Tip:</strong>  Cuba latih huruf-huruf ini menggunakan kad imbas atau bermain
"I Spy" di rumah dengan perkataan yang bermula dengan bunyi tersebut.
                </div>
              </div>
            )}

            {/* RECENT ACTIVITY */}
            <div className="parent-card">
              <h3> Aktiviti Terkini</h3>
              {childSessions.length === 0 ? (
                <p className="empty-text">Belum ada sesi dijalankan</p>
              ) : (
                <div className="activity-list">
                  {childSessions.slice(0, 5).map(([sessionId, session]) => (
                    <div 
                      key={sessionId} 
                      className="activity-item"
                      onClick={() => setSelectedSession({ id: sessionId, data: session })}
                    >
                      <div className="activity-date">
                        {new Date(session.startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="activity-details">
                        <div className="activity-score">
                          <strong>{session.totalPoints}/75</strong> mata
                        </div>
                        <div className="activity-accuracy">
                          {calculateAccuracy(session.attempts)}% ketepatan
                        </div>
                      </div>
                      <button className="activity-view">Lihat</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="parent-right">
            
            {/* PROGRESS CHART */}
            <div className="parent-card">
              <h3> Perkembangan Mengikut Masa</h3>
              <div className="progress-chart">
                {childSessions.slice(0, 10).reverse().map(([id, session], idx) => {
                  const percentage = (session.totalPoints / 75) * 100;
                  return (
                    <div key={idx} className="chart-bar">
                      <div className="chart-fill" style={{ height: `${percentage}%` }}>
                        <span className="chart-label">{session.totalPoints}</span>
                      </div>
                      <div className="chart-date">
                        {new Date(session.startTime).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {childSessions.length === 0 && (
<p>Tiada data buat masa ini. Perkembangan akan dipaparkan selepas sesi selesai.</p>
              )}
            </div>

            {/* ACHIEVEMENTS */}
            <div className="parent-card achievements-card">
<h3>Pencapaian</h3>
              <div className="achievements-grid">
                {stats.totalSessions >= 1 && (
                  <div className="achievement unlocked">
                    <div className="achievement-icon">🎯</div>
                    <div className="achievement-name">Langkah Pertama</div>
                  </div>
                )}
                {stats.totalSessions >= 5 && (
                  <div className="achievement unlocked">
                    <div className="achievement-icon">⭐</div>
                    <div className="achievement-name">Pelajar Cemerlang</div>
                  </div>
                )}
                {stats.accuracy >= 90 && (
                  <div className="achievement unlocked">
                    <div className="achievement-icon">🎓</div>
                    <div className="achievement-name">Pelajar Cemerlang</div>
                  </div>
                )}
                {strongLetters.length >= 5 && (
                  <div className="achievement unlocked">
                    <div className="achievement-icon">🔥</div>
                    <div className="achievement-name">Pakar Huruf</div>
                  </div>
                )}
                {stats.totalSessions < 1 && (
                  <div className="achievement locked">
                    <div className="achievement-icon">🔒</div>
                    <div className="achievement-name">Teruskan Pembelajaran!</div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* SESSION DETAIL MODAL */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋Butiran Sesi</h2>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="session-summary">
                <p><strong>Tarikh:</strong> {new Date(selectedSession.data.startTime).toLocaleString()}</p>
                <p><strong>Mata:</strong> {selectedSession.data.totalPoints}/75</p>
                <p><strong>Ketepatan:</strong> {calculateAccuracy(selectedSession.data.attempts)}%</p>
              </div>

              <h3>Butiran Percubaan</h3>
              <div className="attempts-log">
                <table>
                  <thead>
                    <tr>
                      <th>Masa</th>
                      <th>Soalan</th>
                      <th>Keputusan</th>
                      <th>Cubaan #</th>
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
                            <td>{attempt.isCorrect ? '✅ Betul' : '❌ Salah'}</td>
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

export default ParentDashboard;