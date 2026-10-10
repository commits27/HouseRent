import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Login, Register } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import MyProperties from './pages/MyProperties.jsx';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [toast, setToast] = useState(null);
  const seen = useRef(null);
  const nav = useNavigate();

  const onAuth = (d) => { localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); setUser(d.user); nav('/'); };
  const logout = () => { localStorage.clear(); setUser(null); seen.current = null; nav('/login'); };

  // Poll for booking updates: tenants get approve/reject alerts, owners get new-request alerts.
  useEffect(() => {
    if (!user) return;
    const tick = async () => {
      try {
        const [mine, reqs] = await Promise.all([api('/bookings/mine'), api('/bookings/requests')]);
        const snap = {};
        mine.forEach((b) => (snap['m' + b.id] = b.status));
        reqs.forEach((b) => (snap['r' + b.id] = b.status));
        if (seen.current) {
          mine.forEach((b) => {
            const old = seen.current['m' + b.id];
            if (old && old !== b.status)
              setToast({ ok: b.status === 'APPROVED', text: `Your booking for "${b.propertyTitle}" (${b.startDate} → ${b.endDate}) was ${b.status.toLowerCase()}.` });
          });
          reqs.forEach((b) => {
            if (!('r' + b.id in seen.current)) setToast({ ok: true, text: `New booking request for "${b.propertyTitle}" from ${b.tenantName}.` });
          });
        }
        seen.current = snap;
      } catch {}
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); } }, [toast]);

  const guard = (el) => (user ? el : <Navigate to="/login" />);
  return (
    <>
      {user && (
        <header className="nav">
          <b className="logo">🏠 RentEase</b>
          <nav>
            <NavLink to="/" end>Browse</NavLink>
            <NavLink to="/my-bookings">My Bookings</NavLink>
            <NavLink to="/my-properties">My Properties</NavLink>
          </nav>
          <span className="who">Hi, {user.name} <button className="btn ghost" onClick={logout}>Logout</button></span>
        </header>
      )}
      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'bad')} onClick={() => setToast(null)}>{toast.text}</div>}
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login onAuth={onAuth} />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register onAuth={onAuth} />} />
          <Route path="/" element={guard(<Home />)} />
          <Route path="/property/:id" element={guard(<PropertyDetail />)} />
          <Route path="/my-bookings" element={guard(<MyBookings />)} />
          <Route path="/my-properties" element={guard(<MyProperties />)} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}
