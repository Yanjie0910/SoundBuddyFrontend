import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../../../../firebase';
import './CertificatePage.css';

function CertificatePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [badges, setBadges] = useState({});
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('studentSession');
    if (!stored) { navigate('/student-login'); return; }
    const s = JSON.parse(stored);
    setSession(s);
    onValue(ref(database, `teachers/${s.teacherId}/students/${s.studentId}/badges`),
      (snap) => setBadges(snap.val() || {}));
    onValue(ref(database, `teachers/${s.teacherId}/students/${s.studentId}/progress`),
      (snap) => { setProgress(snap.val() || {}); setLoading(false); });
  }, [navigate]);

  if (loading) return (
    <div className="cert-loading">
      <div className="cert-spinner">🎓</div>
      <p>Memuatkan sijil...</p>
    </div>
  );

  const allBadges = ['detektif_bunyi', 'misi_kata', 'cari_rima'];
  const allEarned = allBadges.every(b => badges[b]?.earned);
  const today = new Date().toLocaleDateString('ms-MY', { year: 'numeric', month: 'long', day: 'numeric' });

  const badgeDetails = [
    { id: 'detektif_bunyi', emoji: '🕵️', name: 'Detektif Bunyi', module: 'Bunyi & Huruf' },
    { id: 'misi_kata',      emoji: '⚡',  name: 'Misi Kata',      module: 'Bina Kata' },
    { id: 'cari_rima',      emoji: '🎵',  name: 'Cari Rima',      module: 'Keluarga Kata' },
  ];

  const getStats = () => {
  let totalQ = 0;
  let completedQ = 0;
  let totalPoints = 0;

  ['module1', 'module2', 'module3'].forEach(mod => {
    const modData = progress[mod] || {};

    Object.entries(modData).forEach(([key, val]) => {

      if (key.startsWith('q') && typeof val === 'object') {

        totalQ++;

        // count completed question
        if (
          val.completed ||
          val.completedLearning ||
          val.isCorrect !== undefined
        ) {
          completedQ++;
        }

        totalPoints += val.points || 0;
      }
    });
  });

  const accuracy =
    totalQ > 0
      ? Math.round((completedQ / totalQ) * 100)
      : 0;

  return {
    totalQ,
    completedQ,
    totalPoints,
    accuracy
  };
};
  const stats = getStats();
  

  return (
    <div className="cert-page">
      <div className="cert-actions">
        <button className="cert-back-btn" onClick={() => navigate('/student-dashboard')}>← Kembali</button>
        <button className="cert-print-btn" onClick={() => window.print()}> Cetak Sijil</button>
      </div>

      <div className="cert-container">
        <div className={`certificate ${allEarned ? 'unlocked' : 'locked'}`}>

          {/* Stars */}
          <div className="cert-star cert-star-tl">⭐</div>
          <div className="cert-star cert-star-tr">⭐</div>
          <div className="cert-rainbow-left">🌈</div>
          <div className="cert-rainbow-right">🌈</div>

          {/* Header */}
          <div className="cert-header">
            <div className="cert-school">
              {'RakanBunyi'.split('').map((c, i) => (
                <span key={i} style={{ color: ['#FF6B6B','#FF8E53','#FFD700','#4CAF50','#2196F3','#9C27B0','#FF6B6B','#FF8E53','#FFD700','#4CAF50'][i] }}>{c}</span>
              ))}
            </div>
            <div className="cert-subtitle">Sistem Pembelajaran Fonik Bahasa Melayu</div>
          </div>

          {/* Title banner */}
          <div className="cert-title-banner">SIJIL PENCAPAIAN</div>

          {/* Name */}
          <div className="cert-awarded-to">DIBERIKAN KEPADA</div>
          <div className="cert-name">{session?.studentName || '—'}</div>

          {/* Description */}
          <div className="cert-description">
            {allEarned ? (
              <>
                <p>Telah berjaya menyelesaikan semua modul Fonik Bahasa Melayu dan layak digelar</p>
                <div className="cert-pakar">Pakar Fonik </div>
              </>
            ) : (
              <p>Masih dalam perjalanan menyelesaikan semua modul...</p>
            )}
          </div>

          {/* Stats + Badges in one row */}
          <div className="cert-bottom-row">

            {/* Stats */}
            {allEarned && (
              <div className="cert-stats-box">
                <div className="cert-stat-item">
                  <span className="cert-stat-icon">🎯</span>
                  <span className="cert-stat-val">{stats.accuracy}%</span>
                  <span className="cert-stat-lbl">Skor</span>
                </div>
                <div className="cert-stat-divider"></div>
                <div className="cert-stat-item">
                  <span className="cert-stat-icon">📖</span>
                  <span className="cert-stat-val">{stats.completedQ}/{stats.totalQ}</span>
                  <span className="cert-stat-lbl">Soalan</span>
                </div>
                <div className="cert-stat-divider"></div>
                <div className="cert-stat-item">
                  <span className="cert-stat-icon">🏆</span>
                  <span className="cert-stat-val">{stats.totalPoints}</span>
                  <span className="cert-stat-lbl">Mata</span>
                </div>
              </div>
            )}

            {/* Badges */}
            <div className="cert-badges-row">
              {badgeDetails.map(b => (
                <div key={b.id} className={`cert-badge ${badges[b.id]?.earned ? 'earned' : 'locked'}`}>
                  <div className="cert-badge-emoji">{badges[b.id]?.earned ? b.emoji : '🔒'}</div>
                  <div className="cert-badge-name">{b.name}</div>
                  <div className="cert-badge-module">{b.module}</div>
                  {badges[b.id]?.earned && <div className="cert-badge-stars">⭐⭐⭐⭐⭐</div>}
                </div>
              ))}
              {allEarned && (
                <div className="cert-tahniah-chip">
                  <div>🏅</div>
                  <div className="cert-tahniah-title">TAHNIAH!</div>
                  <div className="cert-tahniah-sub">Teruskan usaha yang hebat!</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="cert-footer">
            <div className="cert-date-col">
              <div className="cert-date-val">{today}</div>
              <div className="cert-date-line"></div>
              <div className="cert-date-lbl">Tarikh</div>
            </div>
            <div className="cert-sig-col">
              <div className="cert-sig-name">Rakan Bunyi </div>
              <div className="cert-sig-line"></div>
              <div className="cert-sig-lbl">Guru Pembimbing</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default CertificatePage;