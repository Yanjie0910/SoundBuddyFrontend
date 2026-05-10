import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../../firebase';
import { ref, get } from 'firebase/database';
import './StudentLogin.css';

const PICTURE_POOL = [
  'kucing','anjing','epal','kereta','bintang',
  'pokok','ikan','buku','topi','bola',
  'pisang','bulan','daun','kasut','cawan',
  'burung','kek','bas','kunci','katak'
];

function StudentLogin() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [selectedPics, setSelectedPics] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePicClick = (pic) => {
    if (selectedPics.length < 3 && !selectedPics.includes(pic)) {
      setSelectedPics([...selectedPics, pic]);
    }
  };

  const handleReset = () => setSelectedPics([]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const teachersSnap = await get(ref(database, 'teachers'));
      if (!teachersSnap.exists()) throw new Error('Tiada kelas dijumpai');

      const teachers = teachersSnap.val();
      let teacherId = null;
      let classId = null;

      for (const tId in teachers) {
        const classrooms = teachers[tId]?.classrooms || {};
        for (const cId in classrooms) {
          if (
            classrooms[cId].name.trim().toLowerCase() ===
            className.trim().toLowerCase()
          ) {
            teacherId = tId;
            classId = cId;
            break;
          }
        }
        if (teacherId) break;
      }

      if (!teacherId) throw new Error('Kelas tidak dijumpai');

      const studentsSnap = await get(
        ref(database, `teachers/${teacherId}/students`)
      );

      if (!studentsSnap.exists())
        throw new Error('Tiada pelajar dalam kelas ini');

      const students = studentsSnap.val();
      const entry = Object.entries(students).find(
        ([, s]) =>
          s.name.toLowerCase() === studentName.trim().toLowerCase() &&
          s.classId === classId
      );

      if (!entry) throw new Error('Pelajar tidak dijumpai');

      const [studentId, student] = entry;

      if (
        JSON.stringify(student.picturePassword) !==
        JSON.stringify(selectedPics)
      ) {
        throw new Error('Kata laluan gambar tidak betul');
      }

      //  SAVE SESSION (CRITICAL)
      localStorage.setItem(
        'studentSession',
        JSON.stringify({
          studentId,
          studentName: student.name,
          classId,
          teacherId
        })
      );

      navigate('/student-dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-login-container">
      <h2>Log Masuk Pelajar</h2>

      <form onSubmit={handleLogin} className="student-login-form">
        <input
          type="text"
          placeholder="Nama Pelajar"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Nama Kelas"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          required
        />

        <p>Pilih 3 gambar anda mengikut urutan:</p>

        <div className="picture-pool">
          {PICTURE_POOL.map((pic) => (
            <button
              type="button"
              key={pic}
              className={`pic-btn ${
                selectedPics.includes(pic) ? 'selected' : ''
              }`}
              onClick={() => handlePicClick(pic)}
              disabled={selectedPics.length >= 3}
            >
              <img src={`/images/icons/${pic}.png`}  />
              {pic.charAt(0).toUpperCase() + pic.slice(1)}
            </button>
          ))}
        </div>

        {selectedPics.length > 0 && (
          <button type="button" className="reset-btn" onClick={handleReset}>
            Set Semula
          </button>
        )}

        {error && <div className="student-login-error">{error}</div>}

        <button type="submit" disabled={selectedPics.length !== 3 || loading}>
          {loading ? 'Sedang log masuk...' : 'Log Masuk'}
        </button>
      </form>
    </div>
  );
}

export default StudentLogin;
