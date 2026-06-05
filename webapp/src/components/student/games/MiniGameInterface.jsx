import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, onValue, update, get, set } from 'firebase/database';
import { database } from '../../../firebase';
import './MiniGameInterface.css';

const GAME_CONFIG = {
  1: {
    dbPath: 'module1',
    name: 'Detektif Bunyi',
    badgeId: 'detektif_bunyi',
    badgeName: 'Detektif Bunyi',
    nextModule: 2
  },
  2: {
    dbPath: 'module2',
    name: 'Misi Kata',
    badgeId: 'misi_kata',
    badgeName: 'Misi Kata',
    nextModule: 3
  },
  3: {
    dbPath: 'module3',
    name: 'Cari Rima',
    badgeId: 'cari_rima',
    badgeName: 'Cari Rima',
    nextModule: null
  },
};

function MiniGameInterface() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const mId = parseInt(moduleId || '1', 10);
  const config = GAME_CONFIG[mId] || GAME_CONFIG[1];

  const [session, setSession] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [currentQ, setCurrentQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [badgeAwarded, setBadgeAwarded] = useState(false);
  const [sessionState, setSessionState] = useState(null);
  const [scannedAnswer, setScannedAnswer] = useState('');

  const audioRef = useRef(null);
  const feedbackAudioRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('studentSession');

    if (!stored) {
      navigate('/student-login');
      return;
    }

    setSession(JSON.parse(stored));
  }, [navigate]);

  const studentId = session?.studentId;
  const teacherId = session?.teacherId;

  const sessionPath =
    studentId && teacherId
      ? `teachers/${teacherId}/students/${studentId}/currentSession`
      : null;

  // Load mini-game data from Firebase without forcing Q1
  useEffect(() => {
    if (!session) return;

    const loadGame = async () => {
      try {
        const gameRef = ref(database, `minigames/${config.dbPath}`);
        const snap = await get(gameRef);

        if (snap.exists()) {
          const data = snap.val();
          setGameData(data);
          console.log('Mini-game data loaded');
        }
      } catch (err) {
        console.error('Load game error:', err);
      }
    };

    loadGame();
  }, [session, config.dbPath]);

  // Initialize / resume mini-game session
  useEffect(() => {
    if (!sessionPath || !gameData) return;

    const initGame = async () => {
      try {
        const snap = await get(ref(database, sessionPath));
        const existing = snap.exists() ? snap.val() : {};

        const resumeQuestion =
          existing.gameMode === true &&
          existing.moduleId === mId &&
          existing.gameQuestion !== undefined
            ? existing.gameQuestion
            : 0;

        const restoredAnswers = existing.gameAnswers || {};

        console.log('RESUME GAME QUESTION:', resumeQuestion);

        setCurrentQIdx(resumeQuestion);
        setCurrentQ(gameData.questions[resumeQuestion]);
        setAnswers(restoredAnswers);

        const correctCount = Object.values(restoredAnswers).filter(
          (a) => a?.isCorrect
        ).length;

        setScore({
          correct: correctCount,
          total: gameData.questions.length
        });

        await update(ref(database, sessionPath), {
          gameMode: true,
          moduleId: mId,
          gameQuestion: resumeQuestion,
          gameAnswers: restoredAnswers,
          placedLetters: existing.placedLetters || [],

          lastGameAttempt: existing.lastGameAttempt || {
            questionIdx: -1,
            rfid: null,
            scannedLetter: null,
            isCorrect: false
          },

          currentQuestion: existing.currentQuestion || null
        });
      } catch (err) {
        console.error('Mini-game init error:', err);
      }
    };

    initGame();
  }, [sessionPath, gameData, mId]);

  const awardBadge = useCallback(
    async (passed, finalCorrect, finalTotal) => {
      if (!studentId || !teacherId || !sessionPath) return;

      try {
        await set(
          ref(database, `teachers/${teacherId}/students/${studentId}/progress/module${mId}/minigame`),
          {
            score: finalCorrect,
            total: finalTotal,
            percentage: Math.round((finalCorrect / finalTotal) * 100),
            passed,
            completedAt: Date.now()
          }
        );

        if (passed) {
          await set(
            ref(database, `teachers/${teacherId}/students/${studentId}/badges/${config.badgeId}`),
            {
              earned: true,
              earnedAt: Date.now(),
              badgeName: config.badgeName,
              moduleId: mId
            }
          );

          await update(ref(database, sessionPath), {
            gameMode: false,
            gameCompleted: true,
            currentQuestion: null,
            moduleId: mId + 1 <= 3 ? mId + 1 : mId,
            gameQuestion: 0,
            placedLetters: [],
            lastGameAttempt: {
              questionIdx: -1,
              rfid: null,
              scannedLetter: null,
              isCorrect: false
            }
          });

          setBadgeAwarded(true);
        } else {
          await update(ref(database, sessionPath), {
            gameMode: false,
            gameCompleted: false,
            currentQuestion: 'q1',
            moduleId: mId,
            gameQuestion: 0,
            placedLetters: [],
            lastGameAttempt: {
              questionIdx: -1,
              rfid: null,
              scannedLetter: null,
              isCorrect: false
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    },
    [
      studentId,
      teacherId,
      sessionPath,
      config.badgeId,
      config.badgeName,
      mId
    ]
  );

  // Listen to RFID result from Raspberry Pi
  useEffect(() => {
    if (!sessionPath || !gameData) return;

    let lastProcessedKey = '';

    const unsub = onValue(ref(database, sessionPath), (snap) => {
      if (!snap.exists()) return;

      const data = snap.val();
      setSessionState(data);

      if (!data.lastGameAttempt || isTransitioning || gameOver) return;

      const attempt = data.lastGameAttempt;

      if (attempt.questionIdx < 0) return;
      if (attempt.questionIdx !== currentQIdx) return;

      const attemptKey = `${attempt.questionIdx}-${attempt.timestamp || ''}-${attempt.scannedLetter || ''}`;

      if (attemptKey === lastProcessedKey) return;
      lastProcessedKey = attemptKey;

      const qIdx = attempt.questionIdx;
      const isCorrect = attempt.isCorrect;

      if (attempt.scannedLetter) {
        setScannedAnswer(attempt.scannedLetter);
      }

      const updatedAnswers = {
        ...answers,
        [qIdx]: {
          isCorrect,
          rfid: attempt.rfid,
          scannedLetter: attempt.scannedLetter || null
        }
      };

      setAnswers(updatedAnswers);
      setFeedback({ type: isCorrect ? 'correct' : 'wrong' });

      if (feedbackAudioRef.current) {
        feedbackAudioRef.current.src = isCorrect
          ? '/audio/correct.mp3'
          : '/audio/wrong.mp3';
        feedbackAudioRef.current.play().catch(() => {});
      }

      const newCorrect = Object.values(updatedAnswers).filter(
        (a) => a?.isCorrect
      ).length;

      setTimeout(() => {
        setFeedback(null);
        setScannedAnswer('');
        setIsTransitioning(true);

        setTimeout(() => {
          const nextIdx = qIdx + 1;

          if (nextIdx >= gameData.questions.length) {
            const finalCorrect = newCorrect;
            const finalTotal = gameData.questions.length;

            setScore({
              correct: finalCorrect,
              total: finalTotal
            });

            setGameOver(true);

            const passed =
              (finalCorrect / finalTotal) * 100 >=
              (gameData.passThreshold || 75);

            awardBadge(passed, finalCorrect, finalTotal);
          } else {
            setCurrentQIdx(nextIdx);
            setCurrentQ(gameData.questions[nextIdx]);

            update(ref(database, sessionPath), {
              gameQuestion: nextIdx,
              gameAnswers: updatedAnswers,
              placedLetters: [],

              lastGameAttempt: {
                questionIdx: -1,
                rfid: null,
                scannedLetter: null,
                isCorrect: false
              }
            });
          }

          setIsTransitioning(false);
        }, 400);
      }, 1200);
    });

    return () => unsub();
  }, [
    sessionPath,
    gameData,
    isTransitioning,
    gameOver,
    answers,
    awardBadge,
    currentQIdx
  ]);

  const playSound = () => {
    if (audioRef.current && currentQ) {
      const audio = currentQ.phonemeAudio || currentQ.wordAudio;

      if (audio) {
        audioRef.current.src = `/audio/${audio}`;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  if (!session || !gameData || !currentQ) {
    return (
      <div className="mg-loading">
        <div className="mg-spinner">🎮</div>
        <p>Memuatkan permainan...</p>
      </div>
    );
  }

  const passThreshold = gameData.passThreshold || 75;
  const totalQ = gameData.questions.length;

  if (gameOver) {
    const passed = (score.correct / score.total) * 100 >= passThreshold;
    const percent = Math.round((score.correct / score.total) * 100);

    return (
      <div className="mg-result-screen">
        <audio ref={audioRef} />

        <div className="result-card">
          <div className="result-emoji">{passed ? '🏆' : '💪'}</div>

          <h1>{passed ? 'Tahniah!' : 'Cuba Lagi!'}</h1>

          <div className="score-display">
            <span className="score-num">{score.correct}</span>
            <span className="score-sep">/</span>
            <span className="score-total">{score.total}</span>
          </div>

          <div
            className="score-percent"
            style={{ color: passed ? '#5cb85c' : '#e44' }}
          >
            {percent}%
          </div>

          <p className="pass-info">Perlu {passThreshold}% untuk lulus</p>

          {passed && badgeAwarded && (
            <div className="badge-awarded">
              <div className="badge-glow">🏆</div>
              <h3>Lencana Diperoleh!</h3>
              <p>{config.badgeName}</p>
            </div>
          )}

          {passed && mId === 3 && (
            <div className="certificate-unlocked">
              🎓 Sijil Pakar Fonik Dibuka!
            </div>
          )}

          <div className="result-actions">
            {passed ? (
              <>
                {mId < 3 && (
                  <button
                    className="result-btn next-btn"
                    onClick={() => navigate(`/instruction/${mId + 1}`)}
                  >
                    Modul Seterusnya →
                  </button>
                )}

                {mId === 3 && (
                  <button
                    className="result-btn cert-btn"
                    onClick={() => navigate('/certificate')}
                  >
                    🎓 Lihat Sijil
                  </button>
                )}

                <button
                  className="result-btn home-btn"
                  onClick={() => navigate('/student-dashboard')}
                >
                   Papan Pemuka
                </button>
              </>
            ) : (
              <>
                <button
                  className="result-btn retry-btn"
                  onClick={() => navigate(`/learning/${mId}`)}
                >
                   Cuba Semula Modul
                </button>

                <button
                  className="result-btn home-btn"
                  onClick={() => navigate('/student-dashboard')}
                >
                   Papan Pemuka
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const qNum = currentQIdx + 1;

  return (
    <div className={`minigame-interface game-theme-${mId}`}>
      <audio ref={audioRef} />
      <audio ref={feedbackAudioRef} />

      <div className="mg-header">
        <div className="mg-title-tag">🎮 {config.name}</div>

        <div className="mg-progress-dots">
          {Array.from({ length: totalQ }).map((_, i) => (
            <div
              key={i}
              className={`dot ${
                i < currentQIdx
                  ? answers[i]?.isCorrect
                    ? 'correct'
                    : 'wrong'
                  : i === currentQIdx
                  ? 'current'
                  : 'upcoming'
              }`}
            ></div>
          ))}
        </div>

        <div className="mg-score">
          <span className="mg-score-qnum">Q{qNum}/{totalQ}</span>
        </div>
      </div>

      <div className="mg-question-area">
        <div className="mg-q-num">
          Soalan {qNum} daripada {totalQ}
        </div>

        {(currentQ.phonemeAudio || (!currentQ.word && !currentQ.baseWord)) && (
          <div className="mg-phoneme-mode">
            <button className="mg-speaker-btn" onClick={playSound}>
              🔊
            </button>
            <p className="mg-instruction">
              Dengar dan pilih huruf yang betul!
            </p>
          </div>
        )}

        {currentQ.word && (
          <div className="mg-kvk-mode">
            {currentQ.visualCueImage && (
              <img
                src={`/images/objects/${currentQ.visualCueImage}`}
                alt={currentQ.word}
                className="mg-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}

            <button className="mg-play-btn" onClick={playSound}>
             ▶ Dengar Perkataan
            </button>
            <p className="mg-instruction">
              Susun blok huruf untuk bina perkataan ini!
            </p>
          </div>
        )}

        {currentQ.baseWord && (
          <div className="mg-rhyme-mode">
            <div className="mg-rhyme-row">
              <div className="mg-base-word">
                {currentQ.baseWord}
              </div>

              <div className="mg-arrow">→</div>

              <div className="mg-target">
                <span className="mg-unknown">?</span>
                <span className="mg-known">
{currentQ.rhymePattern?.replace("-", "")
}                </span>
              </div>
            </div>

            <button className="mg-play-btn" onClick={playSound}>
               Dengar
            </button>

            <p className="mg-instruction">
              Pilih huruf pertama yang betul!
            </p>
          </div>
        )}
      </div>

      {!feedback && (
        <div className="mg-answer-section">
          <p className="mg-answer-label">Jawapan:</p>

          {currentQ.correctLetter && !currentQ.word && (
            <div className="mg-answer-boxes single-letter">
              <div
                className={`answer-box ${
                  scannedAnswer ? 'filled' : 'empty'
                }`}
              >
                {scannedAnswer ? (
                  <span className="box-letter animate-pop">
                    {scannedAnswer}
                  </span>
                ) : (
                  <span className="box-placeholder">?</span>
                )}
              </div>
            </div>
          )}

          {currentQ.word && (currentQ.correctLetters || currentQ.letters) && (
  <div className="mg-answer-boxes word-build">
    {(currentQ.correctLetters || currentQ.letters).map((letter, idx) => {
      const placed = sessionState?.placedLetters || [];
      const displayedLetter =
        placed[idx]?.letter || placed[idx] || scannedAnswer.split('')[idx];

      return (
        <div
          key={idx}
          className={`answer-box ${displayedLetter ? 'filled' : 'empty'}`}
        >
          {displayedLetter ? (
            <span className="box-letter animate-pop">
              {displayedLetter}
            </span>
          ) : (
            <span className="box-placeholder">_</span>
          )}
        </div>
      );
    })}
  </div>
)}

          {currentQ.rhymePattern && currentQ.acceptedAnswers && (
            <div className="mg-answer-boxes rhyme-pattern">
              <div
                className={`answer-box ${
                  scannedAnswer ? 'filled' : 'empty'
                } first-letter`}
              >
                {scannedAnswer ? (
                  <span className="box-letter animate-pop">
                    {scannedAnswer}
                  </span>
                ) : (
                  <span className="box-placeholder">?</span>
                )}
              </div>

              {currentQ.rhymePattern
  .replace("-", "")
  .split('')
  .map((letter, idx) => (
                <div key={idx} className="answer-box filled-pattern">
                  <span className="box-letter">
                    {letter}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="mg-helper-text">
            {scannedAnswer
              ? 'Jawapan diproses...'
              : 'Letakkan blok huruf pada pembaca'}
          </p>
        </div>
      )}

      {feedback && (
        <div className={`mg-feedback mg-feedback-${feedback.type}`}>
          <span>
            {feedback.type === 'correct' ? '✅ Betul!' : '❌ Salah!'}
          </span>
        </div>
      )}

      {!feedback && !scannedAnswer && (
        <div className="mg-waiting">
          <div className="mg-pulse"></div>
          <span>Menunggu jawapan...</span>
        </div>
      )}

      <div className="mg-no-hints">
        🚫 Tiada petunjuk dalam permainan!
      </div>
    </div>
  );
}

export default MiniGameInterface;