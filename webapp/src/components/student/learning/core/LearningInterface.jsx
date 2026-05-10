import React, { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, get, update, set } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { database } from "../../../../firebase";
import "./LearningInterface.css";

const MODULE_CONFIG = {
  1: {
    path: "module1",
    questions: ["q1", "q2", "q3", "q4", "q5"],
    name: "Bunyi & Huruf",
    type: "phoneme",
  },
  2: {
    path: "module2",
    questions: ["q1", "q2", "q3", "q4", "q5"],
    name: "Bina Kata",
    type: "kvk",
  },
  3: {
    path: "module3",
    questions: ["q1", "q2", "q3", "q4", "q5"],
    name: "Keluarga Kata",
    type: "rhyme",
  },
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

  const audioRef = useRef(null);
  const feedbackAudioRef = useRef(null);

  // ✅ Tracks which sessionPath has been initialized to prevent re-runs
  const initializedForPath = useRef(null);

  // ─── Load session from localStorage ───────────────────────────────────────
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

  const sessionPath =
    studentId && teacherId
      ? `teachers/${teacherId}/students/${studentId}/currentSession`
      : null;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const clearAllStates = useCallback(() => {
    setFeedback(null);
    setShowHint(false);
    setShowAnswer(false);
    setIsTransitioning(false);
    setPlacedLetters([]);
  }, []);

  // ✅ Full reset — used when moving to a NEW question (not resume)
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
          lastAttempt: {
            attemptNumber: 0,
            isCorrect: false,
          },
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

        const studentRef = ref(
          database,
          `teachers/${teacherId}/students/${studentId}`
        );
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
    async (questionId, isResume = false) => {
      if (!sessionPath) return;

      setIsTransitioning(true);

      if (!isResume) {
        clearAllStates();
      } else {
        setFeedback(null);
        setShowHint(false);
        setShowAnswer(false);
      }

      setCurrentQuestionId(questionId);

      try {
        const qRef = ref(
          database,
          `modules/${moduleConfig.path}/questions/${questionId}`
        );
        const snap = await get(qRef);

        if (snap.exists()) {
          setTimeout(() => {
            setCurrentQuestion(snap.val());
            setIsTransitioning(false);
          }, 400);

          if (!isResume) {
            // Full reset for new question (resets attempts, hints, placedLetters etc.)
            await updateCurrentQuestionInFirebase(questionId);
          } else {
            // ✅ KEY FIX: On resume, still save currentQuestion + moduleId to Firebase
            // Without this, Firebase keeps showing q1 forever and refresh always resets
            await update(ref(database, sessionPath), {
              currentQuestion: questionId,
              moduleId: activeModuleId,
              gameMode: false,
            });
          }
        } else {
          setIsTransitioning(false);
        }
      } catch (e) {
        console.error(e);
        setIsTransitioning(false);
      }
    },
    [moduleConfig.path, updateCurrentQuestionInFirebase, clearAllStates, sessionPath, activeModuleId]
  );

  const getNextQuestion = useCallback(
    (currentId) => {
      const idx = moduleConfig.questions.indexOf(currentId);
      return moduleConfig.questions[idx + 1] || null;
    },
    [moduleConfig.questions]
  );

  const handleCorrectAnswer = useCallback(
    (attemptData) => {
      if (isTransitioning || !attemptData || attemptData.attemptNumber === 0) {
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
              // isResume=false → full reset + saves nextQ to Firebase ✅
              loadQuestion(nextQ);
            } else {
              navigate(`/learning-results/${activeModuleId}`);
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
      navigate,
      saveQuestionProgress,
      activeModuleId,
    ]
  );

  const handleWrongAnswer = useCallback(
    (attemptData) => {
      if (isTransitioning || !attemptData || attemptData.attemptNumber === 0) {
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
    [isTransitioning]
  );

  // ─── Initialize / Resume Session ──────────────────────────────────────────
  useEffect(() => {
    if (!session || !sessionPath) return;

    // Only init once per sessionPath
    if (initializedForPath.current === sessionPath) return;
    initializedForPath.current = sessionPath;

    const init = async () => {
      try {
        const sessionSnap = await get(ref(database, sessionPath));
        const existingSession = sessionSnap.exists() ? sessionSnap.val() : {};

        console.log("=== INIT ===", existingSession);

        const sameModule = existingSession.moduleId === activeModuleId;
        const existingQuestion = existingSession.currentQuestion;

        // ✅ Resume same question if same module, else start at q1
        const questionToLoad =
          sameModule && existingQuestion ? existingQuestion : "q1";

        console.log("questionToLoad:", questionToLoad);

        // Write to Firebase first
        await update(ref(database, sessionPath), {
          currentQuestion: questionToLoad,
          moduleId: activeModuleId,
          gameMode: false,
          gameQuestion: null,
          lastGameAttempt: null,
          placedLetters: existingSession.placedLetters || [],
          showAnswer: false,
          showHint: false,
          totalPoints: existingSession.totalPoints || 0,
          lastAttempt: existingSession.lastAttempt || {
            attemptNumber: 0,
            isCorrect: false,
          },
          startedAt: existingSession.startedAt || Date.now(),
        });

        // isResume=true to preserve existing states
        loadQuestion(questionToLoad, true);
      } catch (err) {
        console.error("Init error:", err);
      }
    };

    init();
  }, [session, sessionPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Firebase Realtime Listener ────────────────────────────────────────────
  useEffect(() => {
    if (!sessionPath) return;

    const sessionRef = ref(database, sessionPath);
    let prevAttempt = 0;

    const unsub = onValue(sessionRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.val();
      setSessionState(data);

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
            navigate(`/learning-results/${activeModuleId}`);
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
    navigate,
    saveQuestionProgress,
    activeModuleId,
  ]);

  // ─── Play Sound ────────────────────────────────────────────────────────────
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

  // ─── Guards ────────────────────────────────────────────────────────────────
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
        <h2>❌ Ralat: Data Log Masuk Hilang</h2>
        <button onClick={() => navigate("/student-login")}>
          Kembali ke Log Masuk
        </button>
      </div>
    );
  }

  if (!currentQuestion || isTransitioning) {
    return (
      <div className="loading">
        <div className="loading-spinner-sm">⏳</div>
        <h2>{isTransitioning ? "Memuatkan soalan..." : "Memuatkan..."}</h2>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="learning-interface">
      <audio ref={audioRef} />
      <audio ref={feedbackAudioRef} />

      {/* Header */}
      <div className="learning-header">
        <button
          className="back-btn"
          onClick={() => navigate("/student-dashboard")}
        >
          ← Kembali
        </button>
        <div className="module-title-tag">{moduleConfig.name}</div>
        <div className="header-stats">
          <span>⭐ {sessionState?.totalPoints || 0}</span>
        </div>
      </div>

      {/* Progress Bar */}
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

        {/* ── MODULE 1: Phoneme ── */}
        {moduleConfig.type === "phoneme" && (
          <>
            {!showHint && !showAnswer && !feedback && (
              <div className="discovery-mode animate-fade-in">
                <p className="q-instruction">
                  Dengar bunyi dan pilih huruf yang betul
                </p>
                <button className="massive-speaker-button" onClick={playSound}>
                  <span className="speaker-icon">🔊</span>
                </button>
                <p className="instruction-text">Tekan untuk dengar bunyi!</p>
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
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <button className="mini-speaker-button" onClick={playSound}>
                    🔊 Dengar semula
                  </button>
                </div>
                <p className="hint-text">
                  {currentQuestion.hintText || "Ini petunjuknya!"}
                </p>
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
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {/* ── MODULE 2: KVK Word Building ── */}
        {moduleConfig.type === "kvk" && (
          <>
            {!showAnswer && !feedback && (
              <div className="kvk-mode animate-fade-in">
                <div className="word-display">
                  <img
                    src={`/images/objects/${currentQuestion.visualCueImage}`}
                    alt={currentQuestion.word}
                    className="kvk-image"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <button className="mini-speaker-button" onClick={playSound}>
                    🔊 {currentQuestion.word}
                  </button>
                </div>
                <p className="q-instruction">
                  Bina perkataan:{" "}
                  <strong>{currentQuestion.word?.toUpperCase()}</strong>
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
                  <div className="kvk-hint">💡 {currentQuestion.hintText}</div>
                )}
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>
                <div className="kvk-answer-display">
                  {(currentQuestion.letters || []).map((letter, i) => (
                    <div key={i} className="answer-letter-block">
                      {letter.toUpperCase()}
                    </div>
                  ))}
                </div>
                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {/* ── MODULE 3: Rhyme / Word Family ── */}
        {moduleConfig.type === "rhyme" && (
          <>
            {!showHint && !showAnswer && !feedback && (
              <div className="rhyme-mode animate-fade-in">
                <p className="q-instruction">
                  Tukar huruf pertama untuk membentuk rima
                </p>
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
  {currentQuestion.rhymePattern?.replace("-", "").toUpperCase()}
</span>
                    </span>
                  </div>
                </div>
                <button className="mini-speaker-button" onClick={playSound}>
                  🔊 Dengar bunyi
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
  {currentQuestion.rhymePattern?.replace("-", "").toUpperCase()}
                      </span>
                    </span>
                  </div>
                </div>
                <p className="hint-text">{currentQuestion.hintText}</p>
                <button className="mini-speaker-button" onClick={playSound}>
                  🔊 Dengar semula
                </button>
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>
                <div className="accepted-answers-display">

  {currentQuestion.acceptedAnswers?.map((answer, index) => (
    <div key={index} className="accepted-answer-card">

      <div className="big-letter-display">
        {answer.letter?.toUpperCase()}
      </div>

      <p className="answer-word">
        {answer.word?.toUpperCase()}
      </p>

    </div>
  ))}

</div>
                <p className="hint-text">Ke soalan seterusnya dalam 3 saat...</p>
              </div>
            )}
          </>
        )}

        {/* ── Feedback Overlay ── */}
        {feedback && !showAnswer && (
          <div className={`feedback-animation feedback-${feedback.type}`}>
            <span className="feedback-icon">
              {feedback.type === "correct" ? "✅" : "❌"}
            </span>
            <p className="feedback-message">
              {feedback.type === "correct" ? "Betul! Bagus!" : "Cuba lagi!"}
            </p>
            {feedback.type === "correct" && (
              <>
                <p className="feedback-points">+{feedback.points} mata!</p>
                <div className="confetti">🎉🎊✨</div>
              </>
            )}
            {feedback.type === "wrong" && feedback.attempts < 4 && (
              <p className="feedback-attempts">Cuba ke-{feedback.attempts}/4</p>
            )}
          </div>
        )}
      </div>

      {/* Waiting Indicator */}
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