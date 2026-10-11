import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function Form({ mode, onAuth }) {
  const reg = mode === 'register';
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((current) => ({ ...current, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');

    if (reg) {
      if (!f.name.trim()) {
        setErr('Please provide your full name.');
        return;
      }
      if (f.password.length < 6) {
        setErr('Password must be at least 6 characters.');
        return;
      }
      if (f.password !== f.confirmPassword) {
        setErr('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setBusy(true);
    try {
      const payload = {
        email: f.email.trim(),
        password: f.password,
        ...(reg ? { name: f.name.trim(), phone: f.phone.trim() } : {}),
      };
      const res = await api(reg ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: payload,
      });
      onAuth(res, reg);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card pad" onSubmit={submit}>
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '8px' }}>
          <span className="brand-mark">⌂</span>
          <span style={{ fontSize: '20px' }}>HOUSE<span style={{ fontWeight: 400 }}>HUNT</span></span>
        </div>
        <h2 style={{ textAlign: 'center', margin: '4px 0 12px', font: "500 24px 'Playfair Display', serif" }}>
          {reg ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="muted" style={{ textAlign: 'center', margin: '0 0 16px' }}>
          {reg ? 'Join House Hunt to explore, save, and list properties.' : 'Log in to manage your favorites, bookings, and listings.'}
        </p>

        {reg && (
          <label className="input-label">
            Full name
            <input
              placeholder="e.g. Rahul Sharma"
              value={f.name}
              onChange={set('name')}
              required
            />
          </label>
        )}

        <label className="input-label">
          Email address
          <input
            type="email"
            placeholder="e.g. rahul@example.com"
            value={f.email}
            onChange={set('email')}
            required
          />
        </label>

        {reg && (
          <label className="input-label">
            Phone number (optional)
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={f.phone}
              onChange={set('phone')}
            />
          </label>
        )}

        <label className="input-label">
          Password
          <input
            type="password"
            placeholder="Min. 6 characters"
            value={f.password}
            onChange={set('password')}
            minLength="6"
            required
          />
        </label>

        {reg && (
          <label className="input-label">
            Confirm password
            <input
              type="password"
              placeholder="Re-enter password"
              value={f.confirmPassword}
              onChange={set('confirmPassword')}
              minLength="6"
              required
            />
          </label>
        )}

        {err && <div className="error">{err}</div>}

        <button className="btn" style={{ width: '100%', marginTop: '8px' }} disabled={busy}>
          {busy ? 'Please wait…' : reg ? 'Create Account' : 'Sign In'}
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px' }}>
          {reg ? (
            <>Already have an account? <Link to="/login" style={{ color: 'var(--navy)', fontWeight: 600 }}>Log in</Link></>
          ) : (
            <>New to House Hunt? <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 600 }}>Create an account</Link></>
          )}
        </p>
      </form>
    </div>
  );
}

export const Login = (p) => <Form mode="login" {...p} />;
export const Register = (p) => <Form mode="register" {...p} />;
