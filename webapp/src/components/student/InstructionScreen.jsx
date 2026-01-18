import React, { useEffect, useState } from 'react';
import './InstructionScreen.css';

function InstructionScreen({ onComplete }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Auto-advance after 5 seconds
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete(); // Move to Question 1
    }
  }, [countdown, onComplete]);

  return (
    <div className="instruction-screen">
      <div className="instruction-card">
        
        <div className="module-title">
          <h1>📚 Module 1</h1>
          <h2>Letter-Sound Explorer</h2>
        </div>

        <div className="instructions">
          <h3>How to Play:</h3>
          
          <div className="instruction-item">
            <span className="step-number">1</span>
            <p>🔊 Click the speaker to hear the sound</p>
          </div>

          <div className="instruction-item">
            <span className="step-number">2</span>
            <p>🎯 Place the correct letter block on the reader</p>
          </div>

          <div className="instruction-item">
            <span className="step-number">3</span>
            <p>✨ Get instant feedback!</p>
          </div>
        </div>

        <div className="countdown">
          <p>Starting in <strong>{countdown}</strong> seconds...</p>
          <button className="skip-button" onClick={onComplete}>
            Skip →
          </button>
        </div>

      </div>
    </div>
  );
}

export default InstructionScreen;