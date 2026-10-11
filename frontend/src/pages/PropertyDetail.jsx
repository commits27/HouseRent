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
  const [isFav, setIsFav] = useState(false);

  // Inquiry form state
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const [inq, setInq] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    message: 'Hi, I am interested in this property. Please let me know how we can proceed with a viewing.',
  });
  const [inqMsg, setInqMsg] = useState(null);
  const [inqBusy, setInqBusy] = useState(false);

  useEffect(() => {
    api('/properties/' + id)
      .then((data) => {
        setP(data);
        // Check if favorite
        const localFavs = JSON.parse(localStorage.getItem('favorites') || '[]');
        setIsFav(localFavs.includes(Number(id)) || localFavs.includes(id));
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, [id]);

  const toggleFavorite = async () => {
    const token = localStorage.getItem('token');
    const nextState = !isFav;
    setIsFav(nextState);

    const localFavs = JSON.parse(localStorage.getItem('favorites') || '[]');
    const nextLocal = nextState
      ? [...localFavs, Number(id)]
      : localFavs.filter((x) => x !== Number(id) && x !== id);
    localStorage.setItem('favorites', JSON.stringify(nextLocal));

    if (token) {
      try {
        if (nextState) {
          await api('/favorites/' + id, { method: 'POST' });
        } else {
          await api('/favorites/' + id, { method: 'DELETE' });
        }
      } catch {
        setIsFav(!nextState);
        localStorage.setItem('favorites', JSON.stringify(localFavs));
      }
    }
  };

  const book = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const b = await api('/bookings', {
        method: 'POST',
        body: { propertyId: p.id, startDate: start, months: Number(months) },
      });
      setMsg({
        ok: true,
        text: `Booking request sent for ${b.startDate} to ${b.endDate} (${b.months} months, total ${inr(
          b.totalRent
        )}). The owner will review your request.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const sendInquiry = async (e) => {
    e.preventDefault();
    if (!inq.name.trim() || !inq.email.trim() || !inq.message.trim()) {
      setInqMsg({ ok: false, text: 'Name, email, and message are required.' });
      return;
    }
    setInqBusy(true);
    setInqMsg(null);
    try {
      await api('/inquiries', {
        method: 'POST',
        body: {
          propertyId: p.id,
          name: inq.name.trim(),
          email: inq.email.trim(),
          phone: inq.phone.trim(),
          message: inq.message.trim(),
        },
      });
      setInqMsg({
        ok: true,
        text: 'Your inquiry has been submitted! The owner or property agent will reach out shortly.',
      });
      setInq((prev) => ({
        ...prev,
        message: 'Hi, I am interested in this property. Please let me know how we can proceed with a viewing.',
      }));
    } catch (e) {
      setInqMsg({ ok: false, text: e.message });
    } finally {
      setInqBusy(false);
    }
  };

  if (!p) return <div className="section"><p className="muted">{msg ? msg.text : 'Loading property…'}</p></div>;

  const isBuy = p.listingType === 'Buy';

  return (
    <div className="detail section">
      <div className="detail-top-bar">
        <Link to="/" className="muted back-link">
          ← Back to listings
        </Link>
        <button
          className={'heart-detail-btn ' + (isFav ? 'saved' : '')}
          onClick={toggleFavorite}
          aria-label={isFav ? 'Remove from favorites' : 'Save property'}
        >
          {isFav ? '♥ Saved in Favorites' : '♡ Save to Favorites'}
        </button>
      </div>

      <div className="gallery">
        <img
          className="main"
          src={p.images?.[img] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200'}
          alt={p.title}
        />
        {p.images?.length > 1 && (
          <div className="thumbs">
            {p.images.map((u, i) => (
              <img
                key={i}
                src={u}
                className={i === img ? 'on' : ''}
                onClick={() => setImg(i)}
                alt=""
              />
            ))}
          </div>
        )}
      </div>

      <div className="two">
        <section className="card pad">
          <div className="badges-row">
            <span className="tag">{p.type}</span>
            <span className={'tag tag-' + (isBuy ? 'buy' : 'rent')}>{p.listingType || 'Rent'}</span>
            {p.verified && <span className="tag tag-verified">✔ Verified</span>}
            {p.featured && <span className="tag tag-featured">★ Featured</span>}
          </div>

          <h1>{p.title}</h1>
          <p className="muted location-line">
            ⌖ {p.area || p.location}, {p.city} · Listed by <b>{p.ownerName}</b>
          </p>

          <div className="facts">
            <span>🛏 {p.bedrooms} Bedrooms</span>
            <span>🛁 {p.bathrooms} Bathrooms</span>
            <span>📐 {p.sqft || p.areaSqft || 0} sq ft</span>
            <span>🛋 {p.furnishing || 'Unfurnished'}</span>
          </div>

          <h3>About this space</h3>
          <p className="property-desc">{p.description || 'No description provided.'}</p>

          <h3>Amenities & Features</h3>
          <div className="chips">
            {p.amenities?.length ? (
              p.amenities.map((a) => (
                <span key={a} className="chip">
                  ✔ {a}
                </span>
              ))
            ) : (
              <span className="muted">No specific amenities listed.</span>
            )}
          </div>
        </section>

        <aside className="side-panels">
          {/* Booking card (for rentals) */}
          {!isBuy ? (
            <div className="card pad book">
              <h2>
                {inr(p.rent || p.price)} <small>/ month</small>
              </h2>
              <label>
                Start date
                <input
                  type="date"
                  min={today()}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Duration
                <select value={months} onChange={(e) => setMonths(e.target.value)}>
                  {[1, 2, 3, 6, 9, 11, 12, 18, 24, 36].map((m) => (
                    <option key={m} value={m}>
                      {m} {m === 1 ? 'month' : 'months'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="total">
                <span>Total rent</span>
                <b>{inr((p.rent || p.price) * months)}</b>
              </div>
              <button className="btn full" onClick={book} disabled={busy}>
                {busy ? 'Booking…' : 'Request Rental Booking'}
              </button>
              {msg && <div className={msg.ok ? 'success' : 'error'}>{msg.text}</div>}
            </div>
          ) : (
            <div className="card pad book">
              <h2>
                {inr(p.price || p.rent)} <small>total price</small>
              </h2>
              <p className="muted" style={{ margin: '8px 0 16px' }}>
                This property is offered for purchase. Contact the owner below to schedule a private tour.
              </p>
            </div>
          )}

          {/* Inquiry form card */}
          <div className="card pad inquiry-box">
            <h3>Contact Owner / Inquire</h3>
            <p className="muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
              Have questions or want to request a site visit? Send a direct inquiry.
            </p>
            {inqMsg && <div className={inqMsg.ok ? 'success' : 'error'}>{inqMsg.text}</div>}
            <form onSubmit={sendInquiry} className="inquiry-form">
              <label className="input-label">
                Your name
                <input
                  value={inq.name}
                  onChange={(e) => setInq({ ...inq, name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </label>
              <label className="input-label">
                Email address
                <input
                  type="email"
                  value={inq.email}
                  onChange={(e) => setInq({ ...inq, email: e.target.value })}
                  placeholder="name@example.com"
                  required
                />
              </label>
              <label className="input-label">
                Phone (optional)
                <input
                  type="tel"
                  value={inq.phone}
                  onChange={(e) => setInq({ ...inq, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </label>
              <label className="input-label">
                Message
                <textarea
                  rows="3"
                  value={inq.message}
                  onChange={(e) => setInq({ ...inq, message: e.target.value })}
                  required
                />
              </label>
              <button className="btn full" disabled={inqBusy}>
                {inqBusy ? 'Sending…' : 'Send Inquiry'}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
