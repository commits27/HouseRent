import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api';

export const TYPES = ['Villa', 'Apartment', 'Flat', 'Independent House', 'Studio', 'PG / Hostel', 'Other'];
const empty = { area: '', type: 'All', min: '', max: '' };

export default function Home() {
  const [f, setF] = useState(empty);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (filters = f) => {
    setLoading(true); setErr('');
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v !== '' && v !== 'All' && q.set(k, v));
    try { setList(await api('/properties?' + q)); } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(empty); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <form className="filters card" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Area / location" value={f.area} onChange={set('area')} />
        <select value={f.type} onChange={set('type')}>{['All', ...TYPES].map((t) => <option key={t}>{t}</option>)}</select>
        <input type="number" min="0" placeholder="Min price" value={f.min} onChange={set('min')} />
        <input type="number" min="0" placeholder="Max price" value={f.max} onChange={set('max')} />
        <button className="btn">Search</button>
        <button type="button" className="btn ghost" onClick={() => { setF(empty); load(empty); }}>Reset</button>
      </form>
      {err && <div className="error">{err}</div>}
      {loading ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No properties match your filters.</p> : (
        <div className="grid">
          {list.map((p) => (
            <Link to={'/property/' + p.id} className="prop card" key={p.id}>
              <img src={p.images?.[0] || 'https://placehold.co/600x400?text=No+Image'} alt={p.title} />
              <div className="pad">
                <span className="tag">{p.type}</span>
                <h3>{p.title}</h3>
                <p className="muted">📍 {p.area}, {p.city} · {p.bedrooms} bed · {p.bathrooms} bath</p>
                <b className="price">{inr(p.rent)}<small>/month</small></b>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
