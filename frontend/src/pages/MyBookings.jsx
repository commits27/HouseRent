import { useEffect, useState } from 'react';
import { api, inr } from '../api';

export const Status = ({ s }) => <span className={'status ' + s.toLowerCase()}>{s}</span>;

export default function MyBookings() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    const load = () => api('/bookings/mine').then(setList).catch((e) => setErr(e.message));
    load(); const t = setInterval(load, 8000); return () => clearInterval(t);
  }, []);
  return (
    <>
      <h1>My Bookings</h1>
      {err && <div className="error">{err}</div>}
      {list.length === 0 && <p className="muted">You haven't booked anything yet.</p>}
      {list.map((b) => (
        <div className="card row" key={b.id}>
          <div><h3>{b.propertyTitle}</h3><p className="muted">{b.startDate} → {b.endDate} · {b.months} months · {inr(b.monthlyRent)}/month</p><b>Total {inr(b.totalRent)}</b></div>
          <Status s={b.status} />
        </div>
      ))}
    </>
  );
}
