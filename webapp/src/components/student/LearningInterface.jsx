import React, { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, get, update } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { database } from "../../firebase/index";
import './LearningInterface.css';

function LearningInterface() {
  const navigate = useNavigate();
  
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);  // ✅ TRACK THE ACTUAL KEY
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionState, setSessionState] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [session, setSession] = useState(null);
  
  const audioRef = useRef(null);
  const feedbackAudioRef = useRef(null);

  // ✅ READ FROM LOCALSTORAGE
  useEffect(() => {
    const stored = localStorage.getItem('studentSession');
    if (!stored) {
      alert('Please log in first!');
      navigate('/student-login');
      return;
    }
    const sessionData = JSON.parse(stored);
    console.log('📍 Loaded session from localStorage:', sessionData);
    setSession(sessionData);
  }, [navigate]);

  // Get IDs from session
  const studentId = session?.studentId;
  const teacherId = session?.teacherId;
  const classId = session?.classId;
  const studentName = session?.studentName;
  
  // Firebase paths
  const sessionPath = studentId && teacherId 
    ? `teachers/${teacherId}/students/${studentId}/currentSession`
    : null;

  // Clear all feedback states
  const clearAllStates = useCallback(() => {
    console.log('🧹 Clearing all states');
    setFeedback(null);
    setShowHint(false);
    setShowAnswer(false);
    setIsTransitioning(false);
  }, []);

  // ✅ Update currentQuestion in Firebase
  const updateCurrentQuestionInFirebase = useCallback(async (questionId) => {
    if (!database || !studentId || !teacherId || !sessionPath) {
      console.error('❌ Missing required IDs:', { studentId, teacherId });
      return;
    }
    
    console.log('📤 Updating Firebase currentQuestion to:', questionId);
    
    try {
      const sessionRef = ref(database, sessionPath);
      await update(sessionRef, {
        currentQuestion: questionId,
        showAnswer: false,
        showHint: false,
        lastAttempt: {
          attemptNumber: 0,
          isCorrect: false
        }
      });
      console.log('✅ Firebase updated!');
    } catch (error) {
      console.error('❌ Firebase update failed:', error);
    }
  }, [database, studentId, teacherId, sessionPath]);

  // Load question function
  const loadQuestion = useCallback(async (questionId) => {
    if (!database) return;
    
    console.log('🔍 Loading question:', questionId);
    
    setIsTransitioning(true);
    clearAllStates();
    setCurrentQuestionId(questionId);  // ✅ TRACK IT!
    
    try {
      const questionRef = ref(database, `modules/module1/questions/${questionId}`);
      const snapshot = await get(questionRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('✅ Question loaded:', data);
        
        setTimeout(() => {
          setCurrentQuestion(data);
          setIsTransitioning(false);
        }, 500);
        
        await updateCurrentQuestionInFirebase(questionId);
      }
    } catch (error) {
      console.error('Error loading question:', error);
      setIsTransitioning(false);
    }
  }, [updateCurrentQuestionInFirebase, clearAllStates]);

  // Get next question
  const getNextQuestion = useCallback((currentId) => {
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5'];
    console.log('🔍 getNextQuestion - currentId:', currentId);
    const currentIndex = questions.indexOf(currentId);
    console.log('🔍 currentIndex:', currentIndex);
    const nextQ = questions[currentIndex + 1] || null;
    console.log('🔍 nextQ:', nextQ);
    return nextQ;
  }, []);

  // Handle correct answer
  const handleCorrectAnswer = useCallback((attemptData) => {
    if (isTransitioning || !attemptData || attemptData.attemptNumber === 0) {
      console.log('⏭️ Skipping (transitioning or initial state)');
      return;
    }
    
    console.log('✅ Handling correct answer:', attemptData);
    
    setTimeout(() => {
      setFeedback({
        type: 'correct',
        points: attemptData.pointsAwarded
      });

      if (feedbackAudioRef.current) {
        feedbackAudioRef.current.src = '/audio/correct.mp3';
        feedbackAudioRef.current.play().catch(err => console.log('Audio error:', err));
      }

      setTimeout(() => {
        setFeedback(null);
        
        setTimeout(() => {
          const nextQ = getNextQuestion(currentQuestionId);  // ✅ USE TRACKED ID
          if (nextQ) {
            console.log('📝 Moving to next question:', nextQ);
            loadQuestion(nextQ);
          } else {
            console.log('🎉 Module complete!');
            alert('🎉 Module 1 Complete! You earned a Sound Detective Badge!');
            navigate('/student-dashboard');
          }
        }, 500);
      }, 1500);
    }, 500);
  }, [currentQuestionId, loadQuestion, getNextQuestion, isTransitioning, navigate]);

  // Handle wrong answer
  const handleWrongAnswer = useCallback((attemptData) => {
    if (isTransitioning || !attemptData || attemptData.attemptNumber === 0) {
      console.log('⏭️ Skipping (transitioning or initial state)');
      return;
    }
    
    console.log('❌ Handling wrong answer. Attempt:', attemptData.attemptNumber);

    if (attemptData.attemptNumber >= 4) {
      console.log('📢 4th attempt - will show answer');
      return;
    }
    
    setTimeout(() => {
      setFeedback({
        type: 'wrong',
        attempts: attemptData.attemptNumber
      });
      
      if (feedbackAudioRef.current) {
        feedbackAudioRef.current.src = '/audio/wrong.mp3';
        feedbackAudioRef.current.play().catch(err => console.log('Audio error:', err));
      }

      setTimeout(() => {
        setFeedback(null);
      }, 1000);
    }, 500);
  }, [isTransitioning]);

  // ✅ INITIALIZE SESSION
  // FIXED: INITIALIZE OR RESUME SESSION
useEffect(() => {
  if (!session || !database || !sessionPath) return;

  const resumeOrInitializeSession = async () => {
    if (!studentId || !teacherId) {
      navigate('/student-login');
      return;
    }

    const sessionRef = ref(database, sessionPath);
    const snapshot = await get(sessionRef);

    // RESUME if session exists
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data.currentQuestion) {
        loadQuestion(data.currentQuestion);
        return;
      }
    }

    // INITIALIZE only if no session
    await update(sessionRef, {
      currentQuestion: 'q1',
      showAnswer: false,
      showHint: false,
      totalPoints: 0,
      lastAttempt: {
        attemptNumber: 0,
        isCorrect: false
      },
      startedAt: Date.now()
    });

    loadQuestion('q1');
  };

  resumeOrInitializeSession();
}, [session, database, sessionPath, studentId, teacherId, navigate, loadQuestion]);


  // ✅ LISTEN TO FIREBASE
  useEffect(() => {
    if (!database || !studentId || !teacherId || !sessionPath) {
      console.log('⚠️ Missing required data for Firebase listener');
      return;
    }

    console.log('🔥 Setting up Firebase listener at:', sessionPath);
    
    const sessionRef = ref(database, sessionPath);
    let previousAttemptNumber = 0;

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log('⚠️ Session does not exist at:', sessionPath);
        return;
      }

      const data = snapshot.val();
      console.log('📡 Firebase update:', data);
      
      setSessionState(data);

      // ✅ ALWAYS process showAnswer immediately (don't block on isTransitioning)
      if (data.showAnswer && !showAnswer) {
        console.log('📢 Showing answer IMMEDIATELY');
        setShowAnswer(true);
        setFeedback(null);
        setShowHint(false);
        setIsTransitioning(false);  // ✅ Clear transition flag
        
        setTimeout(() => {
          const nextQ = getNextQuestion(currentQuestionId);
          if (nextQ) {
            console.log('📝 Auto-advancing to:', nextQ);
            loadQuestion(nextQ);
          } else {
            console.log('🎉 Module complete!');
            alert('🎉 Module 1 Complete!');
            navigate("/minigame/module1");
           }
        }, 3000);
        return;  // ✅ Exit early, don't process other updates
      }

      // Skip other updates if transitioning
      if (isTransitioning) {
        console.log('⏭️ Skipping update (transitioning)');
        return;
      }

      // Handle hint (3rd attempt)
      if (data.showHint && !showHint) {
        console.log('💡 Showing hint');
        setShowHint(true);
        setFeedback(null);
      }

      // Handle attempt result
      if (data.lastAttempt) {
        const currentAttempt = data.lastAttempt.attemptNumber;
        
        if (currentAttempt > previousAttemptNumber && currentAttempt > 0) {
          previousAttemptNumber = currentAttempt;
          
          if (data.lastAttempt.isCorrect) {
            handleCorrectAnswer(data.lastAttempt);
          } else {
            handleWrongAnswer(data.lastAttempt);
          }
        }
      }
    });

    return () => {
      console.log('🔌 Cleaning up Firebase listener');
      unsubscribe();
    };
  }, [database, studentId, teacherId, sessionPath, currentQuestionId, showHint, showAnswer, 
      handleCorrectAnswer, handleWrongAnswer, getNextQuestion, loadQuestion, isTransitioning, navigate]);

  // Play phoneme sound
  const playSound = () => {
    if (audioRef.current && currentQuestion) {
      console.log('🔊 Playing sound:', currentQuestion.phonemeAudio);
      audioRef.current.src = `/audio/${currentQuestion.phonemeAudio}`;
      audioRef.current.play().catch(err => {
        console.log('Audio play failed:', err);
        alert('🔊 Audio file not found. Check webapp/public/audio/');
      });
    }
  };

  // ✅ LOADING STATE
  if (!session) {
    return (
      <div className="loading">
        <h2>Loading session...</h2>
        <p>Reading login data...</p>
      </div>
    );
  }

  if (!studentId || !teacherId) {
    return (
      <div className="loading error">
        <h2>❌ Error: Missing Login Data</h2>
        <p>Please log in properly as a student.</p>
        <p>Required: Student ID, Teacher ID</p>
        <button onClick={() => navigate('/student-login')}>
          Go to Login
        </button>
      </div>
    );
  }

  if (!currentQuestion || isTransitioning) {
    return (
      <div className="loading">
        <h2>{isTransitioning ? 'Loading next question...' : 'Loading question...'}</h2>
        <p>Database: {database ? '✅ Connected' : '❌ Not connected'}</p>
        <p>Student: {studentName}</p>
        <p>Path: {sessionPath}</p>
        <div className="spinner">⏳</div>
      </div>
    );
  }

  return (
    <div className="learning-interface">
      <audio ref={audioRef} />
      <audio ref={feedbackAudioRef} />

      {/* Header */}
      <div className="learning-header">
        <div className="progress-bar">
          <div className="progress-info">
            <span>👤 {studentName}</span>
            <span>⭐ {sessionState?.totalPoints || 0} points</span>
            <span>Question {currentQuestion.questionNumber || 1} of 5</span>
          </div>
          <div className="progress-track">
            <div 
              className="progress-fill" 
              style={{ width: `${((currentQuestion.questionNumber || 1) / 5) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="question-container">
        
        {/* Phase 1: Discovery Mode */}
        {!showHint && !showAnswer && !feedback && (
          <div className="discovery-mode animate-fade-in">
            <button className="massive-speaker-button" onClick={playSound}>
              <span className="speaker-icon">🔊</span>
            </button>
            <p className="instruction-text">Click to hear the sound!</p>
          </div>
        )}

        {/* Phase 2: Hint Mode */}
        {showHint && !showAnswer && (
          <div className="hint-mode animate-pop">
            <div className="hint-card">
              <img 
                src={`/images/objects/${currentQuestion.visualCueImage}`} 
                alt="Hint" 
                className="real-photo-hint" 
                onError={(e) => {
                  console.error('Image failed to load:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
              <button className="mini-speaker-button" onClick={playSound}>
                🔊 Hear it again
              </button>
            </div>
            <p className="hint-text">{currentQuestion.hintText || "It starts like this!"}</p>
          </div>
        )}

        {/* Phase 3: Answer Mode */}
        {showAnswer && (
          <div className="answer-mode animate-glow">
            <p className="instruction-text">The answer is:</p>
            <div className="big-letter-display">
              {currentQuestion.correctLetter?.toUpperCase()}
            </div>
            <img 
              src={`/images/objects/${currentQuestion.visualCueImage}`} 
              alt="Answer" 
              className="answer-image"
              onError={(e) => {
                console.error('Answer image failed:', e.target.src);
                e.target.style.display = 'none';
              }}
            />
            <p className="hint-text">Moving to next question in 3 seconds...</p>
          </div>
        )}

        {/* Feedback Overlay */}
        {feedback && !showAnswer && (
          <div className={`feedback-animation feedback-${feedback.type}`}>
            <span className="feedback-icon">
              {feedback.type === 'correct' ? '✅' : '❌'}
            </span>
            <p className="feedback-message">
              {feedback.type === 'correct' ? 'You did it!' : 'Try again!'}
            </p>
            {feedback.type === 'correct' && (
              <>
                <p className="feedback-points">+{feedback.points} points!</p>
                <div className="confetti">🎉🎊✨</div>
              </>
            )}
            {feedback.type === 'wrong' && feedback.attempts < 4 && (
              <p className="feedback-attempts">Attempt {feedback.attempts}/4</p>
            )}
          </div>
        )}
      </div>

      {/* Waiting Indicator */}
      {!feedback && !showAnswer && (
        <div className="waiting-indicator">
          <div className="pulse-ring"></div>
          <span>Place your block on the reader</span>
        </div>
      )}
    </div>
  );
}

export default LearningInterface;
