import { useEffect, useState } from 'react';
import { api, inr } from '../api';
import { TYPES } from './Home.jsx';
import { Status } from './MyBookings.jsx';

const blank = { title: '', type: 'Apartment', city: '', area: '', rent: '', bedrooms: 1, bathrooms: 1, sqft: '', description: '', amenities: '', images: '' };
const csv = (s) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export default function MyProperties() {
  const [mine, setMine] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState(null);

  const load = () => Promise.all([api('/properties/mine'), api('/bookings/requests')]).then(([a, b]) => { setMine(a); setReqs(b); }).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault(); setMsg(null);
    try {
      await api('/properties', { method: 'POST', body: { ...f, rent: +f.rent, bedrooms: +f.bedrooms, bathrooms: +f.bathrooms, sqft: +f.sqft || 0, amenities: csv(f.amenities), images: csv(f.images) } });
      setF(blank); setMsg({ ok: true, text: 'Property listed successfully!' }); load();
    } catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const decide = async (id, value) => { try { await api(`/bookings/${id}/status?value=${value}`, { method: 'PUT' }); setMsg({ ok: true, text: `Booking ${value.toLowerCase()}.` }); } catch (x) { setMsg({ ok: false, text: x.message }); } load(); };
  const del = async (id) => { if (confirm('Delete this listing?')) { await api('/properties/' + id, { method: 'DELETE' }); load(); } };

  return (
    <>
      <h1>Booking Requests</h1>
      {msg && <div className={msg.ok ? 'success' : 'error'}>{msg.text}</div>}
      {reqs.length === 0 && <p className="muted">No booking requests yet.</p>}
      {reqs.map((b) => (
        <div className="card row" key={b.id}>
          <div><h3>{b.propertyTitle}</h3><p className="muted">{b.tenantName} · {b.startDate} → {b.endDate} ({b.months} months) · {inr(b.totalRent)}</p></div>
          {b.status === 'PENDING'
            ? <div className="actions"><button className="btn" onClick={() => decide(b.id, 'APPROVED')}>Approve</button><button className="btn danger" onClick={() => decide(b.id, 'REJECTED')}>Reject</button></div>
            : <Status s={b.status} />}
        </div>
      ))}

      <h1>List a New Property</h1>
      <form className="card pad formgrid" onSubmit={add}>
        <input placeholder="Title" value={f.title} onChange={set('title')} required />
        <select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input placeholder="City" value={f.city} onChange={set('city')} required />
        <input placeholder="Area / locality" value={f.area} onChange={set('area')} required />
        <input type="number" min="1" placeholder="Monthly rent (₹)" value={f.rent} onChange={set('rent')} required />
        <input type="number" min="0" placeholder="Sq ft" value={f.sqft} onChange={set('sqft')} />
        <input type="number" min="0" placeholder="Bedrooms" value={f.bedrooms} onChange={set('bedrooms')} />
        <input type="number" min="0" placeholder="Bathrooms" value={f.bathrooms} onChange={set('bathrooms')} />
        <textarea className="full" placeholder="Description" value={f.description} onChange={set('description')} />
        <textarea className="full" placeholder="Amenities (comma separated: Parking, Gym, Lift…)" value={f.amenities} onChange={set('amenities')} />
        <textarea className="full" placeholder="Image URLs (comma or new-line separated)" value={f.images} onChange={set('images')} />
        <button className="btn full">List property</button>
      </form>

      <h1>My Listings</h1>
      {mine.length === 0 && <p className="muted">You haven't listed anything yet.</p>}
      {mine.map((p) => (
        <div className="card row" key={p.id}>
          <div><h3>{p.title}</h3><p className="muted">{p.type} · {p.area}, {p.city} · {inr(p.rent)}/month</p></div>
          <button className="btn danger" onClick={() => del(p.id)}>Delete</button>
        </div>
      ))}
    </>
  );
}
