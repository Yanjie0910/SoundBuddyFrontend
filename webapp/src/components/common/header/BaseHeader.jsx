import React from "react";
import { useNavigate } from "react-router-dom";
import "./BaseHeader.css";

function BaseHeader({ showBack = false }) {
  const navigate = useNavigate();

  const goTo = (role, path) => {
    if (role === "student") {
      document.body.classList.add("student-mode");
    } else {
      document.body.classList.remove("student-mode");
    }

    localStorage.setItem("userRole", role);
    navigate(path);
  };

  return (
    <nav className="base-header">
      <div className="base-brand" onClick={() => navigate("/")}>
        <img src="/images/objects/mascot.svg" alt="PhonoBuddy Mascot" />
        <span>PhonoBuddy</span>
      </div>

      <div className="base-header-actions">
        <button onClick={() => goTo("student", "/student-login")}>Pelajar</button>
        <button onClick={() => goTo("teacher", "/teacher-login")}>Guru</button>
        <button onClick={() => goTo("parent", "/parent-login")}>Ibu Bapa</button>

        {showBack && (
          <button className="base-back-btn" onClick={() => navigate("/")}>
            ← Kembali
          </button>
        )}
      </div>
    </nav>
  );
}

export default BaseHeader;