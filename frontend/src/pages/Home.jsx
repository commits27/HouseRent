import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, inr } from '../api';

export const TYPES = ['Villa', 'Apartment', 'Flat', 'Independent House', 'Studio', 'PG / Hostel', 'Other'];
const initial = { area: '', type: 'All', listingType: 'All', min: '', max: '', beds: 'Any' };
const categories = [
  { title: 'Apartments', type: 'Apartment', icon: '▦' },
  { title: 'Independent homes', type: 'Independent House', icon: '⌂' },
  { title: 'Villas', type: 'Villa', icon: '◇' },
  { title: 'Studios', type: 'Studio', icon: '◫' },
];

export function PropertyCard({ p, favorite, toggleFavorite }) {
  const isBuy = p.listingType === 'Buy';
  return (
    <article className="property-card">
      <Link to={'/property/' + p.id} className="property-image">
        <img
          src={p.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900'}
          alt={p.title}
          loading="lazy"
        />
        <span className="property-badge">{p.type}</span>
        <span className={'listing-badge ' + (isBuy ? 'buy' : 'rent')}>
          {p.listingType || 'Rent'}
        </span>
        {p.featured && <span className="featured-chip">★ Featured</span>}
      </Link>
      <button
        className={'heart ' + (favorite ? 'saved' : '')}
        onClick={() => toggleFavorite(p.id)}
        aria-label={favorite ? 'Remove from favorites' : 'Save property'}
      >
        {favorite ? '♥' : '♡'}
      </button>
      <div className="property-copy">
        <Link to={'/property/' + p.id}>
          <h3>{p.title}</h3>
        </Link>
        <p className="location">⌖ {p.area || p.location}, {p.city}</p>
        <div className="property-meta">
          <span>{p.bedrooms} beds</span>
          <i />
          <span>{p.bathrooms} baths</span>
          <i />
          <span>{p.sqft || p.areaSqft || 0} sq ft</span>
        </div>
        <div className="property-bottom">
          <b>
            {inr(p.rent || p.price)}
            <small>{isBuy ? ' total' : ' / month'}</small>
          </b>
          <Link to={'/property/' + p.id} className="view-link">
            View details <span>↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [filters, setFilters] = useState(initial);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sort, setSort] = useState('newest');
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [params, setParams] = useSearchParams();

  // Sync favorites with backend if logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api('/favorites')
        .then((favs) => {
          if (Array.isArray(favs)) {
            const ids = favs.map((f) => f.id);
            setFavorites(ids);
            localStorage.setItem('favorites', JSON.stringify(ids));
          }
        })
        .catch(() => {});
    }
  }, []);

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const toggleFavorite = async (id) => {
    const token = localStorage.getItem('token');
    const isCurrentlyFav = favorites.includes(id);
    const next = isCurrentlyFav ? favorites.filter((x) => x !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('favorites', JSON.stringify(next));

    if (token) {
      try {
        if (isCurrentlyFav) {
          await api('/favorites/' + id, { method: 'DELETE' });
        } else {
          await api('/favorites/' + id, { method: 'POST' });
        }
      } catch {
        // revert on failure
        setFavorites(favorites);
        localStorage.setItem('favorites', JSON.stringify(favorites));
      }
    }
  };

  const load = async (next = filters) => {
    setLoading(true);
    setErr('');
    const q = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== 'All' && v !== 'Any') {
        q.set(k === 'beds' ? 'bedrooms' : k, v);
      }
    });
    try {
      setList(await api('/properties?' + q));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const area = params.get('area') || '';
    const type = params.get('type') || 'All';
    const listingType = params.get('listingType') || 'All';
    const next = { ...initial, area, type, listingType };
    setFilters(next);
    load(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const priceA = a.rent || a.price || 0;
      const priceB = b.rent || b.price || 0;
      if (sort === 'low') return priceA - priceB;
      if (sort === 'high') return priceB - priceA;
      return 0;
    });
  }, [list, sort]);

  const submit = (e) => {
    e.preventDefault();
    setParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'All' && v !== 'Any')));
    load(filters);
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  };

  const chooseCategory = (type) => {
    const next = { ...filters, type };
    setFilters(next);
    load(next);
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow light">THE PLACE YOU'LL LOVE TO LIVE</p>
          <h1>
            Find your perfect<br />
            <em>place to call home.</em>
          </h1>
          <p className="hero-sub">Discover thoughtfully selected homes in the neighborhoods you love.</p>
          <form className="hero-search" onSubmit={submit}>
            <div className="search-field">
              <span>⌖</span>
              <label>
                Location
                <input value={filters.area} onChange={set('area')} placeholder="City or locality" />
              </label>
            </div>
            <div className="search-field">
              <span>⌂</span>
              <label>
                Property type
                <select value={filters.type} onChange={set('type')}>
                  <option value="All">All Types</option>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="search-field">
              <span>🏷</span>
              <label>
                Listing
                <select value={filters.listingType} onChange={set('listingType')}>
                  <option value="All">Rent & Buy</option>
                  <option value="Rent">For Rent</option>
                  <option value="Buy">For Buy</option>
                </select>
              </label>
            </div>
            <button className="search-button">
              Search <span>→</span>
            </button>
          </form>
        </div>
        <div className="hero-note">
          <span className="avatar-stack">
            <i />
            <i />
            <i />
          </span>
          <span>
            <b>2,000+</b>
            <br />
            happy homeowners
          </span>
        </div>
      </section>

      <section className="trust-row">
        <span>Trusted by people finding their next chapter</span>
        <b>nest<span>ly</span></b>
        <b>urban<span>nest</span></b>
        <b>HOMELY</b>
        <b className="trust-fade">habitat</b>
      </section>

      <section className="section" id="listings">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORE HOMES</p>
            <h2>Spaces made for living</h2>
            <p className="muted">A handpicked collection of places worth coming home to.</p>
          </div>
          <div className="sort-wrap">
            <span>{loading ? 'Finding homes...' : `${sorted.length} properties found`}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>

        <div className="filter-bar">
          <input
            value={filters.area}
            onChange={set('area')}
            placeholder="Search city, area, or title"
          />
          <select value={filters.type} onChange={set('type')}>
            <option value="All">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filters.listingType} onChange={set('listingType')}>
            <option value="All">All Listings</option>
            <option value="Rent">Rent</option>
            <option value="Buy">Buy</option>
          </select>
          <input
            type="number"
            value={filters.min}
            onChange={set('min')}
            placeholder="Min price"
          />
          <input
            type="number"
            value={filters.max}
            onChange={set('max')}
            placeholder="Max price"
          />
          <select value={filters.beds} onChange={set('beds')}>
            <option value="Any">Any Beds</option>
            <option value="1">1+ beds</option>
            <option value="2">2+ beds</option>
            <option value="3">3+ beds</option>
            <option value="4">4+ beds</option>
          </select>
          <button className="btn" onClick={submit}>Apply</button>
          <button
            className="clear-button"
            onClick={() => {
              setFilters(initial);
              load(initial);
            }}
          >
            Clear
          </button>
        </div>

        {err && <div className="error">{err}</div>}

        {loading ? (
          <div className="property-grid">
            {[1, 2, 3].map((x) => (
              <div className="skeleton-card" key={x}>
                <div />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : sorted.length > 0 ? (
          <div className="property-grid">
            {sorted.map((p) => (
              <PropertyCard
                key={p.id}
                p={p}
                favorite={favorites.includes(p.id)}
                toggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>⌂</span>
            <h3>No homes found</h3>
            <p>Try widening your search or clearing a filter.</p>
            <button
              className="btn"
              onClick={() => {
                setFilters(initial);
                load(initial);
              }}
            >
              Show all homes
            </button>
          </div>
        )}
      </section>

      <section className="section category-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR FIT</p>
            <h2>Explore by category</h2>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((c) => (
            <button
              className="category-card"
              key={c.type}
              onClick={() => chooseCategory(c.type)}
            >
              <span>{c.icon}</span>
              <b>{c.title}</b>
              <small>Explore collection →</small>
            </button>
          ))}
        </div>
      </section>

      <section className="feature-section" id="why">
        <div className="feature-photo">
          <img
            src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200"
            alt="Warm modern living room"
            loading="lazy"
          />
          <span className="photo-caption">
            A home should feel like<br />
            <b>your kind of beautiful.</b>
          </span>
        </div>
        <div className="feature-copy">
          <p className="eyebrow">WHY HOUSE HUNT</p>
          <h2>
            More than a listing.<br />
            A feeling of <em>belonging.</em>
          </h2>
          <p>
            We believe finding a home should be personal, not overwhelming. That is why every place is carefully
            presented to help you picture your life there.
          </p>
          <div className="benefits">
            <div>
              <b>01</b>
              <span>
                <strong>Curated with care</strong>
                <small>Quality homes, thoughtfully selected.</small>
              </span>
            </div>
            <div>
              <b>02</b>
              <span>
                <strong>Search with confidence</strong>
                <small>Clear details. No hidden surprises.</small>
              </span>
            </div>
            <div>
              <b>03</b>
              <span>
                <strong>People-first service</strong>
                <small>Here when you need a helping hand.</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading centered">
          <p className="eyebrow">A SIMPLE WAY HOME</p>
          <h2>From searching to settled.</h2>
        </div>
        <div className="steps">
          <div>
            <span>01</span>
            <h3>Tell us what you need</h3>
            <p>Set your location, budget, and the kind of space you are looking for.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Find your favorites</h3>
            <p>Browse considered listings and save the ones that feel right.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Make it yours</h3>
            <p>Connect with the owner, book a visit, and take the next step.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div>
          <p className="eyebrow light">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>Ready to find your place?</h2>
          <p>There is a home out there with your name on it.</p>
        </div>
        <Link
          to="/"
          onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })}
          className="btn light-btn"
        >
          Explore homes <span>→</span>
        </Link>
      </section>
    </>
  );
}
