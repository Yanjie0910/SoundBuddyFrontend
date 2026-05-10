import React, { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, get, update, set } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { database } from "../../../../firebase";
import "./LearningInterface.css";

const MODULE_CONFIG = {
  1: { path: "module1", questions: ["q1", "q2", "q3", "q4", "q5"], name: "Bunyi & Huruf", type: "phoneme" },
  2: { path: "module2", questions: ["q1", "q2", "q3", "q4", "q5"], name: "Bina Kata", type: "kvk" },
  3: { path: "module3", questions: ["q1", "q2", "q3", "q4", "q5"], name: "Keluarga Kata", type: "rhyme" },
};

function LearningInterface() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const activeModuleId = parseInt(moduleId || "1", 10);
  const moduleConfig = MODULE_CONFIG[activeModuleId] || MODULE_CONFIG[1];

  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionState, setSessionState] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [placedLetters, setPlacedLetters] = useState([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completedStats, setCompletedStats] = useState({
    completed: 0,
    total: 5,
    points: 0,
  });

  const audioRef = useRef(null);
  const feedbackAudioRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("studentSession");
    if (!stored) {
      navigate("/student-login");
      return;
    }
    setSession(JSON.parse(stored));
  }, [navigate]);

  const studentId = session?.studentId;
  const teacherId = session?.teacherId;
  const studentName = session?.studentName;

  const sessionPath =
    studentId && teacherId
      ? `teachers/${teacherId}/students/${studentId}/currentSession`
      : null;

  const clearAllStates = useCallback(() => {
    setFeedback(null);
    setShowHint(false);
    setShowAnswer(false);
    setIsTransitioning(false);
    setPlacedLetters([]);
  }, []);

  const calculateModuleStats = useCallback(async () => {
    if (!studentId || !teacherId) return;

    const progressRef = ref(
      database,
      `teachers/${teacherId}/students/${studentId}/progress/${moduleConfig.path}`
    );

    const snap = await get(progressRef);
    const progress = snap.val() || {};

    const questionRecords = Object.entries(progress)
      .filter(([key, value]) => key.startsWith("q") && typeof value === "object")
      .map(([, value]) => value);

    const points = questionRecords.reduce((sum, q) => sum + (q.points || 0), 0);

    setCompletedStats({
      completed: questionRecords.length,
      total: moduleConfig.questions.length,
      points,
    });
  }, [studentId, teacherId, moduleConfig.path, moduleConfig.questions.length]);

  const updateCurrentQuestionInFirebase = useCallback(
    async (questionId) => {
      if (!sessionPath) return;

      try {
        await update(ref(database, sessionPath), {
          currentQuestion: questionId,
          moduleId: activeModuleId,
          gameMode: false,
          gameQuestion: null,
          lastGameAttempt: null,
          placedLetters: [],
          showAnswer: false,
          showHint: false,
          lastAttempt: { attemptNumber: 0, isCorrect: false },
        });
      } catch (e) {
        console.error(e);
      }
    },
    [sessionPath, activeModuleId]
  );

  const saveQuestionProgress = useCallback(
    async (questionId, isCorrect, attempts, points) => {
      if (!studentId || !teacherId || !questionId) return;

      try {
        const progressPath = `teachers/${teacherId}/students/${studentId}/progress/${moduleConfig.path}/${questionId}`;

        await set(ref(database, progressPath), {
          isCorrect,
          attempts,
          points,
          moduleId: activeModuleId,
          completedAt: Date.now(),
        });

        const studentRef = ref(database, `teachers/${teacherId}/students/${studentId}`);
        const snap = await get(studentRef);

        if (snap.exists()) {
          const current = snap.val();
          const currentTotal = current.totalPoints || 0;
          await update(studentRef, { totalPoints: currentTotal + points });
        }
      } catch (e) {
        console.error("Progress save error:", e);
      }
    },
    [studentId, teacherId, activeModuleId, moduleConfig.path]
  );

  const loadQuestion = useCallback(
    async (questionId) => {
      setIsTransitioning(true);
      clearAllStates();
      setCurrentQuestionId(questionId);

      try {
        const qRef = ref(database, `modules/${moduleConfig.path}/questions/${questionId}`);
        const snap = await get(qRef);

        if (snap.exists()) {
          setTimeout(() => {
            setCurrentQuestion(snap.val());
            setIsTransitioning(false);
          }, 400);

          await updateCurrentQuestionInFirebase(questionId);
        } else {
          setIsTransitioning(false);
        }
      } catch (e) {
        console.error(e);
        setIsTransitioning(false);
      }
    },
    [moduleConfig.path, updateCurrentQuestionInFirebase, clearAllStates]
  );

  const getNextQuestion = useCallback(
    (currentId) => {
      const idx = moduleConfig.questions.indexOf(currentId);
      return moduleConfig.questions[idx + 1] || null;
    },
    [moduleConfig.questions]
  );

  const completeLearningModule = useCallback(async () => {
    await calculateModuleStats();

    if (sessionPath) {
      await update(ref(database, sessionPath), {
        gameMode: false,
        gameQuestion: null,
        lastGameAttempt: null,
        placedLetters: [],
        learningCompleted: true,
        completedModule: activeModuleId,
      });
    }

    setFeedback(null);
    setShowHint(false);
    setShowAnswer(false);
    setIsTransitioning(false);
    setShowCompletion(true);
  }, [calculateModuleStats, sessionPath, activeModuleId]);

  const handleCorrectAnswer = useCallback(
    (attemptData) => {
      if (
        isTransitioning ||
        showCompletion ||
        !attemptData ||
        attemptData.attemptNumber === 0
      ) {
        return;
      }

      setTimeout(() => {
        setFeedback({ type: "correct", points: attemptData.pointsAwarded });

        if (feedbackAudioRef.current) {
          feedbackAudioRef.current.src = "/audio/correct.mp3";
          feedbackAudioRef.current.play().catch(() => {});
        }

        saveQuestionProgress(
          currentQuestionId,
          true,
          attemptData.attemptNumber,
          attemptData.pointsAwarded || 0
        );

        setTimeout(() => {
          setFeedback(null);

          setTimeout(() => {
            const nextQ = getNextQuestion(currentQuestionId);

            if (nextQ) {
              loadQuestion(nextQ);
            } else {
              completeLearningModule();
            }
          }, 400);
        }, 1800);
      }, 400);
    },
    [
      currentQuestionId,
      loadQuestion,
      getNextQuestion,
      isTransitioning,
      saveQuestionProgress,
      completeLearningModule,
      showCompletion,
    ]
  );

  const handleWrongAnswer = useCallback(
    (attemptData) => {
      if (
        isTransitioning ||
        showCompletion ||
        !attemptData ||
        attemptData.attemptNumber === 0
      ) {
        return;
      }

      if (attemptData.attemptNumber >= 4) return;

      setTimeout(() => {
        setFeedback({ type: "wrong", attempts: attemptData.attemptNumber });

        if (feedbackAudioRef.current) {
          feedbackAudioRef.current.src = "/audio/wrong.mp3";
          feedbackAudioRef.current.play().catch(() => {});
        }

        setTimeout(() => setFeedback(null), 1000);
      }, 400);
    },
    [isTransitioning, showCompletion]
  );

  useEffect(() => {
    if (!session || !sessionPath) return;

    const init = async () => {
      await update(ref(database, sessionPath), {
        currentQuestion: "q1",
        moduleId: activeModuleId,
        gameMode: false,
        gameQuestion: null,
        lastGameAttempt: null,
        placedLetters: [],
        showAnswer: false,
        showHint: false,
        totalPoints: 0,
        learningCompleted: false,
        lastAttempt: { attemptNumber: 0, isCorrect: false },
        startedAt: Date.now(),
      });

      setShowCompletion(false);
      loadQuestion("q1");
    };

    init();
  }, [session, sessionPath, activeModuleId, loadQuestion]);

  useEffect(() => {
    if (!sessionPath) return;

    const sessionRef = ref(database, sessionPath);
    let prevAttempt = 0;

    const unsub = onValue(sessionRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.val();
      setSessionState(data);

      if (showCompletion) return;

      if (data.showAnswer && !showAnswer) {
        setShowAnswer(true);
        setFeedback(null);
        setShowHint(false);
        setIsTransitioning(false);

        saveQuestionProgress(currentQuestionId, false, 4, 0);

        setTimeout(() => {
          const nextQ = getNextQuestion(currentQuestionId);

          if (nextQ) {
            loadQuestion(nextQ);
          } else {
            completeLearningModule();
          }
        }, 3000);

        return;
      }

      if (isTransitioning) return;

      if (data.showHint && !showHint) {
        setShowHint(true);
        setFeedback(null);
      }

      if (data.lastAttempt) {
        const cur = data.lastAttempt.attemptNumber;

        if (cur > prevAttempt && cur > 0) {
          prevAttempt = cur;

          if (data.lastAttempt.isCorrect) {
            handleCorrectAnswer(data.lastAttempt);
          } else {
            handleWrongAnswer(data.lastAttempt);
          }
        }
      }

      if (Array.isArray(data.placedLetters)) {
        setPlacedLetters(data.placedLetters);
      }
    });

    return () => unsub();
  }, [
    sessionPath,
    currentQuestionId,
    showHint,
    showAnswer,
    handleCorrectAnswer,
    handleWrongAnswer,
    getNextQuestion,
    loadQuestion,
    isTransitioning,
    saveQuestionProgress,
    completeLearningModule,
    showCompletion,
  ]);

  const playSound = () => {
    if (audioRef.current && currentQuestion) {
      const audioFile =
        currentQuestion.phonemeAudio ||
        currentQuestion.wordAudio ||
        `${currentQuestion.word}.mp3`;

      audioRef.current.src = `/audio/${audioFile}`;
      audioRef.current.play().catch(() => {});
    }
  };

  const questionNum = moduleConfig.questions.indexOf(currentQuestionId) + 1;
  const totalQ = moduleConfig.questions.length;

  if (!session) {
    return (
      <div className="loading">
        <h2>Memuatkan...</h2>
      </div>
    );
  }

  if (!studentId || !teacherId) {
    return (
      <div className="loading error">
        <h2>Ralat: Data log masuk hilang</h2>
        <button onClick={() => navigate("/student-login")}>
          Kembali ke Log Masuk
        </button>
      </div>
    );
  }

  if (showCompletion) {
    return (
      <div className="learning-completion-page">
        <div className="completion-card">
          <div className="completion-label">Modul Selesai</div>

          <h1>Tahniah, {studentName || "pelajar"}!</h1>

          <p className="completion-subtitle">
            Anda telah menyelesaikan {moduleConfig.name}.
          </p>

          <div className="completion-stats">
            <div className="completion-stat-box">
              <span className="stat-number">
                {completedStats.completed}/{completedStats.total}
              </span>
              <span className="stat-label">Soalan selesai</span>
            </div>

            <div className="completion-stat-box">
              <span className="stat-number">{completedStats.points}</span>
              <span className="stat-label">Mata terkumpul</span>
            </div>
          </div>

          <div className="completion-message">
            Pembelajaran selesai. Teruskan ke permainan mini untuk mendapatkan lencana modul ini.
          </div>

          <div className="completion-actions">
            <button
              className="completion-primary-btn"
              onClick={() => navigate(`/minigame/${activeModuleId}`)}
            >
              Teruskan ke Mini Game
            </button>

            <button
              className="completion-secondary-btn"
              onClick={() => navigate("/student-dashboard")}
            >
              Kembali ke Papan Pemuka
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion || isTransitioning) {
    return (
      <div className="loading">
        <div className="loading-spinner-sm"></div>
        <h2>{isTransitioning ? "Memuatkan soalan..." : "Memuatkan..."}</h2>
      </div>
    );
  }

  return (
    <div className="learning-interface">
      <audio ref={audioRef} />
      <audio ref={feedbackAudioRef} />

      <div className="learning-header">
        <button className="back-btn" onClick={() => navigate("/student-dashboard")}>
          Kembali
        </button>

        <div className="module-title-tag">{moduleConfig.name}</div>

        <div className="header-stats">
          <span>{sessionState?.totalPoints || 0} mata</span>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(questionNum / totalQ) * 100}%` }}
          ></div>
        </div>
        <div className="progress-text">
          Soalan {questionNum} daripada {totalQ}
        </div>
      </div>

      <div className="question-container">
        {moduleConfig.type === "phoneme" && (
          <>
            {!showHint && !showAnswer && !feedback && (
              <div className="discovery-mode animate-fade-in">
                <p className="q-instruction">Dengar bunyi dan pilih huruf yang betul</p>
                <button className="massive-speaker-button" onClick={playSound}>
                  <span className="speaker-icon">Audio</span>
                </button>
                <p className="instruction-text">Tekan untuk dengar bunyi</p>
              </div>
            )}

            {showHint && !showAnswer && (
              <div className="hint-mode animate-pop">
                <p className="q-instruction">Petunjuk:</p>
                <div className="hint-card">
                  <img
                    src={`/images/objects/${currentQuestion.visualCueImage}`}
                    alt="Petunjuk"
                    className="real-photo-hint"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <button className="mini-speaker-button" onClick={playSound}>
                    Dengar semula
                  </button>
                </div>
                <p className="hint-text">{currentQuestion.hintText || "Ini petunjuknya."}</p>
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>
                <div className="big-letter-display">
                  {currentQuestion.correctLetter?.toUpperCase()}
                </div>
                <img
                  src={`/images/objects/${currentQuestion.visualCueImage}`}
                  alt="Jawapan"
                  className="answer-image"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {moduleConfig.type === "kvk" && (
          <>
            {!showAnswer && !feedback && (
              <div className="kvk-mode animate-fade-in">
                <div className="word-display">
                  <img
                    src={`/images/objects/${currentQuestion.visualCueImage}`}
                    alt={currentQuestion.word}
                    className="kvk-image"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />

                  <button className="mini-speaker-button" onClick={playSound}>
                    Dengar perkataan: {currentQuestion.word}
                  </button>
                </div>

                <p className="q-instruction">
                  Bina perkataan: <strong>{currentQuestion.word?.toUpperCase()}</strong>
                </p>

                <div className="letter-slots">
                  {(currentQuestion.letters || []).map((letter, i) => (
                    <div
                      key={i}
                      className={`letter-slot ${placedLetters[i] ? "filled" : "empty"}`}
                    >
                      {placedLetters[i] ? placedLetters[i].toUpperCase() : "_"}
                    </div>
                  ))}
                </div>

                <p className="waiting-text">Letakkan blok huruf satu persatu</p>

                {showHint && (
                  <div className="kvk-hint">
                    Petunjuk: {currentQuestion.hintText}
                  </div>
                )}
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>

                <div className="kvk-answer-display">
                  {(currentQuestion.letters || []).map((l, i) => (
                    <div key={i} className="answer-letter-block">
                      {l.toUpperCase()}
                    </div>
                  ))}
                </div>

                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {moduleConfig.type === "rhyme" && (
          <>
            {!showHint && !showAnswer && !feedback && (
              <div className="rhyme-mode animate-fade-in">
                <p className="q-instruction">Tukar huruf pertama untuk membentuk rima</p>

                <div className="rhyme-display">
                  <div className="base-word-card">
                    <span className="base-word-label">Perkataan asas:</span>
                    <span className="base-word">
                      {currentQuestion.baseWord?.toUpperCase()}
                    </span>
                  </div>

                  <div className="arrow-right">→</div>

                  <div className="target-word-card">
                    <span className="base-word-label">Bina perkataan:</span>
                    <span className="target-word">
                      <span className="unknown-letter">?</span>
                      <span className="known-ending">
                        {currentQuestion.rhymePattern?.toUpperCase()}
                      </span>
                    </span>
                  </div>
                </div>

                <button className="mini-speaker-button" onClick={playSound}>
                  Dengar bunyi
                </button>
              </div>
            )}

            {showHint && !showAnswer && (
              <div className="hint-mode animate-pop">
                <div className="rhyme-display">
                  <div className="base-word-card">
                    <span className="base-word">
                      {currentQuestion.baseWord?.toUpperCase()}
                    </span>
                  </div>

                  <div className="arrow-right">→</div>

                  <div className="target-word-card">
                    <span className="target-word">
                      <span className="unknown-letter">?</span>
                      <span className="known-ending">
                        {currentQuestion.rhymePattern?.toUpperCase()}
                      </span>
                    </span>
                  </div>
                </div>

                <p className="hint-text">{currentQuestion.hintText}</p>

                <button className="mini-speaker-button" onClick={playSound}>
                  Dengar semula
                </button>
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>
                <div className="big-letter-display">
                  {currentQuestion.correctLetter?.toUpperCase()}
                </div>
                <p className="answer-word">{currentQuestion.targetWord?.toUpperCase()}</p>
                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {feedback && !showAnswer && (
          <div className={`feedback-animation feedback-${feedback.type}`}>
            <span className="feedback-icon">
              {feedback.type === "correct" ? "Betul" : "Salah"}
            </span>

            <p className="feedback-message">
              {feedback.type === "correct" ? "Betul! Bagus!" : "Cuba lagi!"}
            </p>

            {feedback.type === "correct" && (
              <p className="feedback-points">+{feedback.points} mata</p>
            )}

            {feedback.type === "wrong" && feedback.attempts < 4 && (
              <p className="feedback-attempts">Cuba ke-{feedback.attempts}/4</p>
            )}
          </div>
        )}
      </div>

      {!feedback && !showAnswer && (
        <div className="waiting-indicator">
          <div className="pulse-ring"></div>
          <span>Letakkan blok huruf pada pembaca</span>
        </div>
      )}
    </div>
  );
}

export default LearningInterface;