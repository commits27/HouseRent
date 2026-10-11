import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Login, Register } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import MyBookings from './pages/MyBookings.jsx';
import MyProperties from './pages/MyProperties.jsx';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const seen = useRef(null);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  const onAuth = (d, registered = false) => { localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); setUser(d.user); setToast({ ok: true, text: registered ? 'Account created successfully. Welcome to House Hunt!' : 'Welcome back to House Hunt.' }); nav('/'); };
  const logout = () => { localStorage.clear(); setUser(null); seen.current = null; nav('/'); };

  useEffect(() => {
    if (!user) return;
    const tick = async () => { try {
      const [mine, reqs] = await Promise.all([api('/bookings/mine'), api('/bookings/requests')]);
      const snap = {}; mine.forEach((b) => (snap['m' + b.id] = b.status)); reqs.forEach((b) => (snap['r' + b.id] = b.status));
      if (seen.current) {
        mine.forEach((b) => { const old = seen.current['m' + b.id]; if (old && old !== b.status) setToast({ ok: b.status === 'APPROVED', text: `Your booking for "${b.propertyTitle}" is ${b.status.toLowerCase()}.` }); });
        reqs.forEach((b) => { if (!('r' + b.id in seen.current)) setToast({ ok: true, text: `New booking request for "${b.propertyTitle}".` }); });
      } seen.current = snap;
    } catch { /* page-level API errors remain visible */ } };
    tick(); const timer = setInterval(tick, 8000); return () => clearInterval(timer);
  }, [user]);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(null), 6000); return () => clearTimeout(timer); }, [toast]);
  const guard = (element) => user ? element : <Navigate to="/login" replace />;
  return <div className="app-shell">
    <header className="nav">
      <Link to="/" className="brand"><span className="brand-mark">⌂</span><span>HOUSE<span>HUNT</span></span></Link>
      <button className="menu-toggle" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : '☰'}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}><NavLink to="/" end>Home</NavLink><NavLink to="/">Explore</NavLink>{user && <NavLink to="/my-bookings">My bookings</NavLink>}{user && <NavLink to="/my-properties">List a property</NavLink>}</nav>
      <div className="nav-actions"><button className="icon-btn" title="Toggle dark mode" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button>{user ? <><span className="welcome">Hi, {user.name?.split(' ')[0]}</span><button className="btn outline small" onClick={logout}>Log out</button></> : <><Link className="login-link" to="/login">Log in</Link><Link className="btn small" to="/register">Get started</Link></>}</div>
    </header>
    {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'bad')} onClick={() => setToast(null)}>{toast.text}</div>}
    <main><Routes><Route path="/" element={<Home />} /><Route path="/property/:id" element={<PropertyDetail />} /><Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuth={onAuth} />} /><Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onAuth={onAuth} />} /><Route path="/my-bookings" element={guard(<MyBookings />)} /><Route path="/my-properties" element={guard(<MyProperties />)} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></main>
    <footer className="footer"><div><Link to="/" className="brand footer-brand"><span className="brand-mark">⌂</span><span>HOUSE<span>HUNT</span></span></Link><p>Find a place that feels like home.</p></div><div className="footer-links"><div><b>Explore</b><Link to="/">Properties</Link><Link to="/register">List your place</Link></div><div><b>Company</b><a href="#why">Why House Hunt</a><a href="#how">How it works</a></div><div><b>Connect</b><a href="mailto:hello@househunt.example">hello@househunt.example</a><span>Hyderabad, India</span></div></div><small>© 2026 House Hunt. Demo content is clearly marked where used.</small></footer>
  </div>;
}
