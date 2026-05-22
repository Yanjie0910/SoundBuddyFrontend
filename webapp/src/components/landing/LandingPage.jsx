import React from 'react';
import './LandingPage.css';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  const goTo = (role, path) => {
    if (role === 'student') {
      document.body.classList.add('student-mode');
    } else {
      document.body.classList.remove('student-mode');
    }

    localStorage.setItem('userRole', role);
    navigate(path);
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="/images/objects/mascot.svg" alt="PhonoBuddy Mascot" />
          <span>PhonoBuddy</span>
        </div>

        <div className="landing-nav-actions">
          <button onClick={() => goTo('student', '/student-login')}>Pelajar</button>
          <button onClick={() => goTo('teacher', '/teacher-login')}>Guru</button>
          <button onClick={() => goTo('parent', '/parent-login')}>Ibu Bapa</button>
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-text">

            <h1>
              Belajar fonik dengan <span>PhonoBuddy</span>
            </h1>

            <p>
              PhonoBuddy membantu murid belajar bunyi huruf, membina kata dan mengenal rima
              melalui aktiviti interaktif yang dipantau oleh guru dan ibu bapa.
            </p>

            
          </div>

          <div className="landing-hero-visual">
            <img src="/images/objects/mascot.svg" alt="PhonoBuddy Mascot" />
          </div>
        </section>

        <section className="role-wrapper">
          <div className="role-title">
            <h2>Pilih Peranan Anda</h2>
          </div>

          <div className="role-section">
            <div className="role-card student" onClick={() => goTo('student', '/student-login')}>
              <img src="/images/objects/student.png" alt="Student" />
              <div className="role-info">
                <h2>Saya Seorang Pelajar</h2>
              </div>
              <div className="role-arrow">›</div>
            </div>

            <div className="role-card teacher" onClick={() => goTo('teacher', '/teacher-login')}>
              <img src="/images/objects/teacher.png" alt="Teacher" />
              <div className="role-info">
                <h2>Saya Seorang Guru</h2>
              </div>
              <div className="role-arrow">›</div>
            </div>

            <div className="role-card parent" onClick={() => goTo('parent', '/parent-login')}>
              <img src="/images/objects/parent.png" alt="Parent" />
              <div className="role-info">
                <h2>Saya Seorang Ibu Bapa</h2>
              </div>
              <div className="role-arrow">›</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;