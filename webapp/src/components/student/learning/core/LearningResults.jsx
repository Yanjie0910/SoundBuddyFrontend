import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { database } from '../../../../firebase';
import './LearningResults.css';

const MODULE_CONFIG = {
  1: { name: 'Bunyi & Huruf', color: '#FF8C69' },
  2: { name: 'Bina Kata', color: '#7EC8E3' },
  3: { name: 'Keluarga Kata', color: '#98D8AA' },
};

function LearningResults() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const mId = parseInt(moduleId || '1', 10);
  const config = MODULE_CONFIG[mId] || MODULE_CONFIG[1];

  const [session, setSession] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('studentSession');
    if (!stored) {
      navigate('/student-login');
      return;
    }
    setSession(JSON.parse(stored));
  }, [navigate]);

  useEffect(() => {
    if (!session) return;

    const loadResults = async () => {
      const { studentId, teacherId } = session;
      const progressPath = `teachers/${teacherId}/students/${studentId}/progress/module${mId}`;
      
      try {
        const snap = await get(ref(database, progressPath));
        if (snap.exists()) {
          const data = snap.val();
          
          // Calculate results
          const questions = Object.entries(data)
            .filter(([key]) => key.startsWith('q'))
            .map(([key, value]) => ({ id: key, ...value }));

          const totalQuestions = questions.length;
          const correctAnswers = questions.filter(q => q.isCorrect).length;
          const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
          const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

          setResults({
            totalQuestions,
            correctAnswers,
            totalPoints,
            accuracy,
            questions
          });
        }
      } catch (error) {
        console.error('Error loading results:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [session, mId]);

  if (loading) {
    return (
      <div className="results-loading">
        <div className="loading-spinner">⏳</div>
        <p>Mengira keputusan...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-error">
        <h2>❌ Ralat memuatkan keputusan</h2>
        <button onClick={() => navigate('/student-dashboard')}>Kembali ke Papan Pemuka</button>
      </div>
    );
  }

  return (
    <div className="learning-results-screen">
      <div className="results-container">
        {/* Header */}
        <div className="results-header">
         
          <h1 className="results-title">{config.name}</h1>
          <p className="results-subtitle">Pembelajaran Selesai!</p>
        </div>

        {/* Score Card */}
        <div className="score-card">
          <div className="score-main">
            <div className="score-circle" style={{ borderColor: config.color }}>
              <span className="score-number">{results.accuracy}%</span>
              <span className="score-label">Ketepatan</span>
            </div>
          </div>

          <div className="score-stats">
            <div className="stat-item">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <span className="stat-value">{results.correctAnswers}/{results.totalQuestions}</span>
                <span className="stat-label">Betul</span>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">💎</div>
              <div className="stat-info">
                <span className="stat-value">{results.totalPoints}</span>
                <span className="stat-label">Mata</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Message */}
        <div className="performance-message">
          {results.accuracy >= 80 ? (
            <>
              <div className="perf-emoji">🌟</div>
              <h2>Cemerlang!</h2>
              <p>Kamu sangat bagus! Teruskan usaha!</p>
            </>
          ) : results.accuracy >= 60 ? (
            <>
              <div className="perf-emoji">👍</div>
              <h2>Bagus!</h2>
              <p>Prestasi yang baik! Terus belajar!</p>
            </>
          ) : (
            <>
              <div className="perf-emoji">💪</div>
              <h2>Teruskan Usaha!</h2>
              <p>Jangan putus asa! Praktis lagi!</p>
            </>
          )}
        </div>

       

        {/* Action Buttons */}
        <div className="results-actions">
          <button 
            className="primary-btn"
            style={{ background: config.color }}
            onClick={() => navigate(`/instruction/minigame/${mId}`)}
          >
             Main Mini Game
          </button>
          
          <button 
            className="secondary-btn"
            onClick={() => navigate('/student-dashboard')}
          >
            Papan Pemuka
          </button>
        </div>

        {/* Question Breakdown (Optional) */}
        <details className="question-breakdown">
          <summary>Lihat Perincian Soalan</summary>
          <div className="breakdown-list">
            {results.questions.map((q, idx) => (
              <div key={q.id} className="breakdown-item">
                <span className="q-num">Soalan {idx + 1}</span>
                <span className={`q-status ${q.isCorrect ? 'correct' : 'wrong'}`}>
                </span>
                <span className="q-attempts">{q.attempts} cubaan</span>
                <span className="q-points">+{q.points} mata</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

export default LearningResults;