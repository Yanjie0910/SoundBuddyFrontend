import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './ParentDashboard.css';

const MODULES = [
  { id: 1, key: 'module1', name: 'Bunyi & Huruf', badge: 'detektif_bunyi', color: '#FF8C69' },
  { id: 2, key: 'module2', name: 'Bina Kata', badge: 'misi_kata', color: '#5BA4CF' },
  { id: 3, key: 'module3', name: 'Keluarga Kata', badge: 'cari_rima', color: '#5DB87A' },
];

const BADGE_IDS = {
  detektif_bunyi: { name: 'Detektif Bunyi', module: 'Bunyi & Huruf' },
  misi_kata: { name: 'Misi Kata', module: 'Bina Kata' },
  cari_rima: { name: 'Cari Rima', module: 'Keluarga Kata' },
};

const HOME_ACTIVITY_LIBRARY = {
  'b-d': {
    title: 'Latihan arah huruf b dan d',
    steps: [
      'Cari 3 objek di rumah yang bermula dengan bunyi “b”.',
      'Jejak huruf b dan d menggunakan jari di atas kertas.',
      'Bandingkan arah perut huruf b dan d secara perlahan.'
    ]
  },
  'd-b': {
    title: 'Latihan arah huruf d dan b',
    steps: [
      'Sebut bunyi huruf d dan b bersama-sama.',
      'Jejak kedua-dua huruf menggunakan jari.',
      'Minta anak tunjuk arah perut huruf sebelum menjawab.'
    ]
  },
  'p-q': {
    title: 'Latihan ekor huruf p dan q',
    steps: [
      'Tunjukkan huruf p dan q secara sebelah-menyebelah.',
      'Tanya anak di mana arah ekor huruf.',
      'Ulang dengan 5 kad huruf secara santai.'
    ]
  },
  'q-p': {
    title: 'Latihan ekor huruf q dan p',
    steps: [
      'Tunjukkan huruf q dan p secara sebelah-menyebelah.',
      'Minta anak ikut bentuk huruf dengan jari.',
      'Sebut bunyi huruf selepas anak memilih huruf yang betul.'
    ]
  },
  'm-w': {
    title: 'Latihan bentuk m dan w',
    steps: [
      'Bandingkan bentuk “bukit” pada m dan “lembah” pada w.',
      'Minta anak menelusuri bentuk huruf dengan jari.',
      'Cari perkataan mudah yang mengandungi m atau w.'
    ]
  },
  'w-m': {
    title: 'Latihan bentuk w dan m',
    steps: [
      'Bandingkan bentuk “lembah” pada w dan “bukit” pada m.',
      'Minta anak menelusuri bentuk huruf dengan jari.',
      'Ulang latihan pendek 5 minit sahaja.'
    ]
  },
  'n-u': {
    title: 'Latihan lengkungan n dan u',
    steps: [
      'Tunjukkan beza lengkungan n dan u.',
      'Jejak huruf menggunakan jari di udara.',
      'Minta anak pilih huruf yang disebut oleh ibu bapa.'
    ]
  },
  'u-n': {
    title: 'Latihan lengkungan u dan n',
    steps: [
      'Tunjukkan beza lengkungan u dan n.',
      'Jejak huruf menggunakan jari di udara.',
      'Gunakan kad huruf untuk latihan ringkas.'
    ]
  },
};


function ParentDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const [progress, setProgress] = useState({});
  const [badges, setBadges] = useState({});
  const [confusions, setConfusions] = useState({});

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let teachersUnsub = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/parent-login');
        return;
      }

      setUser(firebaseUser);

      teachersUnsub = onValue(ref(database, 'teachers'), (snap) => {
        const data = snap.val() || {};
        const matched = [];

        Object.entries(data).forEach(([teacherId, teacher]) => {
          if (!teacher.students) return;

          Object.entries(teacher.students).forEach(([studentId, student]) => {
            if (
              student.parentEmail?.toLowerCase() ===
              firebaseUser.email?.toLowerCase()
            ){
              matched.push({
                ...student,
                id: studentId,
                teacherId,
              });
            }
          });
        });

        setChildren(matched);

        setSelectedChild((prev) => {
          if (prev && matched.some((child) => child.id === prev.id)) {
            return matched.find((child) => child.id === prev.id);
          }
          return matched[0] || null;
        });

        setLoading(false);
      });
    });

    return () => {
      if (teachersUnsub) teachersUnsub();
      authUnsub();
    };
  }, [navigate]);

  useEffect(() => {
    if (!selectedChild) return;

    const { teacherId, id: studentId } = selectedChild;

    const unsubProgress = onValue(
      ref(database, `teachers/${teacherId}/students/${studentId}/progress`),
      (snap) => setProgress(snap.val() || {})
    );

    const unsubBadges = onValue(
      ref(database, `teachers/${teacherId}/students/${studentId}/badges`),
      (snap) => setBadges(snap.val() || {})
    );

    const unsubConfusions = onValue(
      ref(database, `teachers/${teacherId}/students/${studentId}/confusions`),
      (snap) => setConfusions(snap.val() || {})
    );

    return () => {
      unsubProgress();
      unsubBadges();
      unsubConfusions();
    };
  }, [selectedChild]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/parent-login');
  };

  const getModuleProgress = (moduleKey) => {
    const mod = progress[moduleKey];

    if (!mod) {
      return {
        completed: 0,
        total: 5,
        correct: 0,
        points: 0,
        accuracy: 0,
        minigame: null,
      };
    }

    const questions = Object.entries(mod)
      .filter(([key, value]) => key.startsWith('q') && typeof value === 'object')
      .map(([, value]) => value);

    const completed = questions.filter((q) => q.isCorrect !== undefined).length;
    const correct = questions.filter((q) => q.isCorrect).length;
    const points = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    const accuracy = completed > 0 ? Math.round((correct / completed) * 100) : 0;
    const minigame = mod.minigame || null;

    return {
      completed,
      total: 5,
      correct,
      points,
      accuracy,
      minigame,
    };
  };

  const getAllStats = () => {
    let totalQ = 0;
    let correctQ = 0;
    let totalPoints = 0;
    let lastActivity = null;

    MODULES.forEach((module) => {
      const mod = progress[module.key] || {};

      Object.entries(mod).forEach(([key, value]) => {
        if (
          key.startsWith('q') &&
          typeof value === 'object' &&
          value.isCorrect !== undefined
        ) {
          totalQ++;

          if (value.isCorrect) correctQ++;

          totalPoints += value.points || 0;

          if (value.completedAt && (!lastActivity || value.completedAt > lastActivity)) {
            lastActivity = value.completedAt;
          }
        }

        if (key === 'minigame' && value?.completedAt) {
          if (!lastActivity || value.completedAt > lastActivity) {
            lastActivity = value.completedAt;
          }
        }
      });
    });

    const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    const earnedBadges = Object.values(badges).filter((badge) => badge?.earned).length;

    return {
      totalQ,
      correctQ,
      totalPoints,
      accuracy,
      earnedBadges,
      lastActivity,
    };
  };

  const getConfusionStats = () => {
    return Object.entries(confusions || {})
      .map(([pair, value]) => {
        const expectedLetter = value?.expectedLetter || pair.split('-')[0] || '';
        const scannedLetter = value?.scannedLetter || pair.split('-')[1] || '';

        return {
          pair,
          expectedLetter,
          scannedLetter,
          count: value?.count || 0,
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  const getCurrentStage = () => {
    for (let i = MODULES.length - 1; i >= 0; i--) {
      const prog = getModuleProgress(MODULES[i].key);
      if (prog.completed > 0) {
        return `Modul ${MODULES[i].id} - ${MODULES[i].name}`;
      }
    }

    return 'Belum bermula';
  };


  const getHomeActivities = () => {
    const topConfusion = getConfusionStats()[0];

    if (!topConfusion) {
      return {
        source: 'general',
        title: 'Aktiviti fonik santai hari ini',
        description: 'Tiada kekeliruan huruf yang ketara direkodkan. Teruskan latihan ringkas untuk kekalkan momentum pembelajaran.',
        steps: [
          'Pilih 3 huruf yang telah dipelajari dan sebut bunyinya bersama anak.',
          'Minta anak cari objek di rumah yang bermula dengan salah satu bunyi huruf tersebut.',
          'Akhiri dengan pujian ringkas supaya anak rasa yakin untuk belajar lagi.'
        ],
      };
    }

    const normalizedPair = `${topConfusion.expectedLetter}-${topConfusion.scannedLetter}`.toLowerCase();
    const activity = HOME_ACTIVITY_LIBRARY[normalizedPair] || {
      title: `Latihan huruf ${topConfusion.expectedLetter} dan ${topConfusion.scannedLetter}`,
      steps: [
        'Tunjukkan kedua-dua huruf secara sebelah-menyebelah.',
        'Minta anak jejak bentuk huruf menggunakan jari.',
        'Ulang sebutan bunyi huruf secara perlahan dan santai.'
      ]
    };

    return {
      source: 'confusion',
      title: activity.title,
      description: `${selectedChild?.name || 'Anak anda'} masih keliru antara huruf ${topConfusion.expectedLetter} dan ${topConfusion.scannedLetter}. Aktiviti pendek 5–10 minit ini boleh membantu di rumah.`,
      steps: activity.steps,
    };
  };


  const getSecondaryHomeActivities = () => {
    const top = confusionStats[0];

    const activities = [];

    if (top) {
      activities.push({
        type: 'mirror',
        title: 'Latihan Huruf Cermin',
        description: `Ulang beza huruf ${top.expectedLetter} dan ${top.scannedLetter} secara perlahan dengan aktiviti jejak dan perbandingan.`,
        time: '5–10 min',
        visual: `${top.expectedLetter}${top.scannedLetter}`,
      });
    }

    activities.push({
      type: 'object',
      title: "Cari objek bunyi 'b'",
      description: "Cari 3 objek di rumah yang bermula dengan bunyi “b”, contohnya bola, buku atau beg.",
      time: '5–10 min',
      visual: 'objek',
    });

    activities.push({
      type: 'routine',
      title: 'Ulang sebut bunyi huruf',
      description: 'Pilih 3 huruf, sebut bunyinya bersama anak, kemudian beri pujian ringkas.',
      time: '5 min',
      visual: 'abc',
    });

    return activities.slice(0, 3);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';

    return new Date(timestamp).toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatRelative = (timestamp) => {
    if (!timestamp) return 'Belum ada aktiviti';

    const days = Math.floor((Date.now() - timestamp) / 86400000);

    if (days === 0) return 'Hari ini';
    if (days === 1) return 'Semalam';

    return `${days} hari lalu`;
  };

  if (loading) {
    return <div className="loading-dashboard">Sedang memuatkan...</div>;
  }

  if (children.length === 0) {
    return (
      <div className="parent-dashboard-wrapper">
        <nav className="dashboard-nav">
          <div className="nav-brand">
            <h1>Portal Ibu Bapa PhonoBuddy</h1>
          </div>

          <div className="nav-user">
            <span>{user?.email}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Log Keluar
            </button>
          </div>
        </nav>

        <div className="empty-full">
          <h2>Tiada Rekod Anak Dijumpai</h2>
          <p>Emel anda ({user?.email}) belum dipautkan kepada mana-mana akaun pelajar.</p>
          <p>Sila hubungi guru anak anda untuk membuat pemautan akaun.</p>
        </div>
      </div>
    );
  }

  const stats = getAllStats();
  const mod1 = getModuleProgress('module1');
  const mod2 = getModuleProgress('module2');
  const confusionStats = getConfusionStats();
  const homeActivities = getHomeActivities();

  return (
    <div className="parent-dashboard-wrapper">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>Portal Ibu Bapa PhonoBuddy</h1>
        </div>

        <div className="nav-tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Gambaran Keseluruhan
          </button>

          <button
            className={activeTab === 'progress' ? 'active' : ''}
            onClick={() => setActiveTab('progress')}
          >
            Perkembangan
          </button>

          <button
            className={activeTab === 'badges' ? 'active' : ''}
            onClick={() => setActiveTab('badges')}
          >
            Lencana
          </button>
        </div>

        <div className="nav-user">
          <span>{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Log Keluar
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        {children.length > 1 && (
          <div className="child-selector-bar">
            <label>Pilih anak untuk melihat perkembangan:</label>

            <select
              value={selectedChild?.id || ''}
              onChange={(e) =>
                setSelectedChild(children.find((child) => child.id === e.target.value))
              }
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} — Kelas: {child.classId || '-'}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'overview' && (
          <section className="tab-content parent-overview-page refreshed-parent-page">
            <div className="parent-top-card">
              <div className="parent-top-left">
                <div className="child-avatar-circle hero-avatar">
                  {selectedChild?.name?.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h2>{selectedChild?.name}</h2>
                  <p>
                    Tahap Semasa: <strong>{getCurrentStage()}</strong>
                  </p>
                  <p className="last-activity-line">
                    Aktiviti terakhir: <strong>{formatRelative(stats.lastActivity)}</strong>
                  </p>
                </div>
              </div>

              <div className="parent-top-note">
                <span>Teruskan usaha, {selectedChild?.name}!</span>
                <p>
                  Sedikit latihan pendek di rumah boleh membantu {selectedChild?.name} lebih yakin
                  dengan bunyi huruf.
                </p>
                <div className="plant-illustration" aria-hidden="true">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>

            <div className="daily-progress-card">
              <h3>Kemajuan Hari Ini</h3>

              <div className="daily-stat-list">
                <div className="daily-stat-item purple">
                  <span className="daily-stat-icon">□</span>
                  <div>
                    <strong>{stats.totalQ}</strong>
                    <p>Soalan dijawab</p>
                  </div>
                </div>

                <div className="daily-stat-item orange">
                  <span className="daily-stat-icon">◎</span>
                  <div>
                    <strong>{stats.totalPoints}</strong>
                    <p>Mata diperoleh</p>
                  </div>
                </div>

                <div className="daily-stat-item blue">
                  <span className="daily-stat-icon">☆</span>
                  <div>
                    <strong>{stats.accuracy}%</strong>
                    <p>Ketepatan</p>
                  </div>
                </div>

                <div className="daily-stat-item green">
                  <span className="daily-stat-icon">♕</span>
                  <div>
                    <strong>{stats.earnedBadges}/3</strong>
                    <p>Lencana diperoleh</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="parent-three-column">
              <div className="panel module-panel clean-card">
                <div className="panel-header clean-header">
                  <div>
                    <span className="section-kicker">Kemajuan</span>
                    <h3>Kemajuan Modul</h3>
                  </div>
                </div>

                <div className="module-bars natural-bars">
                  {MODULES.map((module) => {
                    const prog = getModuleProgress(module.key);
                    const percent = Math.round((prog.completed / prog.total) * 100);

                    return (
                      <div key={module.key} className="module-bar-row natural-row">
                        <div className="module-bar-label">
                          <strong>{module.name}</strong>
                          <span>{prog.completed}/{prog.total} aktiviti selesai</span>
                        </div>

                        <div className="module-bar-track">
                          <div
                            className="module-bar-fill"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        <div className="module-bar-end">
                          <span className="module-bar-percent">{percent}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel summary-panel clean-card">
                <div className="panel-header clean-header">
                  <div>
                    <span className="section-kicker">Ringkasan</span>
                    <h3>Ringkasan Pembelajaran</h3>
                  </div>
                </div>

                <div className="summary-rows compact-summary-rows">
                  <div className="summary-row-item with-icon">
                    <span>Jawapan Betul</span>
                    <strong>{stats.correctQ} / {stats.totalQ}</strong>
                  </div>
                  <div className="summary-row-item with-icon">
                    <span>Mini Game Lulus</span>
                    <strong>{stats.earnedBadges} / 3</strong>
                  </div>
                  <div className="summary-row-item with-icon">
                    <span>Jumlah Mata</span>
                    <strong>{stats.totalPoints}</strong>
                  </div>
                  <div className="summary-row-item with-icon">
                    <span>Ketepatan</span>
                    <strong>{stats.accuracy}%</strong>
                  </div>
                </div>
              </div>

              <div className="panel confusion-panel clean-card">
                <div className="panel-header clean-header">
                  <div>
                    <span className="section-kicker">Perlu dibantu</span>
                    <h3>Huruf Yang Sering Dikelirukan</h3>
                  </div>
                </div>

                <div className="confusion-box">
                  <div className="confusion-list">
                    {confusionStats.length === 0 ? (
                      <p className="empty-state compact">
                        Tiada kekeliruan huruf direkodkan.
                      </p>
                    ) : (
                      confusionStats.slice(0, 3).map((item) => (
                        <div key={item.pair} className="confusion-item simple-confusion-item">
                          <div className="confusion-pair">
                            <span>{item.expectedLetter}</span>
                            <span>↔</span>
                            <span>{item.scannedLetter}</span>
                          </div>

                          <div className="confusion-info">
                            <strong>{item.count} kali</strong>
                            <p>{selectedChild?.name} masih keliru antara huruf ini.</p>
                          </div>
                        </div>
                      ))
                    )}

                    {confusionStats.length > 0 && (
                      <div className="confusion-tip">
                        Tip: Ulang latihan pendek di rumah akan membantu {selectedChild?.name} lebih yakin.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="home-activities-section">
              <div className="home-section-header">
                <div>
                  <h3>Cadangan Aktiviti Di Rumah</h3>
                  <p>
                    Aktiviti ringkas tanpa alat khas. Ibu bapa boleh lakukan bersama {selectedChild?.name}
                    menggunakan kertas, pensel atau objek di rumah.
                  </p>
                </div>
              </div>

              <div className="home-activity-layout">
                <div className="featured-parent-activity">
                  <div className="activity-visual letter-card-visual" aria-hidden="true">
                    {confusionStats.length > 0 ? (
                      <>
                        <span>{confusionStats[0].expectedLetter}</span>
                        <small>↔</small>
                        <span>{confusionStats[0].scannedLetter}</span>
                      </>
                    ) : (
                      <>
                        <span>a</span>
                        <small>•</small>
                        <span>b</span>
                      </>
                    )}
                  </div>

                  <div className="featured-activity-content">
                    <span className="home-activity-kicker">Aktiviti Disyorkan</span>
                    <h4>{homeActivities.title}</h4>
                    <p>{homeActivities.description}</p>

                    <div className="home-activity-steps compact-steps">
                      {homeActivities.steps.map((step, index) => (
                        <div key={index} className="home-step-item">
                          <span>{index + 1}</span>
                          <p>{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="activity-meta-row">
                      <span> 5–10 minit</span>
                    </div>
                  </div>
                </div>

                <div className="home-small-cards">
                  {getSecondaryHomeActivities().map((activity, index) => (
                    <div key={`${activity.title}-${index}`} className="small-home-card">
                      <div className={`small-home-visual ${activity.type}`}>
                        {activity.visual === 'objek'
                          ? '🧺'
                          : activity.visual === 'abc'
                            ? 'abc'
                            : activity.visual}
                      </div>

                      <div>
                        <h4>{activity.title}</h4>
                        <p>{activity.description}</p>
                        <span>{activity.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="parent-side-note">
                  <div className="parent-mini-faces">
    
                  </div>
                  <h4>Untuk Ibu Bapa</h4>
                  <p>
                    Luangkan masa 10–15 minit sahaja. Ulangan yang konsisten membantu anak lebih yakin dan cekap.
                  </p>
                </div>
              </div>

             
            </div>
          </section>
        )}


        {activeTab === 'progress'  && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Perkembangan</h2>
                <p>Butiran kemajuan {selectedChild?.name} mengikut modul.</p>
              </div>
            </div>

            <div className="analytics-card full" style={{ marginBottom: '1.4rem' }}>
              <h3>Kemajuan Mengikut Modul</h3>

              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Modul</th>
                    <th>Soalan Selesai</th>
                    <th>Ketepatan</th>
                    <th>Mata</th>
                    <th>Mini Game</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {MODULES.map((module) => {
                    const prog = getModuleProgress(module.key);
                    const badge = badges[module.badge]?.earned;

                    return (
                      <tr key={module.key}>
                        <td><strong>{module.name}</strong></td>
                        <td>{prog.completed}/5</td>
                        <td>{prog.accuracy}%</td>
                        <td>{prog.points}</td>
                        <td>
                          {prog.minigame
                            ? `${prog.minigame.score || 0}/${prog.minigame.total || 8} (${prog.minigame.passed ? 'Lulus' : 'Gagal'})`
                            : '-'}
                        </td>
                        <td>
                          <span className={badge ? 'status-pill good' : 'status-pill'}>
                            {badge
                              ? 'Lencana Diperoleh'
                              : prog.completed >= 5
                                ? 'Mini Game Perlu Dilengkap'
                                : prog.completed > 0
                                  ? 'Sedang Belajar'
                                  : 'Belum Dimulakan'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Ketepatan Mengikut Modul</h3>

                <div className="module-bars" style={{ marginTop: '0.5rem' }}>
                  {MODULES.map((module) => {
                    const prog = getModuleProgress(module.key);

                    return (
                      <div key={module.key} className="module-bar-row">
                        <div className="module-bar-label">
                          <strong>{module.name}</strong>
                          <span>{prog.correct}/{prog.completed} betul</span>
                        </div>

                        <div className="module-bar-track">
                          <div
                            className="module-bar-fill"
                            style={{ width: `${prog.accuracy}%` }}
                          ></div>
                        </div>

                        <div className="module-bar-percent">{prog.accuracy}%</div>
                      </div>
                    );
                  })}
                </div>

                {stats.totalQ === 0 && (
                  <p className="empty-state compact">
                    Tiada data buat masa ini. Data akan muncul apabila {selectedChild?.name} mula belajar.
                  </p>
                )}
              </div>

              <div className="analytics-card">
                <h3>Mata Diperoleh Mengikut Modul</h3>

                <div className="module-bars" style={{ marginTop: '0.5rem' }}>
                  {MODULES.map((module) => {
                    const prog = getModuleProgress(module.key);
                    const maxPoints = 75;
                    const percent = Math.round((prog.points / maxPoints) * 100);

                    return (
                      <div key={module.key} className="module-bar-row">
                        <div className="module-bar-label">
                          <strong>{module.name}</strong>
                          <span>{prog.points} mata</span>
                        </div>

                        <div className="module-bar-track">
                          <div
                            className="module-bar-fill"
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          ></div>
                        </div>

                        <div className="module-bar-percent">{prog.points}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'badges' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Lencana Pencapaian</h2>
                <p>Lencana diberikan apabila {selectedChild?.name} berjaya menyelesaikan mini game setiap modul.</p>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: '1.4rem' }}>
              <div className="panel-header">
                <h3>Lencana {selectedChild?.name}</h3>
                <span>{stats.earnedBadges}/3 diperoleh</span>
              </div>

              <div className="module-detail-list">
                {Object.entries(BADGE_IDS).map(([id, badge]) => {
                  const earned = badges[id]?.earned;
                  const earnedAt = badges[id]?.earnedAt;

                  return (
                    <div key={id} className="module-detail-card">
                      <div>
                        <strong>{badge.name}</strong>
                        <span>{badge.module}</span>
                      </div>

                      <div className="module-status-group">
                        <span className={earned ? 'status-pill good' : 'status-pill'}>
                          {earned ? `Diperoleh pada ${formatDate(earnedAt)}` : 'Belum diperoleh'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="module-detail-card">
                  <div>
                    <strong>Pakar Fonik</strong>
                    <span>Semua Modul — Sijil diberikan apabila semua lencana diperoleh</span>
                  </div>

                  <div className="module-status-group">
                    <span className={stats.earnedBadges >= 3 ? 'status-pill good' : 'status-pill'}>
                      {stats.earnedBadges >= 3 ? 'Sijil Diperoleh' : `${stats.earnedBadges}/3 lencana`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="analytics-card full">
              <h3>Kemajuan Menuju Sijil Pakar Fonik</h3>

              <div className="module-bar-row" style={{ marginTop: '1rem' }}>
                <div className="module-bar-label">
                  <strong>Lencana Diperoleh</strong>
                  <span>{stats.earnedBadges} daripada 3</span>
                </div>

                <div className="module-bar-track">
                  <div
                    className="module-bar-fill"
                    style={{ width: `${Math.round((stats.earnedBadges / 3) * 100)}%` }}
                  ></div>
                </div>

                <div className="module-bar-percent">
                  {Math.round((stats.earnedBadges / 3) * 100)}%
                </div>
              </div>

              {stats.earnedBadges >= 3 && (
                <div className="encourage-box" style={{ marginTop: '1rem' }}>
                  <strong>Tahniah!</strong>
                  <p>{selectedChild?.name} telah menyelesaikan semua modul dan layak mendapat Sijil Pakar Fonik.</p>
                </div>
              )}
            </div>
          </section>
        )}

  
      </main>
    </div>
  );
}

export default ParentDashboard;