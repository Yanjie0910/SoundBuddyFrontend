import React from 'react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <h1>Selamat Datang ke RakanBunyi!</h1>

      <div className="role-cards">
        {/* Student */}
        <div
          className="role-card"
          onClick={() => {
            document.body.classList.add("student-mode");
            localStorage.setItem("userRole", "student");
            navigate("/student-login");
          }}
        >
          <img src="/images/objects/student.png" alt="Student" />
          <h2>Saya Seorang Pelajar</h2>
        </div>

        {/* Teacher */}
        <div
          className="role-card"
          onClick={() => {
            document.body.classList.remove("student-mode");
            localStorage.setItem("userRole", "teacher");
            navigate("/teacher-login");
          }}
        >
          <img src="/images/objects/teacher.png" alt="Teacher" />
          <h2>Saya Seorang Guru</h2>
        </div>

        {/* Parent */}
        <div
          className="role-card"
          onClick={() => {
            document.body.classList.remove("student-mode");
            localStorage.setItem("userRole", "parent");
            navigate("/parent-login");
          }}
        >
          <img src="/images/objects/parent.png" alt="Parent" />
          <h2>Saya Seorang Ibu Bapa</h2>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
