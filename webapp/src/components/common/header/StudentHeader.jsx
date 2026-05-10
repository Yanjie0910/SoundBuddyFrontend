import React from "react";
import { useNavigate } from "react-router-dom";
import "./StudentHeader.css";

function StudentHeader({ studentName }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("studentSession");
    document.body.classList.remove("student-mode");
    navigate("/");
  };

  return (
    <nav className="student-nav">
      <div className="student-nav-left">
        <span>RakanBunyi</span>
      </div>

      <div className="student-nav-center">
        Hi, {studentName} !
      </div>

      <div className="student-nav-right">
      
        <button className="logout-btn" onClick={handleLogout}>
          Log Keluar
        </button>
      </div>
    </nav>
  );
}

export default StudentHeader;
