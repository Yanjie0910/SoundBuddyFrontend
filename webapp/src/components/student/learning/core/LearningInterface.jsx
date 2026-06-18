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

// ✅ Constants for delays
const TRANSITION_DELAYS = {
  SHOW_ANSWER: 3000,
  FEEDBACK_DISPLAY: 1800,
  WRONG_FEEDBACK: 1000,
  QUESTION_LOAD: 400,
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
  const [showReflection, setShowReflection] = useState(false);
  const [pendingResultRoute, setPendingResultRoute] = useState(null);
  const [error, setError] = useState(null); // ✅ Error state

  const audioRef = useRef(null);
  const feedbackAudioRef = useRef(null);

  // ✅ Refs to prevent infinite loops and memory leaks
  const initializedForPath = useRef(null);
  const isLocalUpdate = useRef(false);
  const prevAttemptRef = useRef(0);
  const timeoutRefs = useRef([]);

  // ✅ Helper to track timeouts for cleanup
  const safeSetTimeout = useCallback((callback, delay) => {
    const id = setTimeout(callback, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  // ✅ Clear all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, []);

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
    setError(null); // ✅ Clear errors too
  }, []);

  // ✅ Full reset — used when moving to a NEW question (not resume)
  const updateCurrentQuestionInFirebase = useCallback(
    async (questionId) => {
      if (!sessionPath) return;
      try {
        isLocalUpdate.current = true; // ✅ Mark as local update
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
        setTimeout(() => { isLocalUpdate.current = false; }, 100);
      } catch (e) {
        console.error("Firebase update error:", e);
        setError("Ralat menyimpan kemajuan. Sila cuba lagi.");
        isLocalUpdate.current = false;
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
      setError(null); // ✅ Clear previous errors

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
          safeSetTimeout(() => {
            setCurrentQuestion(snap.val());
            setIsTransitioning(false);
          }, TRANSITION_DELAYS.QUESTION_LOAD);

          // ✅ Mark as local update before Firebase write
          isLocalUpdate.current = true;

          if (!isResume) {
            // Full reset for new question
            await updateCurrentQuestionInFirebase(questionId);
          } else {
            // On resume, still save currentQuestion + moduleId to Firebase
            await update(ref(database, sessionPath), {
              currentQuestion: questionId,
              moduleId: activeModuleId,
              gameMode: false,
            });
            setTimeout(() => { isLocalUpdate.current = false; }, 100);
          }
        } else {
          setIsTransitioning(false);
          setError("Soalan tidak dijumpai.");
        }
      } catch (e) {
        console.error("Load question error:", e);
        setError("Ralat memuatkan soalan. Sila cuba lagi.");
        setIsTransitioning(false);
        isLocalUpdate.current = false;
      }
    },
    [
      moduleConfig.path,
      updateCurrentQuestionInFirebase,
      clearAllStates,
      sessionPath,
      activeModuleId,
      safeSetTimeout,
    ]
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

      safeSetTimeout(() => {
        setFeedback({
          type: "correct",
          points: attemptData.pointsAwarded,
          attempts: attemptData.attemptNumber,
        });

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

        safeSetTimeout(() => {
          setFeedback(null);
          safeSetTimeout(() => {
            const nextQ = getNextQuestion(currentQuestionId);
            if (nextQ) {
              loadQuestion(nextQ);
            } else {
              openReflectionBeforeResults(
                `/learning-results/${activeModuleId}`
              );
            }
          }, TRANSITION_DELAYS.QUESTION_LOAD);
        }, TRANSITION_DELAYS.FEEDBACK_DISPLAY);
      }, TRANSITION_DELAYS.QUESTION_LOAD);
    },
    [
      currentQuestionId,
      loadQuestion,
      getNextQuestion,
      isTransitioning,
      saveQuestionProgress,
      activeModuleId,
      safeSetTimeout,
    ]
  );

  const handleWrongAnswer = useCallback(
    (attemptData) => {
      if (isTransitioning || !attemptData || attemptData.attemptNumber === 0) {
        return;
      }
      if (attemptData.attemptNumber >= 4) return;

      safeSetTimeout(() => {
        setFeedback({ type: "wrong", attempts: attemptData.attemptNumber });

        if (feedbackAudioRef.current) {
          feedbackAudioRef.current.src = "/audio/wrong.mp3";
          feedbackAudioRef.current.play().catch(() => {});
        }

        safeSetTimeout(
          () => setFeedback(null),
          TRANSITION_DELAYS.WRONG_FEEDBACK
        );
      }, TRANSITION_DELAYS.QUESTION_LOAD);
    },
    [isTransitioning, safeSetTimeout]
  );

  const getEncouragementMessage = useCallback((type, attempts = 1) => {
    if (type === "correct") {
      if (attempts === 1) return "Hebat! Kamu berjaya jawab dengan yakin!";
      return "Bagus! Kamu cuba sampai berjaya!";
    }

    if (attempts >= 3) {
      return "Tak mengapa, kita cuba perlahan-lahan bersama-sama.";
    }

    return "Cuba lagi, kamu hampir berjaya!";
  }, []);

  const openReflectionBeforeResults = useCallback((route) => {
    setPendingResultRoute(route);
    setShowReflection(true);
  }, []);

  const saveReflectionAndContinue = useCallback(
    async (mood) => {
      if (!studentId || !teacherId) {
        navigate(pendingResultRoute || `/learning-results/${activeModuleId}`);
        return;
      }

      try {
        const reflectionPath = `teachers/${teacherId}/students/${studentId}/reflections/${moduleConfig.path}/${Date.now()}`;
        await set(ref(database, reflectionPath), {
          mood,
          moduleId: activeModuleId,
          moduleName: moduleConfig.name,
          questionId: currentQuestionId,
          createdAt: Date.now(),
        });
      } catch (e) {
        console.error("Reflection save error:", e);
      }

      navigate(pendingResultRoute || `/learning-results/${activeModuleId}`);
    },
    [
      studentId,
      teacherId,
      moduleConfig.path,
      moduleConfig.name,
      activeModuleId,
      currentQuestionId,
      navigate,
      pendingResultRoute,
    ]
  );

  // ─── Initialize / Resume Session ──────────────────────────────────────────
  useEffect(() => {
    if (!session || !sessionPath) return;

    // Only init once per sessionPath
    if (initializedForPath.current === sessionPath) return;

    const init = async () => {
      try {
        const sessionSnap = await get(ref(database, sessionPath));
        const existingSession = sessionSnap.exists() ? sessionSnap.val() : {};

        console.log("=== INIT ===", existingSession);

        const sameModule = existingSession.moduleId === activeModuleId;
        const existingQuestion = existingSession.currentQuestion;

        // Resume same question if same module, else start at q1
        const questionToLoad =
          sameModule && existingQuestion ? existingQuestion : "q1";

        console.log("questionToLoad:", questionToLoad);

        // ✅ Mark as local update before Firebase write
        isLocalUpdate.current = true;

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
          startedAt: Date.now(),
          learningCompleted: false,
          gameCompleted: false,
        });

        setTimeout(() => { isLocalUpdate.current = false; }, 100);

        // Load question (isResume=true to preserve existing states)
        await loadQuestion(questionToLoad, true);

        // ✅ Only mark as initialized on SUCCESS
        initializedForPath.current = sessionPath;
      } catch (err) {
        console.error("Init error:", err);
        setError("Ralat memulakan sesi. Sila muat semula halaman.");
        isLocalUpdate.current = false;
        initializedForPath.current = null; // ✅ Allow retry
      }
    };

    init();
  }, [session, sessionPath, activeModuleId, loadQuestion]);

  // ─── Firebase Realtime Listener ────────────────────────────────────────────
  useEffect(() => {
    if (!sessionPath) return;

    const sessionRef = ref(database, sessionPath);

    const unsub = onValue(sessionRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.val();
      setSessionState(data);

      // ✅ Ignore self-triggered updates to prevent infinite loop
      if (isLocalUpdate.current) return;

      // Check if question changed from another source (teacher dashboard)
      if (
        data.moduleId === activeModuleId &&
        data.currentQuestion &&
        data.currentQuestion !== currentQuestionId &&
        !isTransitioning
      ) {
        loadQuestion(data.currentQuestion, true);
        return;
      }

      // Show answer mode
      if (data.showAnswer && !showAnswer) {
        setShowAnswer(true);
        setFeedback(null);
        setShowHint(false);
        setIsTransitioning(false);

        saveQuestionProgress(currentQuestionId, false, 4, 0);

        safeSetTimeout(() => {
          const nextQ = getNextQuestion(currentQuestionId);
          if (nextQ) {
            loadQuestion(nextQ);
          } else {
            openReflectionBeforeResults(
              `/learning-results/${activeModuleId}`
            );
          }
        }, TRANSITION_DELAYS.SHOW_ANSWER);

        return;
      }

      if (isTransitioning) return;

      // Show hint
      if (data.showHint && !showHint) {
        setShowHint(true);
        setFeedback(null);
      }

      // Handle attempts using ref to prevent stale closure
      if (data.lastAttempt) {
        const cur = data.lastAttempt.attemptNumber;
        if (cur > prevAttemptRef.current && cur > 0) {
          prevAttemptRef.current = cur;
          if (data.lastAttempt.isCorrect) {
            handleCorrectAnswer(data.lastAttempt);
          } else {
            handleWrongAnswer(data.lastAttempt);
          }
        }
      }

      // Update placed letters
      if (Array.isArray(data.placedLetters)) {
        setPlacedLetters(data.placedLetters);
      }
    });

    return () => {
      unsub();
      // ✅ Reset attempt counter when listener unmounts
      prevAttemptRef.current = 0;
    };
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
    activeModuleId,
    openReflectionBeforeResults,
    safeSetTimeout,
  ]);

  // ─── Play Sound ────────────────────────────────────────────────────────────
  const playSound = () => {
    if (!audioRef.current || !currentQuestion) {
      console.error("❌ Audio ref or question missing");
      return;
    }

    //  Stop current playback to prevent overlap
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Determine audio file based on module type
    let audioFile = null;

    if (moduleConfig.type === "phoneme") {
      // Module 1: Phoneme
      audioFile = currentQuestion.phonemeAudio;
    } else if (moduleConfig.type === "kvk") {
      // Module 2: KVK Word Building
      audioFile = currentQuestion.wordAudio || `${currentQuestion.word}.mp3`;
    } else if (moduleConfig.type === "rhyme") {
      // Module 3: Rhyme - plays the BASE WORD
      audioFile =
        currentQuestion.wordAudio || `${currentQuestion.baseWord}.mp3`;
    }

    if (!audioFile) {
      console.error("❌ No audio file found for question:", currentQuestion);
      return;
    }

    console.log(`🔊 Playing audio: /audio/${audioFile}`);

    audioRef.current.src = `/audio/${audioFile}`;
    audioRef.current.play().catch((error) => {
      console.error("Audio playback failed:", error);
      console.error("Attempted to play:", `/audio/${audioFile}`);
    });
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
    <div className={`learning-interface module-${activeModuleId}`}>
      <audio ref={audioRef} hidden />
      <audio ref={feedbackAudioRef} hidden />
       

      {/* ✅ Error Banner */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

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
            {/* 🔍 Mirror Confusion Alert */}
            {sessionState?.lastAttempt?.isMirrorConfusion && (
              <div className="mirror-alert">
                <div className="mirror-header">
                  <span className="icon">⚠️</span>
                  <h3>Huruf Ini Kelihatan Hampir Sama!</h3>
                </div>

                <div className="letter-comparison">
                  <div className="letter-box wrong">
                    <div className="big-letter">
                      {(
                        sessionState.lastAttempt.scannedLetter || "?"
                      ).toLowerCase()}
                    </div>
                    <div className="label">Kamu pilih</div>
                  </div>

                  <div className="vs">↔️</div>

                  <div className="letter-box correct">
                    <div className="big-letter">
                      {(
                        sessionState.lastAttempt.expectedLetter || "?"
                      ).toLowerCase()}
                    </div>
                    <div className="label">Jawapan betul</div>
                  </div>
                </div>

                <div className="hint-box">
                  {(() => {
                    const letter = sessionState.lastAttempt.expectedLetter?.toLowerCase();
                    const hints = {
                      b: ' Huruf "b" mempunyai perut di sebelah KANAN',
                      d: ' Huruf "d" mempunyai perut di sebelah KIRI',
                      p: ' Huruf "p" mempunyai kaki turun ke BAWAH',
                      q: ' Huruf "q" mempunyai ekor turun di KANAN',
                      m: ' Huruf "m" seperti gunung - dua puncak ke ATAS',
                      w: ' Huruf "w" seperti lembah - dua cerun ke BAWAH',
                      n: ' Huruf "n" garis naik ke KANAN',
                      u: ' Huruf "u" seperti mangkuk terbuka',
                    };
                    return hints[letter] || "";
                  })()}
                </div>

                <p className="try-again"> Cuba lagi dengan teliti!</p>
              </div>
            )}

            {!showHint &&
              !showAnswer &&
              !feedback &&
              !sessionState?.lastAttempt?.isMirrorConfusion && (
                <div className="discovery-mode animate-fade-in">
                  <p className="q-instruction">
                    Dengar bunyi dan pilih huruf yang betul
                  </p>
                  <button className="massive-speaker-button" onClick={playSound}>
                    ▶
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
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <button className="mini-speaker-button" onClick={playSound}>
                    Dengar semula
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
                  {currentQuestion.correctLetter}
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
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <button className="mini-speaker-button" onClick={playSound}>
                    🔊 Dengar perkataan
                  </button>

                  <p className="q-instruction">
                    Lihat gambar dan bina perkataan menggunakan blok huruf
                  </p>
                  <div className="letter-slots">
                    {(currentQuestion.letters || []).map((letter, i) => (
                      <div
                        key={i}
                        className={`letter-slot ${
                          placedLetters[i] ? "filled" : "empty"
                        }`}
                      >
                        {placedLetters[i]
                          ? placedLetters[i]
                          : "_"}
                      </div>
                    ))}
                  </div>
                  <p className="waiting-text">
                    Letakkan blok huruf satu persatu
                  </p>
                  {showHint && (
                    <div className="kvk-hint">
                      💡 {currentQuestion.hintText}
                    </div>
                  )}
                </div>
              </div>
            )}

            {showAnswer && (
              <div className="answer-mode animate-glow">
                <p className="instruction-text">Jawapannya ialah:</p>
                <div className="kvk-answer-display">
                  {(currentQuestion.letters || []).map((letter, i) => (
                    <div key={i} className="answer-letter-block">
                      {letter}
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
                      {currentQuestion.baseWord}
                    </span>
                  </div>
                  <div className="arrow-right">→</div>
                  <div className="target-word-card">
                    <span className="target-word">
                      <span className="unknown-letter">?</span>
                      <span className="known-ending">
                        {currentQuestion.rhymePattern
                          ?.replace("-", "")
                          }
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
                      {currentQuestion.baseWord}
                    </span>
                  </div>
                  <div className="arrow-right">→</div>
                  <div className="target-word-card">
                    <span className="target-word">
                      <span className="unknown-letter">?</span>
                      <span className="known-ending">
                        {currentQuestion.rhymePattern
                          ?.replace("-", "")
                         }
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
                        {answer.letter}
                      </div>

                      <p className="answer-word">
                        {answer.word}
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
              {getEncouragementMessage(feedback.type, feedback.attempts)}
            </p>
            {feedback.type === "correct" && (
              <>
                <p className="feedback-points">+{feedback.points} mata!</p>
                <div className="confetti">🎉🎊✨</div>
              </>
            )}
            {feedback.type === "wrong" && feedback.attempts < 4 && (
              <p className="feedback-attempts">
                Cuba ke-{feedback.attempts}/4
              </p>
            )}
          </div>
        )}
      </div>

      {showReflection && (
        <div className="reflection-overlay">
          <div className="reflection-card">
            <span className="reflection-kicker">Sebelum tamat</span>
            <h2>Aktiviti mana paling terasa hari ini?</h2>
            <p>
              Pilih satu perasaan. Ini membantu guru faham pengalaman belajar
              kamu.
            </p>

            <div className="reflection-options">
              <button
                type="button"
                onClick={() => saveReflectionAndContinue("easy")}
              >
                <span>🙂</span>
                Senang
              </button>
              <button
                type="button"
                onClick={() => saveReflectionAndContinue("okay")}
              >
                <span>😐</span>
                Biasa
              </button>
              <button
                type="button"
                onClick={() => saveReflectionAndContinue("hard")}
              >
                <span>😣</span>
                Susah
              </button>
            </div>
          </div>
        </div>
      )}

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