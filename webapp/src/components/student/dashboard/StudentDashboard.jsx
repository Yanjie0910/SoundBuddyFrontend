import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';
import StudentHeader from '../../common/header/StudentHeader';
import './StudentDashboard.css';

const MODULES = [
  {
    id: 1,
    key: 'module1',
    name: 'Bunyi & Huruf',
    description: 'Kenali bunyi dan huruf Bahasa Melayu',
    color: '#FF8C69',
    emoji: '🔤',
    badge: { id: 'detektif_bunyi', name: 'Detektif Bunyi' },
    mascotBg: '#FFD4C2',
  },
  {
    id: 2,
    key: 'module2',
    name: 'Bina Kata',
    description: 'Bina perkataan KVK Bahasa Melayu',
    color: '#5BA4CF',
    emoji: '🧩',
    badge: { id: 'misi_kata', name: 'Misi Kata' },
    mascotBg: '#C2DFFF',
  },
  {
    id: 3,
    key: 'module3',
    name: 'Keluarga Kata',
    description: 'Kenali corak rima dalam Bahasa Melayu',
    color: '#5DB87A',
    emoji: '🎵',
    badge: { id: 'cari_rima', name: 'Cari Rima' },
    mascotBg: '#C2F0D2',
  },
];

// Badge modal details
const BADGE_DETAILS = {
  detektif_bunyi: {
    image: '/images/badge/detektif-bunyi.png',
    color: '#FF8C69',
    colorLight: '#FFF0EB',
    about: 'Anugerah ini diberikan kepada kamu kerana telah menyelesaikan aktiviti Bunyi & Huruf dengan jayanya!',
    achievements: [
      { icon: '🔊', text: 'Mengenal pasti bunyi awal dengan tepat' },
      { icon: '🔤', text: 'Memadankan bunyi dengan huruf yang betul' },
      { icon: '✅', text: 'Melengkapkan semua aktiviti dalam modul ini' },
    ],
    tahniah: 'Kemahiran ini adalah langkah pertama menjadi Pakar Fonik yang hebat!',
  },
  misi_kata: {
    image: '/images/badge/misi-kata.png',
    color: '#5BA4CF',
    colorLight: '#EBF5FF',
    about: 'Anugerah ini diberikan kepada kamu kerana telah berjaya membina perkataan KVK dengan jayanya!',
    achievements: [
      { icon: '🧩', text: 'Menyusun blok huruf dengan betul' },
      { icon: '📝', text: 'Membina perkataan KVK Bahasa Melayu' },
      { icon: '✅', text: 'Melengkapkan semua aktiviti dalam modul ini' },
    ],
    tahniah: 'Kamu sudah boleh membina perkataan sendiri. Hebat sekali!',
  },
  cari_rima: {
    image: '/images/badge/cari-rima.png',
    color: '#5DB87A',
    colorLight: '#EDFBF2',
    about: 'Anugerah ini diberikan kepada kamu kerana telah menguasai corak rima Bahasa Melayu dengan jayanya!',
    achievements: [
      { icon: '🎶', text: 'Mengenal corak rima dalam perkataan' },
      { icon: '🔄', text: 'Menukar huruf pertama untuk membentuk rima' },
      { icon: '✅', text: 'Melengkapkan semua aktiviti dalam modul ini' },
    ],
    tahniah: 'Kamu sudah menjadi juara rima! Teruskan semangat belajar!',
  },
  pakar_fonik: {
    image: '/images/badge/pakar-fonik.png',
    color: '#9B59B6',
    colorLight: '#FAF0FF',
    about: 'Tahniah! Kamu telah menyelesaikan SEMUA modul pembelajaran Fonik Bahasa Melayu!',
    achievements: [
      { icon: '🐢', text: 'Menyelesaikan modul Bunyi & Huruf' },
      { icon: '🐧', text: 'Menyelesaikan modul Bina Kata' },
      { icon: '🦊', text: 'Menyelesaikan modul Keluarga Kata' },
    ],
    tahniah: 'Kamu kini adalah seorang Pakar Fonik! Sijil telah diperoleh!',
  },
};

function BadgeModal({ badge, module, earned, earnedAt, onClose }) {
  const details = BADGE_DETAILS[badge.id] || BADGE_DETAILS['detektif_bunyi'];
  const earnedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString('ms-MY', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="sd-modal-overlay" onClick={onClose}>
      <div
        className="sd-modal"
        style={{ '--modal-color': details.color, '--modal-light': details.colorLight }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button className="sd-modal-close" onClick={onClose}>✕</button>

        <div className="sd-modal-body">
          {/* Left: Badge visual */}
          <div className="sd-modal-left">
            <div className="sd-modal-badge-circle">
              <img src={details.image} alt={badge.name} className="sd-modal-badge-image" />            </div>
            <div className="sd-modal-badge-title">{badge.name}</div>
            {module && <div className="sd-modal-badge-module">{module}</div>}
            {earned && earnedDate && (
              <div className="sd-modal-earned-date">
                <span>⭐</span>
                <div>
                  <div className="sd-modal-date-label">Tarikh diperoleh</div>
                  <div className="sd-modal-date-val">{earnedDate}</div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="sd-modal-right">
            <div className="sd-modal-section-tag">Tentang Lencana </div>
            <p className="sd-modal-about">{details.about}</p>

            <div className="sd-modal-divider"></div>

            <div className="sd-modal-achievements-title">Apa yang telah dicapai?</div>
            <div className="sd-modal-achievements">
              {details.achievements.map((a, i) => (
                <div key={i} className="sd-modal-achievement-item">
                  <div className="sd-modal-achievement-icon">{a.icon}</div>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>

            <div className="sd-modal-divider"></div>

            <div className="sd-modal-tahniah">
              <div className="sd-modal-tahniah-icon">🏆</div>
              <div>
                <div className="sd-modal-tahniah-title">Tahniah!</div>
                <div className="sd-modal-tahniah-text">{details.tahniah}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [progress, setProgress] = useState({});
  const [badges, setBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('studentSession');
    if (!stored) { navigate('/student-login'); return; }
    setSession(JSON.parse(stored));
    setTimeout(() => setAnimateIn(true), 100);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    const { studentId, teacherId } = session;
    const unsubProgress = onValue(
      ref(database, `teachers/${teacherId}/students/${studentId}/progress`),
      (snap) => setProgress(snap.val() || {})
    );
    const unsubBadges = onValue(
      ref(database, `teachers/${teacherId}/students/${studentId}/badges`),
      (snap) => { setBadges(snap.val() || {}); setLoading(false); }
    );
    return () => { unsubProgress(); unsubBadges(); };
  }, [session]);

  if (!session || loading) {
    return (
      <div className="sd-loading-screen">
        <div className="sd-loading-bear">🐻</div>
        <p>Memuatkan papan pemuka...</p>
        <div className="sd-loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    );
  }

  const { studentName } = session;

  const getModuleProgress = (moduleKey) => {
    const modProgress = progress[moduleKey];
    if (!modProgress) return { completed: 0, total: 5, correct: 0, points: 0 };
    const questionRecords = Object.entries(modProgress)
      .filter(([key, value]) => key.startsWith('q') && typeof value === 'object')
      .map(([, value]) => value);
    const completed = questionRecords.length;
    const correct = questionRecords.filter((q) => q.isCorrect).length;
    const points = questionRecords.reduce((sum, q) => sum + (q.points || 0), 0);
    return { completed, total: 5, correct, points };
  };

  const totalPoints = MODULES.reduce((sum, m) => sum + getModuleProgress(m.key).points, 0);
  const earnedBadges = Object.values(badges).filter((b) => b?.earned);
  const allModulesDone = earnedBadges.length >= 3;

  const isModuleUnlocked = (moduleId) => {
    if (moduleId === 1) return true;
    const prev = MODULES[moduleId - 2];
    return badges[prev.badge.id]?.earned === true;
  };

  const getModuleStatus = (module) => {
    const unlocked = isModuleUnlocked(module.id);
    const prog = getModuleProgress(module.key);
    if (!unlocked) return 'locked';
    if (prog.completed >= prog.total) return 'completed';
    if (prog.completed > 0) return 'in-progress';
    return 'available';
  };

  const handleModuleClick = (module) => {
    const status = getModuleStatus(module);
    const prog = getModuleProgress(module.key);
    if (status === 'locked') return;
    if (prog.completed >= prog.total) { navigate(`/minigame/${module.id}`); return; }
    navigate(`/instruction/${module.id}`);
  };

  const statusLabel = {
    locked: '🔒 Terkunci',
    available: 'Tersedia',
    'in-progress': 'Dalam Proses',
    completed: '✓ Selesai',
  };

  const handleBadgeClick = (badgeId, module, earned) => {
    if (!earned) return; // only open modal for earned badges
    setSelectedBadge({ id: badgeId, name: BADGE_DETAILS[badgeId] ? (badgeId === 'pakar_fonik' ? 'Pakar Fonik' : module?.badge?.name || badgeId) : badgeId, module: module?.name, earnedAt: badges[badgeId]?.earnedAt });
  };

  return (
    <>
      <StudentHeader studentName={studentName} />
      <div className={`sd-container ${animateIn ? 'animate-in' : ''}`}>

        {/* ── WELCOME HERO ── */}
        <div className="sd-hero">
          <div className="sd-hero-left">
            <img src="/images/objects/mascot.svg" alt="Teddy Mascot" className="sd-hero-mascot-img" />
            <div className="sd-hero-text">
              <p className="sd-hero-greeting">Selamat Datang,</p>
              <h1 className="sd-hero-name">{studentName}!</h1>
              <p className="sd-hero-sub">
                Teruskan perjalanan fonik kamu dan jadi{' '}
                <span className="sd-highlight">juara bunyi!</span>
              </p>
            </div>
          </div>
          <div className="sd-hero-stats">
            <div className="sd-stat-card sd-stat-star">
              <div className="sd-stat-icon">⭐</div>
              <div className="sd-stat-val">{totalPoints}</div>
              <div className="sd-stat-lbl">MATA</div>
            </div>
            <div className="sd-stat-card sd-stat-badge">
              <div className="sd-stat-icon">🛡️</div>
              <div className="sd-stat-val">{earnedBadges.length}/3</div>
              <div className="sd-stat-lbl">LENCANA</div>
            </div>
          </div>
        </div>

        {/* ── CERTIFICATE BANNER ── */}
        {allModulesDone && (
          <div className="sd-cert-banner" onClick={() => navigate('/certificate')}>
            <div>
              <strong>Tahniah! Kamu telah menjadi Pakar Fonik!</strong>
              <p>Klik untuk lihat sijil kamu →</p>
            </div>
          </div>
        )}

        {/* ── MODULES ── */}
        <section className="sd-section">
          <div className="sd-section-header">
            <h2>Modul Pembelajaran</h2>
          </div>
          <div className="sd-modules-grid">
            {MODULES.map((module, idx) => {
              const status = getModuleStatus(module);
              const prog = getModuleProgress(module.key);
              const badgeEarned = badges[module.badge.id]?.earned;
              const pct = Math.round((prog.completed / prog.total) * 100);
              const isLocked = status === 'locked';
              const isDone = status === 'completed';

              return (
                <div
                  key={module.id}
                  className={`sd-module-card ${status}`}
                  style={{ '--mod-color': module.color, '--mod-mascot': module.mascotBg, animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="sd-card-stripe"></div>
                  <div className="sd-card-top">
                    {!isLocked && prog.points > 0 && (
                      <div className="sd-points-chip">⭐ {prog.points}</div>
                    )}
                    <div className={`sd-status-pill ${status}`}>{statusLabel[status]}</div>
                  </div>
                  <div className="sd-card-mascot-row">
                    <div className="sd-card-mascot">{module.emoji}</div>
                    <div className="sd-card-title-group">
                      <h3>{module.name}</h3>
                      <p>{module.description}</p>
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="sd-card-progress">
                      <div className="sd-prog-track">
                        <div className="sd-prog-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="sd-prog-label">{prog.completed}/{prog.total} soalan • {prog.points} mata</span>
                    </div>
                  )}
                  {badgeEarned ? (
                    <div className="sd-badge-chip">🏆 {module.badge.name}</div>
                  ) : (
                    <div className="sd-badge-spacer" />
                  )}
                  {isLocked ? (
                    <div className="sd-locked-msg">Selesaikan modul sebelum ini dahulu untuk buka modul ini!</div>
                  ) : (
                    <button className={`sd-module-btn ${isDone ? 'done' : 'go'}`} onClick={() => handleModuleClick(module)}>
                      {isDone ? 'Main Mini Game' : prog.completed > 0 ? 'Teruskan' : ' Mula'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── BADGES ── */}
        <section className="sd-section">
          <div className="sd-section-header">
            <h2>Lencana Pencapaian</h2>
            {earnedBadges.length > 0 && (
              <span className="sd-badge-hint">Klik lencana untuk lihat!</span>
            )}
          </div>

          <div className="sd-badges-grid">
            {MODULES.map((module) => {
              const earned = badges[module.badge.id]?.earned;
              return (
                <div
                  key={module.badge.id}
                  className={`sd-badge-card ${earned ? 'earned' : 'locked'} ${earned ? 'clickable' : ''}`}
                  style={{ '--badge-color': module.color }}
                  onClick={() => handleBadgeClick(module.badge.id, module, earned)}
                >
                  <div className="sd-badge-image-wrap">
  <img
    src={
      module.badge.id === 'detektif_bunyi'
        ? '/images/badge/detektif-bunyi.png'
        : module.badge.id === 'misi_kata'
        ? '/images/badge/misi-kata.png'
        : '/images/badge/cari-rima.png'
    }
    alt={module.badge.name}
    className={`sd-badge-image ${earned ? '' : 'locked'}`}
  />
</div>
                  <div className="sd-badge-name">{module.badge.name}</div>
                  <div className="sd-badge-desc">{module.name}</div>
                  {earned
                    ? <div className="sd-badge-earned-tag">Diperoleh ✓</div>
                    : <div className="sd-badge-locked-tag">Belum diperoleh</div>
                  }
                </div>
              );
            })}

            {/* Pakar Fonik */}
            <div
              className={`sd-badge-card ${allModulesDone ? 'earned special clickable' : 'locked'}`}
              style={{ '--badge-color': '#9B59B6' }}
              onClick={() => handleBadgeClick('pakar_fonik', null, allModulesDone)}
            >
              <div className="sd-badge-image-wrap">
  <img
    src="/images/badge/pakar-fonik.png"
    alt="Pakar Fonik"
    className={`sd-badge-image ${allModulesDone ? '' : 'locked'}`}
  />
</div>
              <div className="sd-badge-name">Pakar Fonik</div>
              <div className="sd-badge-desc">Semua Modul</div>
              {allModulesDone
                ? <div className="sd-badge-earned-tag">Sijil Diperoleh ✓</div>
                : <div className="sd-badge-locked-tag">Belum diperoleh</div>
              }
            </div>
          </div>
        </section>

      </div>

      {/* ── BADGE MODAL ── */}
      {selectedBadge && (
        <BadgeModal
          badge={{ id: selectedBadge.id, name: selectedBadge.name }}
          module={selectedBadge.module}
          earned={true}
          earnedAt={selectedBadge.earnedAt}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </>
  );
}

export default StudentDashboard;