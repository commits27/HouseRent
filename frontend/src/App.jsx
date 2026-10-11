import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Login, Register } from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Favorites from './pages/Favorites.jsx';
import MyBookings from './pages/MyBookings.jsx';
import MyProperties from './pages/MyProperties.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const seen = useRef(null);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Verify auth session on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api('/auth/me')
        .then((userData) => {
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        });
    }
  }, []);

  const onAuth = (d, registered = false) => {
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
    setUser(d.user);
    setToast({
      ok: true,
      text: registered
        ? 'Account created successfully. Welcome to HOUSE HUNT!'
        : `Welcome back, ${d.user.name || 'there'}!`,
    });
    nav('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    seen.current = null;
    setToast({ ok: true, text: 'You have been signed out.' });
    nav('/');
  };

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
            if (old && old !== b.status) {
              setToast({
                ok: b.status === 'APPROVED',
                text: `Your booking for "${b.propertyTitle}" is ${b.status.toLowerCase()}.`,
              });
            }
          });
          reqs.forEach((b) => {
            if (!('r' + b.id in seen.current)) {
              setToast({ ok: true, text: `New booking request for "${b.propertyTitle}".` });
            }
          });
        }
        seen.current = snap;
      } catch {
        /* handled gracefully */
      }
    };
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const guard = (element) => (user ? element : <Navigate to="/login" replace />);
  const adminGuard = (element) =>
    user && user.role === 'admin' ? element : <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      <header className="nav">
        <Link to="/" className="brand">
          <span className="brand-mark">⌂</span>
          <span>HOUSE<span>HUNT</span></span>
        </Link>

        <button
          className="menu-toggle"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <NavLink to="/" end>
            Explore
          </NavLink>
          {user && (
            <NavLink to="/favorites">
              ♥ Saved
            </NavLink>
          )}
          {user && (
            <NavLink to="/my-bookings">
              Bookings & Inquiries
            </NavLink>
          )}
          {user && (
            <NavLink to="/my-properties">
              List Property
            </NavLink>
          )}
          {user && user.role === 'admin' && (
            <NavLink to="/admin" className="admin-nav-link">
              🛡 Admin
            </NavLink>
          )}
        </nav>

        <div className="nav-actions">
          <button className="icon-btn" title="Toggle dark mode" onClick={() => setDark(!dark)}>
            {dark ? '☀' : '☾'}
          </button>
          {user ? (
            <div className="user-profile-menu">
              <span className="welcome">
                Hi, <b>{user.name?.split(' ')[0]}</b>
                {user.role === 'admin' && <span className="admin-badge">Admin</span>}
              </span>
              <button className="btn outline small" onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <>
              <Link className="login-link" to="/login">
                Log in
              </Link>
              <Link className="btn small" to="/register">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {toast && (
        <div className={'toast ' + (toast.ok ? 'ok' : 'bad')} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/favorites" element={guard(<Favorites />)} />
          <Route path="/admin" element={adminGuard(<Admin />)} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuth={onAuth} />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onAuth={onAuth} />} />
          <Route path="/my-bookings" element={guard(<MyBookings />)} />
          <Route path="/my-properties" element={guard(<MyProperties />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="footer">
        <div>
          <Link to="/" className="brand footer-brand">
            <span className="brand-mark">⌂</span>
            <span>HOUSE<span>HUNT</span></span>
          </Link>
          <p>Find your place. Feel at home.</p>
        </div>
        <div className="footer-links">
          <div>
            <b>Explore</b>
            <Link to="/">Properties</Link>
            <Link to="/favorites">Saved homes</Link>
            <Link to="/my-properties">List your place</Link>
          </div>
          <div>
            <b>Features</b>
            <a href="#why">Why House Hunt</a>
            <a href="#how">How it works</a>
            <a href="#listings">Featured spaces</a>
          </div>
          <div>
            <b>Contact</b>
            <a href="mailto:support@househunt.example">support@househunt.example</a>
            <span>Hyderabad · Bangalore · Mumbai</span>
          </div>
        </div>
        <small>© 2026 HOUSE HUNT. All rights reserved. Built with React, Python Flask, and MySQL.</small>
      </footer>
    </div>
  );
}
