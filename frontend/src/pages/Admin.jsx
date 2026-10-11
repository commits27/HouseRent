import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api';

export default function Admin() {
  const [tab, setTab] = useState('inquiries');
  const [stats, setStats] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const loadAll = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [s, inq, u, p] = await Promise.all([
        api('/admin/stats'),
        api('/admin/inquiries'),
        api('/admin/users'),
        api('/admin/properties'),
      ]);
      setStats(s);
      setInquiries(inq);
      setUsers(u);
      setProperties(p);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updateInquiryStatus = async (id, newStatus) => {
    setBusyId('inq_' + id);
    try {
      const updated = await api('/admin/inquiries/' + id, {
        method: 'PUT',
        body: { status: newStatus },
      });
      setInquiries((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMsg({ ok: true, text: `Inquiry #${id} updated to ${newStatus}.` });
      // Refresh stats
      const s = await api('/admin/stats');
      setStats(s);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const toggleUserStatus = async (user) => {
    if (user.id === currentUser.id) {
      setMsg({ ok: false, text: 'You cannot suspend your own admin account.' });
      return;
    }
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    setBusyId('usr_' + user.id);
    try {
      const updated = await api(`/admin/users/${user.id}/status`, {
        method: 'PUT',
        body: { status: nextStatus },
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setMsg({ ok: true, text: `User ${user.email} is now ${nextStatus}.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const toggleFeatured = async (propertyId) => {
    setBusyId('prop_' + propertyId);
    try {
      const updated = await api(`/admin/properties/${propertyId}/featured`, {
        method: 'PUT',
      });
      setProperties((prev) => prev.map((p) => (p.id === propertyId ? updated : p)));
      setMsg({ ok: true, text: `Property #${propertyId} featured status updated.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const deleteProperty = async (propertyId) => {
    if (!confirm(`Delete property #${propertyId}? This cannot be undone.`)) return;
    setBusyId('prop_del_' + propertyId);
    try {
      await api(`/properties/${propertyId}`, { method: 'DELETE' });
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
      setMsg({ ok: true, text: `Property #${propertyId} removed.` });
      const s = await api('/admin/stats');
      setStats(s);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Platform Dashboard</h2>
          <p className="muted">Manage listings, inquiries, customer accounts, and platform health.</p>
        </div>
        <button className="btn outline small" onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh Data'}
        </button>
      </div>

      {msg && (
        <div className={msg.ok ? 'success' : 'error'} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {/* KPI Stats Cards */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="kpi-card">
            <span className="kpi-icon">⌂</span>
            <div>
              <h3>{stats.totalProperties}</h3>
              <p>Active Properties</p>
            </div>
          </div>
          <div className="kpi-card">
            <span className="kpi-icon">👥</span>
            <div>
              <h3>{stats.totalUsers}</h3>
              <p>Registered Users</p>
            </div>
          </div>
          <div className="kpi-card highlight">
            <span className="kpi-icon">✉</span>
            <div>
              <h3>{stats.pendingInquiries} / {stats.totalInquiries}</h3>
              <p>Pending / Total Inquiries</p>
            </div>
          </div>
          <div className="kpi-card">
            <span className="kpi-icon">📅</span>
            <div>
              <h3>{stats.pendingBookings} / {stats.totalBookings}</h3>
              <p>Pending / Total Bookings</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="tabs">
        <button
          className={'tab-btn ' + (tab === 'inquiries' ? 'active' : '')}
          onClick={() => setTab('inquiries')}
        >
          ✉ Inquiries {stats?.pendingInquiries > 0 && <span className="tab-pill">{stats.pendingInquiries}</span>}
        </button>
        <button
          className={'tab-btn ' + (tab === 'users' ? 'active' : '')}
          onClick={() => setTab('users')}
        >
          👥 Users ({users.length})
        </button>
        <button
          className={'tab-btn ' + (tab === 'properties' ? 'active' : '')}
          onClick={() => setTab('properties')}
        >
          ⌂ Properties ({properties.length})
        </button>
      </div>

      {/* Tab: Inquiries */}
      {tab === 'inquiries' && (
        <div className="tab-content">
          {inquiries.length === 0 ? (
            <p className="muted">No inquiries received yet.</p>
          ) : (
            <div className="inquiry-list">
              {inquiries.map((inq) => (
                <div className="card pad inquiry-card" key={inq.id}>
                  <div className="inquiry-header">
                    <div>
                      <span className="inquiry-id">Inquiry #{inq.id}</span>
                      <h3>{inq.propertyTitle || 'General Inquiry'}</h3>
                      <p className="muted">
                        From: <b>{inq.name}</b> ({inq.email}) {inq.phone && `· 📞 ${inq.phone}`}
                      </p>
                    </div>
                    <div className="inquiry-status-wrap">
                      <span className={'status status-' + inq.status.toLowerCase()}>{inq.status}</span>
                      <select
                        value={inq.status}
                        disabled={busyId === 'inq_' + inq.id}
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
                    <small className="muted">Received: {inq.createdAt ? new Date(inq.createdAt).toLocaleString() : 'N/A'}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Users */}
      {tab === 'users' && (
        <div className="tab-content">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td><b>{u.name}</b></td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <span className={'badge ' + (u.role === 'admin' ? 'badge-admin' : 'badge-user')}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={'status status-' + u.status}>
                        {u.status}
                      </span>
                    </td>
                    <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      {u.id === currentUser.id ? (
                        <small className="muted">Current account</small>
                      ) : (
                        <button
                          className={'btn small ' + (u.status === 'active' ? 'danger' : 'outline')}
                          disabled={busyId === 'usr_' + u.id}
                          onClick={() => toggleUserStatus(u)}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Properties */}
      {tab === 'properties' && (
        <div className="tab-content">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Listing</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Featured</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>
                      <Link to={'/property/' + p.id} className="table-prop-link">
                        <b>{p.title}</b>
                      </Link>
                    </td>
                    <td>{p.type}</td>
                    <td>{p.listingType}</td>
                    <td>{p.area}, {p.city}</td>
                    <td>{inr(p.rent || p.price)}</td>
                    <td>
                      <button
                        className={'star-btn ' + (p.featured ? 'is-featured' : '')}
                        title="Click to toggle featured"
                        disabled={busyId === 'prop_' + p.id}
                        onClick={() => toggleFeatured(p.id)}
                      >
                        {p.featured ? '★ Featured' : '☆ Standard'}
                      </button>
                    </td>
                    <td>
                      <span className={'status status-' + (p.status || 'available').toLowerCase()}>
                        {p.status || 'Available'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn small danger"
                        disabled={busyId === 'prop_del_' + p.id}
                        onClick={() => deleteProperty(p.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
