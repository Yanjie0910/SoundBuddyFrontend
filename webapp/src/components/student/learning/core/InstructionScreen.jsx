import React, { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { database } from "../../../../firebase";
import "./InstructionScreen.css";

function InstructionScreen() {
  const navigate = useNavigate();
  const { type, moduleId } = useParams();

  const [instructionData, setInstructionData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isMiniGame = type === "minigame";

  useEffect(() => {
    const loadInstruction = async () => {
      try {
        const path = isMiniGame
          ? `minigames/module${moduleId}`
          : `modules/module${moduleId}/moduleInfo`;

        const snap = await get(ref(database, path));

        if (snap.exists()) {
          setInstructionData(snap.val());
        }
      } catch (error) {
        console.error("Instruction load error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInstruction();
  }, [isMiniGame, moduleId]);

  const handleStart = () => {
    navigate(isMiniGame ? `/minigame/${moduleId}` : `/learning/${moduleId}`);
  };

  if (loading) {
    return (
      <div className="instruction-loading">
        <div className="inst-spinner">📚</div>
        <h2>Memuatkan arahan...</h2>
      </div>
    );
  }

  if (!instructionData) {
    return (
      <div className="instruction-loading">
        <h2>Arahan tidak dijumpai</h2>
        <button onClick={() => navigate("/student-dashboard")}>Kembali</button>
      </div>
    );
  }

  const title =
    instructionData.instructionTitle ||
    instructionData.moduleName ||
    instructionData.gameName ||
    "Arahan";

  const moduleName =
    instructionData.moduleName ||
    instructionData.gameName ||
    (isMiniGame ? "Mini Game" : "Pembelajaran");

  const description = instructionData.description || "";
  const instructions = instructionData.instructions || instructionData.steps || [];

  const buttonText =
    instructionData.readyButtonText ||
    instructionData.startButtonText ||
    "Saya Bersedia!";

  return (
    <div className="instruction-screen">
      <div className="instruction-header">
        <button className="inst-top-back" onClick={() => navigate("/student-dashboard")}>
          ← Kembali
        </button>

        <div className="inst-header-tag">
          {isMiniGame ? "Mini Game" : moduleName}
        </div>
      </div>

      <main className="instruction-card">
        <div className="inst-icon-circle">
          {isMiniGame ? "🎮" : "📖"}
        </div>

        <p className="inst-small-label">
          {isMiniGame ? "Arahan Mini Game" : "Arahan Pembelajaran"}
        </p>

        <h1 className="inst-title">{title}</h1>

        {description && <p className="inst-desc">{description}</p>}

        <section className="inst-how-to">
          <h3>Cara bermain</h3>

          <ol className="inst-steps">
            {instructions.map((step, index) => (
              <li className="inst-step" key={index}>
                <span className="step-num">{index + 1}</span>
                <span className="step-text">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="inst-rfid-demo">
          <div className="demo-block">A</div>
          <span className="demo-arrow">→</span>
          <span className="demo-reader">📡</span>
          <span className="demo-arrow">→</span>
          <span className="demo-feedback">✅</span>
        </div>

        <button className="inst-ready-btn" onClick={handleStart}>
          {buttonText}
        </button>
      </main>
    </div>
  );
}

export default InstructionScreen;