
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import '../../auth/AuthForm.css';

function TeacherSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');


  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/teacher-dashboard');
    } catch (err) {
       setError('Pendaftaran gagal. Sila cuba lagi.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Pendaftaran Guru</h2>
      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Emel"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Kata Laluan"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="auth-error">{error}</div>}
        <button type="submit">Daftar</button>
      </form>
      <div className="auth-link">
        Sudah mempunyai akaun?{' '}
        <span onClick={() => navigate('/teacher-login')}>Log Masuk</span>
      </div>
    </div>
  );
}

export default TeacherSignup;
