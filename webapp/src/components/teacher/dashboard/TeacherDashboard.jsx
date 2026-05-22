import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../../../firebase';
import { ref, push, onValue, get, update } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './TeacherDashboard.css';

const PICTURE_POOL = [
  'kucing', 'anjing', 'epal', 'kereta', 'bintang',
  'pokok', 'ikan', 'buku', 'topi', 'bola',
  'pisang', 'bulan', 'daun', 'kasut', 'cawan',
  'burung', 'kek', 'bas', 'kunci', 'katak'
];

const MODULES = [
  { key: 'module1', name: 'Bunyi & Huruf', badge: 'detektif_bunyi' },
  { key: 'module2', name: 'Bina Kata', badge: 'misi_kata' },
  { key: 'module3', name: 'Keluarga Kata', badge: 'cari_rima' }
];

const MIRROR_INTERVENTION_LIBRARY = {
  'b-d': {
    issue: 'Kekeliruan orientasi kiri-kanan pada bentuk huruf.',
    focus: 'Bezakan arah "perut" huruf b dan d.',
    activity: 'Aktiviti jejak huruf b dan d menggunakan jari, kemudian bandingkan kedua-dua huruf secara sebelah-menyebelah.',
    homeSupport: 'Minta murid sebut bunyi huruf sambil menunjuk arah perut huruf.'
  },
  'd-b': {
    issue: 'Kekeliruan orientasi kiri-kanan pada bentuk huruf.',
    focus: 'Bezakan arah "perut" huruf d dan b.',
    activity: 'Aktiviti jejak huruf d dan b menggunakan jari, kemudian bandingkan kedua-dua huruf secara sebelah-menyebelah.',
    homeSupport: 'Minta murid sebut bunyi huruf sambil menunjuk arah perut huruf.'
  },
  'p-q': {
    issue: 'Kekeliruan bentuk huruf menurun dan arah ekor huruf.',
    focus: 'Kenal pasti arah bulatan dan ekor huruf p dan q.',
    activity: 'Latihan padanan huruf p/q dengan gambar contoh serta aktiviti menulis perlahan mengikut anak panah.',
    homeSupport: 'Gunakan kad huruf besar dan minta murid pilih huruf yang disebut oleh guru.'
  },
  'q-p': {
    issue: 'Kekeliruan bentuk huruf menurun dan arah ekor huruf.',
    focus: 'Kenal pasti arah bulatan dan ekor huruf q dan p.',
    activity: 'Latihan padanan huruf q/p dengan gambar contoh serta aktiviti menulis perlahan mengikut anak panah.',
    homeSupport: 'Gunakan kad huruf besar dan minta murid pilih huruf yang disebut oleh guru.'
  },
  'm-w': {
    issue: 'Kekeliruan orientasi atas-bawah pada bentuk huruf.',
    focus: 'Bezakan bentuk bukit untuk m dan bentuk lembah untuk w.',
    activity: 'Aktiviti menyusun blok huruf m dan w mengikut arah yang betul, kemudian baca bunyi huruf secara berulang.',
    homeSupport: 'Minta murid menelusuri bentuk huruf dengan jari sebelum menjawab.'
  },
  'w-m': {
    issue: 'Kekeliruan orientasi atas-bawah pada bentuk huruf.',
    focus: 'Bezakan bentuk lembah untuk w dan bentuk bukit untuk m.',
    activity: 'Aktiviti menyusun blok huruf w dan m mengikut arah yang betul, kemudian baca bunyi huruf secara berulang.',
    homeSupport: 'Minta murid menelusuri bentuk huruf dengan jari sebelum menjawab.'
  },
  'n-u': {
    issue: 'Kekeliruan orientasi atas-bawah pada bentuk huruf.',
    focus: 'Bezakan lengkungan n dan u.',
    activity: 'Aktiviti jejak bentuk n dan u menggunakan kad bertekstur, kemudian padankan dengan bunyi huruf.',
    homeSupport: 'Gunakan contoh perkataan mudah dan minta murid mengenal pasti huruf sasaran.'
  },
  'u-n': {
    issue: 'Kekeliruan orientasi atas-bawah pada bentuk huruf.',
    focus: 'Bezakan lengkungan u dan n.',
    activity: 'Aktiviti jejak bentuk u dan n menggunakan kad bertekstur, kemudian padankan dengan bunyi huruf.',
    homeSupport: 'Gunakan contoh perkataan mudah dan minta murid mengenal pasti huruf sasaran.'
  }
};

function getRandomPicturePassword() {
  const pool = [...PICTURE_POOL];
  const result = [];

  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }

  return result;
}

function TeacherDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);

  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [error, setError] = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [teacherNotes, setTeacherNotes] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/teacher-login');
        return;
      }

      setUser(firebaseUser);

      const classRef = ref(database, `teachers/${firebaseUser.uid}/classrooms`);
      onValue(classRef, (snapshot) => {
        const data = snapshot.val() || {};
        setClassrooms(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      });

      const studentRef = ref(database, `teachers/${firebaseUser.uid}/students`);
      onValue(studentRef, (snapshot) => {
        const data = snapshot.val() || {};
        const nextStudents = Object.entries(data).map(([id, val]) => ({ id, ...val }));

        setStudents(nextStudents);
        setSelectedStudent((prev) => {
          if (!prev) return null;
          return nextStudents.find((student) => student.id === prev.id) || null;
        });
      });
    });

    return () => unsubscribe();
  }, [navigate]);

  const getClassName = (classId) => {
    return classrooms.find((c) => c.id === classId)?.name || 'Tiada kelas';
  };

  const getStudentLearningStats = (student) => {
    const progress = student.progress || {};
    let totalQuestions = 0;
    let completedQuestions = 0;
    let correctQuestions = 0;
    let totalPoints = 0;
    let totalAttempts = 0;

    MODULES.forEach((mod) => {
      const moduleData = progress[mod.key] || {};

      Object.entries(moduleData).forEach(([key, val]) => {
        if (key.startsWith('q') && typeof val === 'object') {
          totalQuestions++;

          if (val.isCorrect !== undefined || val.completed || val.completedLearning) {
            completedQuestions++;
          }

          if (val.isCorrect) correctQuestions++;

          totalPoints += val.points || 0;
          totalAttempts += val.attempts || 0;
        }
      });
    });

    const completion = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;
    const accuracy = completedQuestions > 0 ? Math.round((correctQuestions / completedQuestions) * 100) : 0;
    const avgAttempts = completedQuestions > 0 ? Number((totalAttempts / completedQuestions).toFixed(1)) : 0;

    return {
      totalQuestions,
      completedQuestions,
      correctQuestions,
      totalPoints,
      totalAttempts,
      avgAttempts,
      completion,
      accuracy
    };
  };

  const getStudentMiniGameStats = (student) => {
    const progress = student.progress || {};
    let totalGames = 0;
    let passedGames = 0;
    let failedGames = 0;
    let totalScore = 0;
    let totalGameQuestions = 0;

    MODULES.forEach((mod) => {
      const mini = progress[mod.key]?.minigame;

      if (mini) {
        totalGames++;
        if (mini.passed) passedGames++;
        else failedGames++;

        totalScore += mini.score || 0;
        totalGameQuestions += mini.total || 0;
      }
    });

    const gameAccuracy = totalGameQuestions > 0 ? Math.round((totalScore / totalGameQuestions) * 100) : 0;

    return {
      totalGames,
      passedGames,
      failedGames,
      totalScore,
      totalGameQuestions,
      gameAccuracy
    };
  };

  const getStudentBadges = (student) => {
    const badges = student.badges || {};
    return Object.values(badges).filter((b) => b?.earned).length;
  };

  const getCurrentModule = (student) => {
    const badges = student.badges || {};

    if (!badges.detektif_bunyi?.earned) return 'Module 1';
    if (!badges.misi_kata?.earned) return 'Module 2';
    if (!badges.cari_rima?.earned) return 'Module 3';

    return 'Selesai';
  };

  const getLastActivity = (student) => {
    const session = student.currentSession || {};
    const timestamps = [];

    if (session.startedAt) timestamps.push(session.startedAt);

    MODULES.forEach((mod) => {
      const moduleData = student.progress?.[mod.key] || {};
      Object.values(moduleData).forEach((val) => {
        if (val?.completedAt && typeof val.completedAt === 'number') {
          timestamps.push(val.completedAt);
        }
      });
    });

    if (timestamps.length === 0) return '-';

    const latest = Math.max(...timestamps);
    return new Date(latest).toLocaleString('ms-MY');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';

    return new Date(timestamp).toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getMonitoringStatusText = (monitoring) => {
    if (monitoring?.isImproving) return 'Menunjukkan Peningkatan';
    if (monitoring?.supportGiven) return 'Sokongan Sedang Diberikan';
    if (monitoring?.underMonitoring) return 'Dalam Pemantauan';
    return 'Belum Dipantau';
  };

  const getMirrorConfusionAnalysis = (student) => {
    const confusions = student?.confusions || {};
    const supportMonitoring = student?.supportMonitoring || {};
    const oldInterventions = student?.interventions || {};

    return Object.entries(confusions)
      .map(([pair, value]) => {
        const count = value?.count || 0;
        const expectedLetter = value?.expectedLetter || pair.split('-')[0] || '';
        const scannedLetter = value?.scannedLetter || pair.split('-')[1] || '';
        const normalizedPair = `${expectedLetter}-${scannedLetter}`.toLowerCase();

        const library = MIRROR_INTERVENTION_LIBRARY[normalizedPair] || {
          issue: 'Corak kekeliruan huruf berulang dikesan.',
          focus: 'Bezakan bentuk huruf sasaran dan huruf yang dipilih.',
          activity: 'Latihan pengenalan bentuk huruf, perbandingan sisi dan sebutan bunyi huruf secara perlahan.',
          homeSupport: 'Ulang latihan pendek 5–10 minit menggunakan kad huruf.'
        };

        let severity = 'Rendah';
        let severityClass = 'low';
        let priority = 'Pantau sahaja';
        let frequency = 'Ringan';

        if (count >= 3 && count < 6) {
          severity = 'Sederhana';
          severityClass = 'medium';
          priority = 'Perlu latihan sasaran';
          frequency = 'Berulang';
        }

        if (count >= 6) {
          severity = 'Tinggi';
          severityClass = 'high';
          priority = 'Perlu pemantauan guru';
          frequency = 'Kerap';
        }

        const monitoring =
          supportMonitoring[pair] ||
          supportMonitoring[normalizedPair] ||
          oldInterventions[pair] ||
          oldInterventions[normalizedPair] ||
          {};

        return {
          pair,
          normalizedPair,
          expectedLetter,
          scannedLetter,
          count,
          severity,
          severityClass,
          priority,
          frequency,
          monitoring,
          status: getMonitoringStatusText(monitoring),
          updatedAt: monitoring?.updatedAt || null,
          noteUpdatedAt: monitoring?.noteUpdatedAt || null,
          teacherNote: monitoring?.teacherNote || '',
          issue: library.issue,
          focus: library.focus,
          activity: library.activity,
          homeSupport: library.homeSupport
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  const getInterventionSummary = (student) => {
    const analysis = getMirrorConfusionAnalysis(student);
    const high = analysis.filter((item) => item.severity === 'Tinggi').length;
    const medium = analysis.filter((item) => item.severity === 'Sederhana').length;
    const monitored = analysis.filter((item) => item.status !== 'Belum Dipantau').length;
    const totalEvents = analysis.reduce((sum, item) => sum + item.count, 0);

    let overallRisk = 'Rendah';

    if (high > 0 || totalEvents >= 8) overallRisk = 'Tinggi';
    else if (medium > 0 || totalEvents >= 3) overallRisk = 'Sederhana';

    return {
      totalPatterns: analysis.length,
      totalEvents,
      high,
      medium,
      monitored,
      overallRisk
    };
  };

  const getLearningSupportAnalysis = (student) => {
    const learning = getStudentLearningStats(student);
    const game = getStudentMiniGameStats(student);
    const mirror = getInterventionSummary(student);
    const factors = [];

    if (learning.accuracy > 0 && learning.accuracy < 70) {
      factors.push('Ketepatan learning rendah');
    }

    if (learning.avgAttempts >= 2) {
      factors.push('Percubaan berulang untuk menjawab soalan');
    }

    if (game.totalGames > 0 && game.gameAccuracy < 75) {
      factors.push('Prestasi mini game masih lemah');
    }

    if (game.failedGames >= 2) {
      factors.push('Mini game gagal berulang');
    }

    if (mirror.totalEvents >= 3) {
      factors.push('Kekeliruan huruf cermin berulang');
    }

    let level = 'Rendah';
    let levelClass = 'low';
    let recommendation = 'Teruskan pembelajaran biasa dan pantau perkembangan dari semasa ke semasa.';

    if (factors.length >= 2 || learning.accuracy < 70 || game.gameAccuracy < 75 || mirror.totalEvents >= 3) {
      level = 'Sederhana';
      levelClass = 'medium';
      recommendation = 'Pelajar disarankan menerima latihan fonik tambahan secara berpandu dan pemantauan guru.';
    }

    if (factors.length >= 3 || learning.accuracy < 50 || game.gameAccuracy < 60 || mirror.totalEvents >= 6) {
      level = 'Tinggi';
      levelClass = 'high';
      recommendation = 'Pelajar mungkin memerlukan sokongan fonik tambahan secara berstruktur, latihan pendek berulang, dan catatan pemerhatian guru.';
    }

    return {
      level,
      levelClass,
      recommendation,
      factors,
      accuracy: learning.accuracy,
      avgAttempts: learning.avgAttempts,
      gameAccuracy: game.gameAccuracy,
      failedGames: game.failedGames,
      confusionEvents: mirror.totalEvents
    };
  };


  const getClassConfusionHeatmap = () => {
    const map = {};

    students.forEach((student) => {
      getMirrorConfusionAnalysis(student).forEach((item) => {
        const key = `${item.expectedLetter}-${item.scannedLetter}`.toLowerCase();
        if (!map[key]) {
          map[key] = {
            key,
            expectedLetter: item.expectedLetter,
            scannedLetter: item.scannedLetter,
            count: 0,
            students: new Set(),
            highCount: 0,
          };
        }

        map[key].count += item.count;
        map[key].students.add(student.name);
        if (item.severity === 'Tinggi') map[key].highCount += 1;
      });
    });

    const maxCount = Math.max(1, ...Object.values(map).map((item) => item.count));

    return Object.values(map)
      .map((item) => ({
        ...item,
        studentCount: item.students.size,
        intensity: Math.max(12, Math.round((item.count / maxCount) * 100)),
      }))
      .sort((a, b) => b.count - a.count);
  };

  const getClassInterventionStats = useMemo(() => {
    let totalPatterns = 0;
    let totalEvents = 0;
    let highRiskStudents = 0;
    let monitoredPlans = 0;

    students.forEach((student) => {
      const summary = getInterventionSummary(student);
      totalPatterns += summary.totalPatterns;
      totalEvents += summary.totalEvents;
      monitoredPlans += summary.monitored;

      if (summary.overallRisk === 'Tinggi') highRiskStudents++;
    });

    return {
      totalPatterns,
      totalEvents,
      highRiskStudents,
      monitoredPlans
    };
  }, [students]);

  const dashboardStats = useMemo(() => {
    const totalStudents = students.length;
    const totalClasses = classrooms.length;

    let totalBadges = 0;
    let totalPoints = 0;
    let totalCompletion = 0;
    let activeStudents = 0;

    students.forEach((student) => {
      const learning = getStudentLearningStats(student);
      const badges = getStudentBadges(student);

      totalBadges += badges;
      totalPoints += learning.totalPoints;
      totalCompletion += learning.completion;

      if (learning.completedQuestions > 0 || badges > 0) activeStudents++;
    });

    const avgCompletion = totalStudents > 0 ? Math.round(totalCompletion / totalStudents) : 0;

    return {
      totalStudents,
      totalClasses,
      activeStudents,
      totalBadges,
      totalPoints,
      avgCompletion
    };
  }, [students, classrooms]);

  const moduleCompletionStats = useMemo(() => {
    return MODULES.map((mod) => {
      let completed = 0;

      students.forEach((student) => {
        if (student.badges?.[mod.badge]?.earned) completed++;
      });

      const percent = students.length > 0 ? Math.round((completed / students.length) * 100) : 0;

      return {
        ...mod,
        completed,
        total: students.length,
        percent
      };
    });
  }, [students]);

  const studentsNeedingAttention = useMemo(() => {
    return students
      .map((student) => {
        const learning = getStudentLearningStats(student);
        const game = getStudentMiniGameStats(student);
        const intervention = getInterventionSummary(student);
        const support = getLearningSupportAnalysis(student);

        return {
          ...student,
          learning,
          game,
          intervention,
          support,
          currentModule: getCurrentModule(student)
        };
      })
      .filter((student) => {
        if (student.learning.completedQuestions === 0 && student.intervention.totalEvents === 0) return false;

        return (
          student.learning.accuracy < 60 ||
          student.game.gameAccuracy < 75 ||
          student.intervention.overallRisk !== 'Rendah' ||
          student.support.level !== 'Rendah'
        );
      })
      .slice(0, 5);
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (activeFilter === 'all') return students;

    return students.filter((student) => {
      const currentModule = getCurrentModule(student);

      if (activeFilter === 'completed') return currentModule === 'Selesai';
      if (activeFilter === 'active') return currentModule !== 'Selesai';

      if (activeFilter === 'attention') {
        const learning = getStudentLearningStats(student);
        const intervention = getInterventionSummary(student);
        const support = getLearningSupportAnalysis(student);

        return (
          learning.completedQuestions > 0 &&
          (learning.accuracy < 60 || intervention.overallRisk !== 'Rendah' || support.level !== 'Rendah')
        );
      }

      return true;
    });
  }, [students, activeFilter]);

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    setError('');

    if (!className.trim()) {
      setError('Nama kelas diperlukan.');
      return;
    }

    try {
      const allClassroomsRef = ref(database, 'teachers');
      const snapshot = await get(allClassroomsRef);

      let duplicate = false;

      if (snapshot.exists()) {
        const teachers = snapshot.val();

        for (const teacherId in teachers) {
          const classData = teachers[teacherId]?.classrooms || {};

          for (const classId in classData) {
            if (classData[classId].name?.trim().toLowerCase() === className.trim().toLowerCase()) {
              duplicate = true;
              break;
            }
          }

          if (duplicate) break;
        }
      }

      if (duplicate) {
        setError('Nama kelas sudah wujud. Sila gunakan nama lain.');
        return;
      }

      const classRef = ref(database, `teachers/${user.uid}/classrooms`);
      await push(classRef, {
        name: className.trim(),
        createdAt: Date.now()
      });

      setClassName('');
    } catch (err) {
      setError('Ralat semasa mencipta kelas.');
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');

    if (!studentName.trim() || !selectedClass) {
      setError('Nama pelajar dan kelas diperlukan.');
      return;
    }

    try {
      const password = getRandomPicturePassword();
      const studentRef = ref(database, `teachers/${user.uid}/students`);

      await push(studentRef, {
        name: studentName.trim(),
        classId: selectedClass,
        parentEmail: parentEmail.trim() || null,
        picturePassword: password,
        createdAt: Date.now(),
        totalPoints: 0
      });

      setStudentName('');
      setParentEmail('');
      setSelectedClass('');
    } catch (err) {
      setError('Ralat semasa menambah pelajar.');
    }
  };

  const handleUpdateMonitoringField = async (student, analysisItem, field, value) => {
    if (!user || !student || !analysisItem) return;

    const monitoringRef = ref(
      database,
      `teachers/${user.uid}/students/${student.id}/supportMonitoring/${analysisItem.pair}`
    );

    await update(monitoringRef, {
      pair: analysisItem.pair,
      expectedLetter: analysisItem.expectedLetter,
      scannedLetter: analysisItem.scannedLetter,
      severity: analysisItem.severity,
      issue: analysisItem.issue,
      focus: analysisItem.focus,
      activity: analysisItem.activity,
      homeSupport: analysisItem.homeSupport,
      [field]: value,
      updatedAt: Date.now()
    });
  };

  const handleSaveTeacherNote = async (student, analysisItem) => {
    if (!user || !student || !analysisItem) return;

    const draftKey = `${student.id}-${analysisItem.pair}`;
    const note =
      teacherNotes[draftKey] !== undefined
        ? teacherNotes[draftKey]
        : analysisItem.teacherNote || '';

    const monitoringRef = ref(
      database,
      `teachers/${user.uid}/students/${student.id}/supportMonitoring/${analysisItem.pair}`
    );

    await update(monitoringRef, {
      pair: analysisItem.pair,
      expectedLetter: analysisItem.expectedLetter,
      scannedLetter: analysisItem.scannedLetter,
      teacherNote: note,
      noteUpdatedAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/teacher-login');
  };

  if (!user) {
    return <div className="loading-dashboard">Loading...</div>;
  }

  return (
    <div className="teacher-dashboard-wrapper">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>Portal Guru PhonoBuddy</h1>
        </div>

        <div className="nav-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            Gambaran Keseluruhan
          </button>
          <button className={activeTab === 'students' ? 'active' : ''} onClick={() => setActiveTab('students')}>
            Pelajar
          </button>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
            Analitik
          </button>
          <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>
            Laporan
          </button>
          <button className={activeTab === 'sessions' ? 'active' : ''} onClick={() => setActiveTab('sessions')}>
            Aktiviti
          </button>
        </div>

        <div className="nav-user">
          <span>{user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Log Keluar</button>
        </div>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Gambaran Keseluruhan</h2>
                <p>Ringkasan prestasi, aktiviti pembelajaran dan sokongan pemantauan pelajar.</p>
              </div>
            </div>

            <div className="stats-grid six">
              <div className="stat-card purple">
                <div className="stat-icon-wrapper purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{dashboardStats.totalStudents}</div>
                  <div className="stat-label">Jumlah Pelajar</div>
                </div>
              </div>

              <div className="stat-card orange">
                <div className="stat-icon-wrapper orange">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{dashboardStats.totalClasses}</div>
                  <div className="stat-label">Kelas</div>
                </div>
              </div>

              <div className="stat-card blue">
                <div className="stat-icon-wrapper blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{dashboardStats.activeStudents}</div>
                  <div className="stat-label">Pelajar Aktif</div>
                </div>
              </div>

              <div className="stat-card green">
                <div className="stat-icon-wrapper green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{dashboardStats.avgCompletion}%</div>
                  <div className="stat-label">Purata Kemajuan</div>
                </div>
              </div>

              <div className="stat-card yellow">
                <div className="stat-icon-wrapper yellow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{getClassInterventionStats.totalEvents}</div>
                  <div className="stat-label">Kekeliruan Huruf</div>
                </div>
              </div>

              <div className="stat-card violet">
                <div className="stat-icon-wrapper violet">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{getClassInterventionStats.monitoredPlans}</div>
                  <div className="stat-label">Dalam Pemantauan</div>
                </div>
              </div>
            </div>

            <div className="overview-layout">
              <div className="panel wide">
                <div className="panel-header">
                  <h3>Kemajuan Modul</h3>
                  <span>Semua Pelajar</span>
                </div>

                <div className="module-bars">
                  {moduleCompletionStats.map((mod) => (
                    <div key={mod.key} className="module-bar-row">
                      <div className="module-bar-label">
                        <strong>{mod.name}</strong>
                        <span>{mod.completed}/{mod.total} selesai</span>
                      </div>
                      <div className="module-bar-track">
                        <div className="module-bar-fill" style={{ width: `${mod.percent}%` }}></div>
                      </div>
                      <div className="module-bar-percent">{mod.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Perlu Perhatian</h3>
                  <span>{studentsNeedingAttention.length} pelajar</span>
                </div>

                {studentsNeedingAttention.length === 0 ? (
                  <div className="empty-state compact">Tiada pelajar yang memerlukan perhatian buat masa ini.</div>
                ) : (
                  <div className="attention-list">
                    {studentsNeedingAttention.map((s) => (
                      <button key={s.id} className="attention-item" onClick={() => setSelectedStudent(s)}>
                        <div>
                          <strong>{s.name}</strong>
                          <span>
                            {s.currentModule} · {s.learning.accuracy}% ketepatan
                            {s.intervention.totalEvents > 0 ? ` · ${s.intervention.totalEvents} kekeliruan` : ''}
                          </span>
                        </div>
                        <small>Lihat</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="quick-actions">
              <h3>Tindakan Pantas</h3>
              <button onClick={() => setActiveTab('students')} className="action-btn">Tambah Pelajar Baharu</button>
              <button onClick={() => setActiveTab('analytics')} className="action-btn">Lihat Analitik</button>
              <button onClick={() => setActiveTab('reports')} className="action-btn">Jana Laporan</button>
              <button onClick={() => setActiveTab('sessions')} className="action-btn">Lihat Aktiviti</button>
            </div>
          </section>
        )}

        {activeTab === 'students' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Pengurusan Pelajar</h2>
                <p>Cipta kelas, tambah pelajar dan semak maklumat akses pelajar.</p>
              </div>
            </div>

            <div className="management-grid">
              <div className="form-section">
                <h3>Cipta Kelas</h3>
                <form onSubmit={handleAddClassroom} className="inline-form">
                  <input
                    type="text"
                    placeholder="Nama kelas"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                  <button type="submit">Tambah Kelas</button>
                </form>
              </div>

              <div className="form-section">
                <h3>Tambah Pelajar</h3>
                <form onSubmit={handleAddStudent} className="student-form">
                  <input
                    type="text"
                    placeholder="Nama pelajar"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="">Pilih kelas</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="email"
                    placeholder="Emel ibu bapa"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                  />
                  <button type="submit">Tambah Pelajar</button>
                </form>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="filter-buttons">
              <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Semua</button>
              <button className={activeFilter === 'active' ? 'active' : ''} onClick={() => setActiveFilter('active')}>Sedang Belajar</button>
              <button className={activeFilter === 'completed' ? 'active' : ''} onClick={() => setActiveFilter('completed')}>Selesai</button>
              <button className={activeFilter === 'attention' ? 'active' : ''} onClick={() => setActiveFilter('attention')}>Perlu Perhatian</button>
            </div>

            <div className="students-list">
              <h3>Senarai Pelajar ({filteredStudents.length})</h3>

              {filteredStudents.length === 0 ? (
                <p className="empty-state">Belum ada pelajar untuk kategori ini.</p>
              ) : (
                <div className="students-grid">
                  {filteredStudents.map((s) => {
                    const learning = getStudentLearningStats(s);
                    const game = getStudentMiniGameStats(s);
                    const badges = getStudentBadges(s);
                    const intervention = getInterventionSummary(s);

                    return (
                      <div key={s.id} className="student-card" onClick={() => setSelectedStudent(s)}>
                        <div className="student-header">
                          <div>
                            <h4>{s.name}</h4>
                            <span>{getClassName(s.classId)}</span>
                          </div>
                          <span className="student-badge">{getCurrentModule(s)}</span>
                        </div>

                        <div className="student-progress-mini">
                          <div className="mini-progress-label">
                            <span>Kemajuan</span>
                            <strong>{learning.completion}%</strong>
                          </div>
                          <div className="mini-progress-track">
                            <div style={{ width: `${learning.completion}%` }}></div>
                          </div>
                        </div>

                        <div className="student-metrics">
                          <span>{learning.totalPoints} mata</span>
                          <span>{badges} lencana</span>
                          <span>{game.passedGames}/3 mini game</span>
                          {intervention.totalEvents > 0 && <span>{intervention.totalEvents} kekeliruan</span>}
                        </div>

                        <div className="password-pictures">
                          {s.picturePassword?.map((pic, i) => (
                            <span key={i} className="picture-badge">{pic}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Analitik Prestasi</h2>
                <p>Ringkasan kemajuan, mini-game, dan pemantauan kekeliruan huruf.</p>
              </div>
            </div>

            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Kemajuan Modul Purata</h3>
                <div className="module-bars">
                  {moduleCompletionStats.map((mod) => (
                    <div key={mod.key} className="module-bar-row">
                      <div className="module-bar-label">
                        <strong>{mod.name}</strong>
                        <span>{mod.completed}/{mod.total}</span>
                      </div>
                      <div className="module-bar-track">
                        <div className="module-bar-fill" style={{ width: `${mod.percent}%` }}></div>
                      </div>
                      <div className="module-bar-percent">{mod.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="analytics-card">
                <h3>Pelajar Memerlukan Sokongan</h3>
                {studentsNeedingAttention.length === 0 ? (
                  <p className="empty-state compact">Tiada data mencukupi.</p>
                ) : (
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Pelajar</th>
                        <th>Modul</th>
                        <th>Ketepatan</th>
                        <th>Tahap Sokongan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsNeedingAttention.map((s) => (
                        <tr key={s.id} onClick={() => setSelectedStudent(s)} className="clickable-row">
                          <td>{s.name}</td>
                          <td>{s.currentModule}</td>
                          <td>{s.learning.accuracy}%</td>
                          <td>{s.support.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>


            <div className="analytics-card full heatmap-card">
              <h3>Heatmap Kekeliruan Huruf</h3>
              <p className="section-helper-text">
                Paparan ini menunjukkan pasangan huruf yang paling kerap dikelirukan dalam kelas.
              </p>

              {getClassConfusionHeatmap().length === 0 ? (
                <p className="empty-state compact">Tiada data kekeliruan huruf direkodkan.</p>
              ) : (
                <div className="confusion-heatmap-grid">
                  {getClassConfusionHeatmap().map((item) => (
                    <div
                      key={item.key}
                      className="heatmap-tile"
                      style={{ '--heat': `${item.intensity}%` }}
                    >
                      <div className="heatmap-pair">
                        {item.expectedLetter}<span>↔</span>{item.scannedLetter}
                      </div>
                      <div className="heatmap-count">{item.count} kali</div>
                      <div className="heatmap-meta">
                        {item.studentCount} pelajar · {item.highCount} risiko tinggi
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="analytics-card full intervention-analytics-card">
              <h3>Analisis Kekeliruan Huruf Cermin</h3>
              <p className="section-helper-text">
                Bahagian ini membantu guru mengenal pasti corak kekeliruan huruf dan memilih latihan susulan yang sesuai.
              </p>

              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Pelajar</th>
                    <th>Kelas</th>
                    <th>Jumlah Kekeliruan</th>
                    <th>Corak</th>
                    <th>Risiko</th>
                    <th>Pemantauan</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const summary = getInterventionSummary(s);
                    const analysis = getMirrorConfusionAnalysis(s);

                    return (
                      <tr key={s.id} onClick={() => setSelectedStudent(s)} className="clickable-row">
                        <td>{s.name}</td>
                        <td>{getClassName(s.classId)}</td>
                        <td>{summary.totalEvents}</td>
                        <td>{analysis[0] ? `${analysis[0].expectedLetter} ↔ ${analysis[0].scannedLetter}` : '-'}</td>
                        <td>{summary.overallRisk}</td>
                        <td>{summary.monitored}/{summary.totalPatterns}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="analytics-card full">
              <h3>Ringkasan Pelajar</h3>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Pelajar</th>
                    <th>Kelas</th>
                    <th>Kemajuan</th>
                    <th>Ketepatan Learning</th>
                    <th>Mini Game</th>
                    <th>Mata</th>
                    <th>Lencana</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const learning = getStudentLearningStats(s);
                    const game = getStudentMiniGameStats(s);
                    const badges = getStudentBadges(s);

                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{getClassName(s.classId)}</td>
                        <td>{learning.completion}%</td>
                        <td>{learning.accuracy}%</td>
                        <td>{game.passedGames}/3</td>
                        <td>{learning.totalPoints}</td>
                        <td>{badges}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Laporan Murid</h2>
                <p>Jana dan cetak laporan prestasi untuk dibawa balik oleh murid.</p>
              </div>
            </div>

         
    
            <div className="students-list">
              <h3>Pilih Murid untuk Jana Laporan</h3>

              {students.length === 0 ? (
                <p className="empty-state">Belum ada pelajar berdaftar.</p>
              ) : (
                <div className="report-students-grid">
                  {students.map((s) => {
                    const learning = getStudentLearningStats(s);
                    const intervention = getInterventionSummary(s);
                    const support = getLearningSupportAnalysis(s);

                    return (
                      <div key={s.id} className="report-student-card">
                        <div className="report-student-header">
                          <div>
                            <h4>{s.name}</h4>
                            <span>{getClassName(s.classId)}</span>
                          </div>
                          
                        </div>

                        <div className="report-quick-stats">
                          <div>
                            <strong>{learning.completion}%</strong>
                            <span>Kemajuan</span>
                          </div>
                          <div>
                            <strong>{learning.accuracy}%</strong>
                            <span>Ketepatan</span>
                          </div>
                          <div>
                            <strong>{intervention.totalEvents}</strong>
                            <span>Kekeliruan</span>
                          </div>
                        </div>

                        <button 
                          className="generate-report-btn"
                          onClick={() => window.print()}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 6 2 18 2 18 9"/>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                          </svg>
                          Jana & Cetak Laporan
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'sessions' && (
          <section className="tab-content">
            <div className="page-title-row">
              <div>
                <h2>Aktiviti Pelajar</h2>
                <p>Aktiviti terkini berdasarkan rekod kemajuan dalam Firebase.</p>
              </div>
            </div>

            <div className="sessions-table-container">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Pelajar</th>
                    <th>Kelas</th>
                    <th>Modul Semasa</th>
                    <th>Kemajuan</th>
                    <th>Mata</th>
                    <th>Aktiviti Terakhir</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const learning = getStudentLearningStats(s);

                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{getClassName(s.classId)}</td>
                        <td>{getCurrentModule(s)}</td>
                        <td>{learning.completedQuestions}/{learning.totalQuestions}</td>
                        <td>{learning.totalPoints}</td>
                        <td>{getLastActivity(s)}</td>
                        <td>
                          <button className="view-btn" onClick={() => setSelectedStudent(s)}>
                            Lihat Butiran
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedStudent.name}</h2>
                <p>{getClassName(selectedStudent.classId)}</p>
              </div>
              <button className="close-btn" onClick={() => setSelectedStudent(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="student-detail-grid">
                <div className="detail-box">
                  <span>Kemajuan</span>
                  <strong>{getStudentLearningStats(selectedStudent).completion}%</strong>
                </div>
                <div className="detail-box">
                  <span>Mata</span>
                  <strong>{getStudentLearningStats(selectedStudent).totalPoints}</strong>
                </div>
                <div className="detail-box">
                  <span>Lencana</span>
                  <strong>{getStudentBadges(selectedStudent)}</strong>
                </div>
                <div className="detail-box">
                  <span>Tahap Sokongan</span>
                  <strong>{getLearningSupportAnalysis(selectedStudent).level}</strong>
                </div>
              </div>

              <div className="learning-support-card">
                <div className="learning-support-header">
                  <div>
                    <h3>Analisis Sokongan Pembelajaran</h3>
                    <p>
                      Analisis ini menggabungkan ketepatan learning, percubaan berulang,
                      prestasi mini game dan kekeliruan huruf.
                    </p>
                  </div>
                  <span className={`severity-pill ${getLearningSupportAnalysis(selectedStudent).levelClass}`}>
                    {getLearningSupportAnalysis(selectedStudent).level}
                  </span>
                </div>

                <div className="support-factor-grid">
                  <div>
                    <strong>{getLearningSupportAnalysis(selectedStudent).accuracy}%</strong>
                    <span>Ketepatan Learning</span>
                  </div>
                  <div>
                    <strong>{getLearningSupportAnalysis(selectedStudent).avgAttempts}</strong>
                    <span>Purata Percubaan</span>
                  </div>
                  <div>
                    <strong>{getLearningSupportAnalysis(selectedStudent).gameAccuracy}%</strong>
                    <span>Ketepatan Mini Game</span>
                  </div>
                  <div>
                    <strong>{getLearningSupportAnalysis(selectedStudent).confusionEvents}</strong>
                    <span>Kekeliruan Huruf</span>
                  </div>
                </div>

                <div className="support-recommendation-box">
                  <strong>Cadangan Sistem</strong>
                  <p>{getLearningSupportAnalysis(selectedStudent).recommendation}</p>
                </div>

                {getLearningSupportAnalysis(selectedStudent).factors.length > 0 && (
                  <div className="support-factor-list">
                    <strong>Faktor yang dikesan:</strong>
                    <ul>
                      {getLearningSupportAnalysis(selectedStudent).factors.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <h3>Kata Laluan Gambar</h3>
              <div className="password-pictures big">
                {selectedStudent.picturePassword?.map((pic, i) => (
                  <span key={i} className="picture-badge">{pic}</span>
                ))}
              </div>

              <h3>Perkembangan Modul</h3>
              <div className="module-detail-list">
                {MODULES.map((mod) => {
                  const moduleData = selectedStudent.progress?.[mod.key] || {};
                  const mini = moduleData.minigame;
                  const badgeEarned = selectedStudent.badges?.[mod.badge]?.earned;

                  const qRecords = Object.entries(moduleData).filter(
                    ([key, val]) => key.startsWith('q') && typeof val === 'object'
                  );

                  const completed = qRecords.length;
                  const points = qRecords.reduce((sum, [, val]) => sum + (val.points || 0), 0);

                  return (
                    <div key={mod.key} className="module-detail-card">
                      <div>
                        <strong>{mod.name}</strong>
                        <span>{completed}/5 aktiviti learning · {points} mata</span>
                      </div>
                      <div className="module-status-group">
                        <span className={mini?.passed ? 'status-pill good' : 'status-pill'}>
                          Mini Game {mini ? `${mini.score}/${mini.total}` : '-'}
                        </span>
                        <span className={badgeEarned ? 'status-pill good' : 'status-pill'}>
                          {badgeEarned ? 'Lencana diperoleh' : 'Belum lengkap'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h3>Analisis Kekeliruan Huruf & Cadangan Sokongan</h3>
              <div className="intervention-summary-strip">
                <div>
                  <strong>{getInterventionSummary(selectedStudent).totalEvents}</strong>
                  <span>Jumlah Kekeliruan</span>
                </div>
                <div>
                  <strong>{getInterventionSummary(selectedStudent).totalPatterns}</strong>
                  <span>Corak Dikesan</span>
                </div>
                <div>
                  <strong>{getInterventionSummary(selectedStudent).monitored}</strong>
                  <span>Dalam Pemantauan</span>
                </div>
              </div>

              <div className="confusion-analysis-list">
                {getMirrorConfusionAnalysis(selectedStudent).length === 0 ? (
                  <div className="empty-state compact">
                    Tiada kekeliruan huruf direkodkan.
                  </div>
                ) : (
                  getMirrorConfusionAnalysis(selectedStudent).map((item) => {
                    const draftKey = `${selectedStudent.id}-${item.pair}`;
                    const noteValue =
                      teacherNotes[draftKey] !== undefined
                        ? teacherNotes[draftKey]
                        : item.teacherNote || '';

                    return (
                      <div key={item.pair} className="confusion-analysis-card">
                        <div className="confusion-top-row">
                          <div>
                            <div className="confusion-pair-big">
                              {item.expectedLetter}<span>↔</span>{item.scannedLetter}
                            </div>
                            <p className="confusion-subtitle">{item.frequency} · {item.count} kali dikelirukan</p>
                          </div>

                          <div className={`severity-pill ${item.severityClass}`}>
                            {item.severity}
                          </div>
                        </div>

                        <div className="intervention-diagnosis-grid">
                          <div className="diagnosis-box">
                            <span>Kemungkinan Isu</span>
                            <p>{item.issue}</p>
                          </div>
                          <div className="diagnosis-box">
                            <span>Fokus Guru</span>
                            <p>{item.focus}</p>
                          </div>
                        </div>

                        <div className="intervention-plan-box">
                          <strong>Cadangan Sokongan Pembelajaran</strong>
                          <p>{item.activity}</p>
                        </div>

                        <div className="intervention-plan-box home">
                          <strong>Sokongan Ringkas Di Rumah</strong>
                          <p>{item.homeSupport}</p>
                        </div>

                        <div className="teacher-monitoring-box">
                          <div className="teacher-monitoring-header">
                            <div>
                              <strong>Status Pemantauan Guru</strong>
                              <span>Status semasa: {item.status}</span>
                            </div>
                            {item.updatedAt && <small>Dikemaskini pada {formatDate(item.updatedAt)}</small>}
                          </div>

                          <div className="monitoring-options">
                            <label>
                              <input
                                type="checkbox"
                                checked={!!item.monitoring?.underMonitoring}
                                onChange={(e) =>
                                  handleUpdateMonitoringField(selectedStudent, item, 'underMonitoring', e.target.checked)
                                }
                              />
                              Dalam Pemantauan
                            </label>

                            <label>
                              <input
                                type="checkbox"
                                checked={!!item.monitoring?.supportGiven}
                                onChange={(e) =>
                                  handleUpdateMonitoringField(selectedStudent, item, 'supportGiven', e.target.checked)
                                }
                              />
                              Sokongan Sedang Diberikan
                            </label>

                            <label>
                              <input
                                type="checkbox"
                                checked={!!item.monitoring?.isImproving}
                                onChange={(e) =>
                                  handleUpdateMonitoringField(selectedStudent, item, 'isImproving', e.target.checked)
                                }
                              />
                              Menunjukkan Peningkatan
                            </label>
                          </div>
                        </div>

                        <div className="teacher-notes-box">
                          <div className="teacher-notes-header">
                            <strong>Catatan Guru</strong>
                            {item.noteUpdatedAt && <small>Disimpan pada {formatDate(item.noteUpdatedAt)}</small>}
                          </div>

                          <textarea
                            rows="4"
                            value={noteValue}
                            onChange={(e) =>
                              setTeacherNotes((prev) => ({
                                ...prev,
                                [draftKey]: e.target.value
                              }))
                            }
                            placeholder="Contoh: Pelajar masih keliru semasa aktiviti bacaan, tetapi lebih yakin apabila menggunakan bantuan visual."
                          />

                          <button
                            type="button"
                            className="save-note-btn"
                            onClick={() => handleSaveTeacherNote(selectedStudent, item)}
                          >
                            Simpan Catatan
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedStudent.parentEmail && (
                <>
                  <h3>Emel Ibu Bapa</h3>
                  <p>{selectedStudent.parentEmail}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;