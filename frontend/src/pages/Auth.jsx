import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function Form({ mode, onAuth }) {
  const reg = mode === 'register';
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onAuth(await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: f })); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>🏠 RentEase</h1>
        <p className="muted">{reg ? 'Create your account' : 'Login to find or list homes'}</p>
        {reg && <input placeholder="Full name" value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        {reg && <input placeholder="Phone" value={f.phone} onChange={set('phone')} />}
        <input type="password" placeholder="Password (min 6 chars)" value={f.password} onChange={set('password')} required />
        {err && <div className="error">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Register' : 'Login'}</button>
        <p className="muted">{reg ? <>Have an account? <Link to="/login">Login</Link></> : <>New here? <Link to="/register">Register</Link></>}</p>
      </form>
    </div>
  );
}
export const Login = (p) => <Form mode="login" {...p} />;
export const Register = (p) => <Form mode="register" {...p} />;
