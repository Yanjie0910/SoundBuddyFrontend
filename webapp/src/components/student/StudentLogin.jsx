import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import './StudentLogin.css';

const PICTURE_POOL = [
  'cat','dog','apple','car','star','tree','fish','book','hat','ball',
  'sun','moon','leaf','shoe','cup','bird','cake','bus','key','frog'
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
      if (!teachersSnap.exists()) throw new Error('No classes found');

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

      if (!teacherId) throw new Error('Class not found');

      const studentsSnap = await get(
        ref(database, `teachers/${teacherId}/students`)
      );

      if (!studentsSnap.exists())
        throw new Error('No students in this class');

      const students = studentsSnap.val();
      const entry = Object.entries(students).find(
        ([, s]) =>
          s.name.toLowerCase() === studentName.trim().toLowerCase() &&
          s.classId === classId
      );

      if (!entry) throw new Error('Student not found');

      const [studentId, student] = entry;

      if (
        JSON.stringify(student.picturePassword) !==
        JSON.stringify(selectedPics)
      ) {
        throw new Error('Incorrect picture password');
      }

      // ✅ SAVE SESSION (CRITICAL)
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
      <h2>Student Login</h2>

      <form onSubmit={handleLogin} className="student-login-form">
        <input
          type="text"
          placeholder="Student Name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Class Name"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          required
        />

        <p>Select your 3 pictures in order:</p>

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
              <img src={`/images/icons/${pic}.png`} alt={pic} />
              {pic}
            </button>
          ))}
        </div>

        {selectedPics.length > 0 && (
          <button type="button" className="reset-btn" onClick={handleReset}>
            Reset
          </button>
        )}

        {error && <div className="student-login-error">{error}</div>}

        <button type="submit" disabled={selectedPics.length !== 3 || loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default StudentLogin;
