import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, inr } from '../api';

const today = () => new Date().toISOString().slice(0, 10);

export default function PropertyDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [img, setImg] = useState(0);
  const [months, setMonths] = useState(6);
  const [start, setStart] = useState(today());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/properties/' + id).then(setP).catch((e) => setMsg({ ok: false, text: e.message })); }, [id]);
  if (!p) return <p className="muted">{msg ? msg.text : 'Loading…'}</p>;

  const book = async () => {
    setBusy(true); setMsg(null);
    try {
      const b = await api('/bookings', { method: 'POST', body: { propertyId: p.id, startDate: start, months: Number(months) } });
      setMsg({ ok: true, text: `✅ Booking request sent for ${b.startDate} to ${b.endDate} (${b.months} months, total ${inr(b.totalRent)}). You'll be notified once the owner approves or rejects it.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  return (
    <div className="detail">
      <Link to="/" className="muted">← Back to listings</Link>
      <div className="gallery">
        <img className="main" src={p.images?.[img] || 'https://placehold.co/900x500?text=No+Image'} alt="" />
        <div className="thumbs">{p.images?.map((u, i) => <img key={i} src={u} className={i === img ? 'on' : ''} onClick={() => setImg(i)} alt="" />)}</div>
      </div>
      <div className="two">
        <section className="card pad">
          <span className="tag">{p.type}</span>
          <h1>{p.title}</h1>
          <p className="muted">📍 {p.area}, {p.city} · Listed by {p.ownerName}</p>
          <div className="facts"><span>🛏 {p.bedrooms} Beds</span><span>🛁 {p.bathrooms} Baths</span><span>📐 {p.sqft} sq ft</span></div>
          <p>{p.description}</p>
          <h3>Amenities</h3>
          <div className="chips">{p.amenities?.map((a) => <span key={a} className="chip">✔ {a}</span>)}</div>
        </section>
        <aside className="card pad book">
          <h2>{inr(p.rent)} <small>/month</small></h2>
          <label>Start date<input type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Number of months
            <select value={months} onChange={(e) => setMonths(e.target.value)}>{[1, 2, 3, 6, 9, 11, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}</select>
          </label>
          <div className="total"><span>Total rent</span><b>{inr(p.rent * months)}</b></div>
          <button className="btn" onClick={book} disabled={busy}>{busy ? 'Booking…' : 'Book this property'}</button>
          {msg && <div className={msg.ok ? 'success' : 'error'}>{msg.text}</div>}
        </aside>
      </div>
    </div>
  );
}
