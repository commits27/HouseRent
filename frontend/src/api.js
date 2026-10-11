export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Unable to reach the server. Please make sure the backend is running.');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
  const text = data ? '' : await res.text().catch(() => '');
  if (!res.ok) {
    if (res.status === 401 && token) { localStorage.clear(); location.href = '/login'; }
    throw new Error(data?.message || data?.error || text || `Request failed (${res.status})`);
  }
  return data ?? text;
}
export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
