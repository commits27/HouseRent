import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api';
import { TYPES } from './Home.jsx';
import { Status } from './MyBookings.jsx';

const blank = {
  title: '',
  type: 'Apartment',
  listingType: 'Rent',
  city: '',
  area: '',
  rent: '',
  bedrooms: 1,
  bathrooms: 1,
  sqft: '',
  description: '',
  amenities: '',
  images: '',
};

const csv = (s) =>
  String(s || '')
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function MyProperties() {
  const [mine, setMine] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [receivedInquiries, setReceivedInquiries] = useState([]);
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([
      api('/properties/mine'),
      api('/bookings/requests'),
      api('/inquiries/received').catch(() => []),
    ])
      .then(([a, b, c]) => {
        setMine(a || []);
        setReqs(b || []);
        setReceivedInquiries(c || []);
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api('/properties', {
        method: 'POST',
        body: {
          ...f,
          rent: +f.rent,
          bedrooms: +f.bedrooms,
          bathrooms: +f.bathrooms,
          sqft: +f.sqft || 0,
          amenities: csv(f.amenities),
          images: csv(f.images),
        },
      });
      setF(blank);
      setMsg({ ok: true, text: 'Property listed successfully!' });
      load();
    } catch (x) {
      setMsg({ ok: false, text: x.message });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id, value) => {
    try {
      await api(`/bookings/${id}/status?value=${value}`, { method: 'PUT' });
      setMsg({ ok: true, text: `Booking request ${value.toLowerCase()}.` });
    } catch (x) {
      setMsg({ ok: false, text: x.message });
    }
    load();
  };

  const updateInquiryStatus = async (id, status) => {
    try {
      await api(`/inquiries/${id}/status`, {
        method: 'PUT',
        body: { status },
      });
      setMsg({ ok: true, text: `Inquiry status updated to ${status}.` });
      load();
    } catch (x) {
      setMsg({ ok: false, text: x.message });
    }
  };

  const del = async (id) => {
    if (confirm('Delete this listing?')) {
      try {
        await api('/properties/' + id, { method: 'DELETE' });
        setMsg({ ok: true, text: 'Listing deleted.' });
        load();
      } catch (e) {
        setMsg({ ok: false, text: e.message });
      }
    }
  };

  return (
    <div className="section my-properties-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">OWNER PORTAL</p>
          <h2>Manage Your Properties</h2>
          <p className="muted">List homes, manage incoming rental requests, and reply to inquiries.</p>
        </div>
      </div>

      {msg && (
        <div className={msg.ok ? 'success' : 'error'} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {/* Booking Requests */}
      <div className="sub-section">
        <h3>📅 Incoming Booking Requests</h3>
        {reqs.length === 0 ? (
          <p className="muted">No booking requests received yet.</p>
        ) : (
          reqs.map((b) => (
            <div className="card pad row" key={b.id}>
              <div>
                <Link to={'/property/' + b.propertyId}>
                  <b>{b.propertyTitle}</b>
                </Link>
                <p className="muted" style={{ margin: '4px 0' }}>
                  Tenant: <b>{b.tenantName}</b> · {b.startDate} → {b.endDate} ({b.months} mos) · {inr(b.totalRent)}
                </p>
              </div>
              {b.status === 'PENDING' ? (
                <div className="actions">
                  <button className="btn small" onClick={() => decide(b.id, 'APPROVED')}>
                    Approve
                  </button>
                  <button className="btn small danger" onClick={() => decide(b.id, 'REJECTED')}>
                    Reject
                  </button>
                </div>
              ) : (
                <Status s={b.status} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Received Inquiries */}
      <div className="sub-section" style={{ marginTop: '36px' }}>
        <h3>✉ Inquiries on Your Properties</h3>
        {receivedInquiries.length === 0 ? (
          <p className="muted">No inquiries received for your properties yet.</p>
        ) : (
          receivedInquiries.map((inq) => (
            <div className="card pad inquiry-card" key={inq.id}>
              <div className="inquiry-header">
                <div>
                  <Link to={'/property/' + inq.propertyId}>
                    <b>{inq.propertyTitle}</b>
                  </Link>
                  <p className="muted" style={{ margin: '4px 0' }}>
                    From: <b>{inq.name}</b> ({inq.email}) {inq.phone && `· 📞 ${inq.phone}`}
                  </p>
                </div>
                <div className="inquiry-status-wrap">
                  <Status s={inq.status} />
                  <select
                    value={inq.status}
                    onChange={(e) => updateInquiryStatus(inq.id, e.target.value)}
                    className="status-select"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="inquiry-body">
                <p>"{inq.message}"</p>
                <small className="muted">
                  Received: {inq.createdAt ? new Date(inq.createdAt).toLocaleString() : 'N/A'}
                </small>
              </div>
            </div>
          ))
        )}
      </div>

      {/* List a new property */}
      <div className="sub-section" style={{ marginTop: '40px' }}>
        <h3>⌂ List a New Property</h3>
        <form className="card pad formgrid" onSubmit={add}>
          <label className="input-label full">
            Property title
            <input placeholder="e.g. Spacious 3BHK Penthouse in Jubilee Hills" value={f.title} onChange={set('title')} required />
          </label>

          <label className="input-label">
            Property type
            <select value={f.type} onChange={set('type')}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="input-label">
            Listing type
            <select value={f.listingType} onChange={set('listingType')}>
              <option value="Rent">For Rent</option>
              <option value="Buy">For Sale / Buy</option>
            </select>
          </label>

          <label className="input-label">
            City
            <input placeholder="e.g. Hyderabad" value={f.city} onChange={set('city')} required />
          </label>

          <label className="input-label">
            Area / Locality
            <input placeholder="e.g. Jubilee Hills, Road No. 36" value={f.area} onChange={set('area')} required />
          </label>

          <label className="input-label">
            {f.listingType === 'Buy' ? 'Total Price (₹)' : 'Monthly Rent (₹)'}
            <input type="number" min="1" placeholder="Amount in ₹" value={f.rent} onChange={set('rent')} required />
          </label>

          <label className="input-label">
            Area (Sq Ft)
            <input type="number" min="0" placeholder="e.g. 1850" value={f.sqft} onChange={set('sqft')} />
          </label>

          <label className="input-label">
            Bedrooms
            <input type="number" min="0" value={f.bedrooms} onChange={set('bedrooms')} />
          </label>

          <label className="input-label">
            Bathrooms
            <input type="number" min="0" value={f.bathrooms} onChange={set('bathrooms')} />
          </label>

          <label className="input-label full">
            Description
            <textarea
              rows="3"
              placeholder="Highlight views, natural lighting, nearby conveniences, transit access..."
              value={f.description}
              onChange={set('description')}
            />
          </label>

          <label className="input-label full">
            Amenities (comma separated)
            <input
              placeholder="Parking, Swimming Pool, Gym, 24/7 Security, Power Backup"
              value={f.amenities}
              onChange={set('amenities')}
            />
          </label>

          <label className="input-label full">
            Image URLs (comma or new line separated)
            <textarea
              rows="2"
              placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
              value={f.images}
              onChange={set('images')}
            />
          </label>

          <button className="btn full" disabled={busy}>
            {busy ? 'Listing property…' : 'Publish Property Listing'}
          </button>
        </form>
      </div>

      {/* My Listings */}
      <div className="sub-section" style={{ marginTop: '40px' }}>
        <h3>Your Active Listings ({mine.length})</h3>
        {mine.length === 0 ? (
          <p className="muted">You haven't listed any properties yet.</p>
        ) : (
          mine.map((p) => (
            <div className="card pad row" key={p.id}>
              <div>
                <Link to={'/property/' + p.id}>
                  <b>{p.title}</b>
                </Link>
                <p className="muted" style={{ margin: '4px 0' }}>
                  {p.type} · {p.listingType} · {p.area}, {p.city} · {inr(p.rent || p.price)}{p.listingType === 'Buy' ? '' : '/month'}
                </p>
              </div>
              <div className="actions">
                <Link to={'/property/' + p.id} className="btn small outline">
                  View
                </Link>
                <button className="btn small danger" onClick={() => del(p.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
