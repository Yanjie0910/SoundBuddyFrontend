
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import '../../auth/AuthForm.css';

function TeacherLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');


  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/teacher-dashboard');
    } catch (err) {
setError('Log masuk gagal. Sila cuba lagi.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Log Masuk Guru</h2>
      <form onSubmit={handleLogin}>
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
        <button type="submit">Log Masuk</button>
      </form>
      <div className="auth-link">
        Belum mempunyai akaun?{' '}
<span onClick={() => navigate('/teacher-signup')}>Daftar</span>

      </div>
    </div>
  );
}

export default TeacherLogin;
