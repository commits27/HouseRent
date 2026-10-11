import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api';

export const Status = ({ s }) => (
  <span className={'status status-' + (s || 'pending').toLowerCase()}>{s}</span>
);

export default function MyBookings() {
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const loadData = async () => {
    setErr('');
    try {
      const [bList, iList] = await Promise.all([
        api('/bookings/mine'),
        api('/inquiries/mine'),
      ]);
      setBookings(bList || []);
      setInquiries(iList || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="section my-bookings-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ACTIVITY & HISTORY</p>
          <h2>My Bookings & Inquiries</h2>
          <p className="muted">Track your property booking requests and messages to property managers.</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={'tab-btn ' + (tab === 'bookings' ? 'active' : '')}
          onClick={() => setTab('bookings')}
        >
          📅 Rental Bookings ({bookings.length})
        </button>
        <button
          className={'tab-btn ' + (tab === 'inquiries' ? 'active' : '')}
          onClick={() => setTab('inquiries')}
        >
          ✉ Sent Inquiries ({inquiries.length})
        </button>
      </div>

      {err && <div className="error">{err}</div>}

      {tab === 'bookings' && (
        <div className="tab-content">
          {bookings.length === 0 && !loading && (
            <div className="empty-state">
              <span>📅</span>
              <h3>No booking requests yet</h3>
              <p>Explore homes and submit a rental booking request.</p>
              <Link to="/" className="btn" style={{ marginTop: '12px' }}>
                Explore listings
              </Link>
            </div>
          )}
          {bookings.map((b) => (
            <div className="card pad row" key={b.id}>
              <div>
                <Link to={'/property/' + b.propertyId}>
                  <h3 style={{ margin: '0 0 6px', color: 'var(--navy)' }}>{b.propertyTitle}</h3>
                </Link>
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  {b.startDate} → {b.endDate} · {b.months} {b.months === 1 ? 'month' : 'months'} · {inr(b.monthlyRent)}/month
                </p>
                <b>Total {inr(b.totalRent)}</b>
              </div>
              <Status s={b.status} />
            </div>
          ))}
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="tab-content">
          {inquiries.length === 0 && !loading && (
            <div className="empty-state">
              <span>✉</span>
              <h3>No inquiries sent yet</h3>
              <p>When you inquire about a property, your questions and status will appear here.</p>
              <Link to="/" className="btn" style={{ marginTop: '12px' }}>
                Browse properties
              </Link>
            </div>
          )}
          {inquiries.map((i) => (
            <div className="card pad row" key={i.id}>
              <div style={{ flex: 1 }}>
                {i.propertyId ? (
                  <Link to={'/property/' + i.propertyId}>
                    <h3 style={{ margin: '0 0 6px', color: 'var(--navy)' }}>{i.propertyTitle}</h3>
                  </Link>
                ) : (
                  <h3 style={{ margin: '0 0 6px' }}>{i.propertyTitle || 'General Inquiry'}</h3>
                )}
                <p style={{ margin: '6px 0', fontStyle: 'italic' }}>"{i.message}"</p>
                <small className="muted">
                  Submitted: {i.createdAt ? new Date(i.createdAt).toLocaleString() : 'N/A'}
                </small>
              </div>
              <Status s={i.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
