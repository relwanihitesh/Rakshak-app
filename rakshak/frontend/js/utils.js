// ── Rakshak Shared Utilities ──
const API = 'http://localhost:5000/api';

const getToken  = ()       => localStorage.getItem('rakshak_token');
const getUser   = ()       => JSON.parse(localStorage.getItem('rakshak_user') || 'null');
const setAuth   = (t, u)   => { localStorage.setItem('rakshak_token', t); localStorage.setItem('rakshak_user', JSON.stringify(u)); };
const clearAuth = ()       => { localStorage.removeItem('rakshak_token'); localStorage.removeItem('rakshak_user'); };

const authHeaders = () => ({ 'Content-Type':'application/json', 'Authorization': `Bearer ${getToken()}` });

async function apiCall(method, endpoint, body = null) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : null
  });
  return await res.json();
}

function showAlert(id, msg, type = 'info') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function getBadgeClass(level) {
  if (!level) return '';
  return `badge badge-${level.toLowerCase()}`;
}

function getStatusClass(status) {
  if (!status) return '';
  return `badge status-${status.toLowerCase()}`;
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

function requireAuth(expectedRole) {
  const user = getUser();
  if (!user || !getToken()) { window.location.href = '/'; return false; }
  if (expectedRole && user.role !== expectedRole) { window.location.href = '/'; return false; }
  return true;
}

function logout() {
  clearAuth();
  window.location.href = '/';
}
