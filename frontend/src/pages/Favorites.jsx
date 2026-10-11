import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { PropertyCard } from './Home.jsx';

export default function Favorites() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');

  const loadFavorites = async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await api('/favorites');
      setList(data || []);
      // Also sync localStorage
      localStorage.setItem('favorites', JSON.stringify((data || []).map((p) => p.id)));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const toggleFavorite = async (id) => {
    try {
      await api('/favorites/' + id, { method: 'DELETE' });
      setList((prev) => prev.filter((p) => p.id !== id));
      const local = JSON.parse(localStorage.getItem('favorites') || '[]');
      localStorage.setItem('favorites', JSON.stringify(local.filter((x) => x !== id)));
      setToast('Removed from saved properties');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="favorites-page section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAVED HOMES</p>
          <h2>Your Favorite Properties</h2>
          <p className="muted">Properties you've shortlisted for quick access and comparison.</p>
        </div>
        {!loading && <span className="muted">{list.length} saved</span>}
      </div>

      {toast && <div className="success">{toast}</div>}
      {err && <div className="error">{err}</div>}

      {loading ? (
        <div className="grid">
          {[1, 2, 3].map((x) => (
            <div className="skeleton-card" key={x}>
              <div />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="property-grid">
          {list.map((p) => (
            <PropertyCard
              key={p.id}
              p={p}
              favorite={true}
              toggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span>♥</span>
          <h3>No saved properties yet</h3>
          <p>Click the heart icon on any listing to save it to your favorites.</p>
          <Link to="/" className="btn" style={{ marginTop: '16px' }}>
            Explore homes
          </Link>
        </div>
      )}
    </div>
  );
}
