const RAW_BASE = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/+$/, '') : '';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const endpoint = `${API_BASE}/api${normalizedPath}`;
  let res;
  try {
    res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Unable to reach the server. Please verify the backend API is running and CORS is configured.');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
  const text = data ? '' : await res.text().catch(() => '');
  if (!res.ok) {
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error(data?.message || data?.error || text || `Request failed (${res.status})`);
  }
  return data ?? text;
}

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
