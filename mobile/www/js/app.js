'use strict';
/**
 * BankRPA Field Agent App
 * Communicates with n8n webhook endpoints.
 * Falls back to RPA service directly when N8N_URL is not set (dev mode).
 */

const N8N_URL = window.N8N_URL || 'http://localhost:5678';
const RPA_URL = window.RPA_URL || 'http://localhost:3002'; // direct fallback for dev

let token = null;         // JWT from n8n auth
let currentCustomer = null;

// ── Utility ───────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function loading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
}

function hideAlert(id) {
  document.getElementById(id).classList.add('hidden');
}

function setBtn(id, disabled, text) {
  const b = document.getElementById(id);
  b.disabled = disabled;
  if (text) b.textContent = text;
}

// ── API ───────────────────────────────────────────────────────────────────

async function apiCall(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${N8N_URL}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Direct RPA call — used in dev before n8n workflows are imported
async function rpaCall(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(`${RPA_URL}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ── Auth ──────────────────────────────────────────────────────────────────

async function doLogin(username, password) {
  // In Phase 3 (before n8n auth workflow), generate a simple local token for dev
  // In Phase 4 this becomes: POST /webhook/auth → { token }
  try {
    const data = await apiCall('POST', '/webhook/auth', { username, password });
    token = data.token;
  } catch {
    // Dev fallback: accept hardcoded credentials, store a placeholder token
    if (username === 'admin' && password === 'demo123!@#$') {
      token = 'dev-token-' + btoa(`${username}:${Date.now()}`);
    } else {
      throw new Error('Invalid username or password.');
    }
  }
  localStorage.setItem('bank_rpa_token', token);
  localStorage.setItem('bank_rpa_user', username);
}

function restoreSession() {
  const t = localStorage.getItem('bank_rpa_token');
  if (t) { token = t; return true; }
  return false;
}

function clearSession() {
  token = null;
  localStorage.removeItem('bank_rpa_token');
  localStorage.removeItem('bank_rpa_user');
}

// ── Search ────────────────────────────────────────────────────────────────

async function doSearch(query) {
  try {
    const data = await apiCall('POST', '/webhook/crm/search', { query });
    return data.results || [];
  } catch {
    // Dev fallback — direct RPA
    const data = await rpaCall('POST', '/rpa/search', { query });
    return data.results || [];
  }
}

function renderSearchResults(results) {
  const el = document.getElementById('search-results');
  if (!results.length) {
    el.innerHTML = '<div class="no-results">No customers found.</div>';
    return;
  }
  el.innerHTML = results.map(c => `
    <div class="customer-card" data-id="${c.id}">
      <div class="c-name">${c.name}</div>
      <div class="c-meta">
        <span>${c.id}</span>
        <span>${c.account}</span>
        <span class="badge badge-${(c.status||'').toLowerCase()}">${c.status}</span>
      </div>
    </div>`).join('');

  el.querySelectorAll('.customer-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

// ── Detail ────────────────────────────────────────────────────────────────

async function openDetail(customerId) {
  loading(true);
  try {
    let customer;
    try {
      const data = await apiCall('GET', `/webhook/crm/customer/${customerId}`);
      customer = data.customer;
    } catch {
      const data = await rpaCall('GET', `/rpa/customer/${customerId}`);
      customer = data.customer;
    }
    currentCustomer = customer;
    renderDetail(customer);
    showScreen('screen-detail');
  } catch (err) {
    showAlert('search-error', err.message);
  } finally { loading(false); }
}

function renderDetail(c) {
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-section">
      <h3>Profile</h3>
      <div class="detail-field"><div class="d-label">Name</div><div class="d-value" id="d-name">${c.name}</div></div>
      <div class="detail-field"><div class="d-label">Customer ID</div><div class="d-value">${c.id}</div></div>
      <div class="detail-field"><div class="d-label">Status</div><div class="d-value">
        <span class="badge badge-${(c.status||'').toLowerCase()}">${c.status}</span>
      </div></div>
    </div>
    <div class="detail-section">
      <h3>Contact</h3>
      <div class="detail-field"><div class="d-label">Phone</div><div class="d-value" id="d-phone">${c.phone}</div></div>
      <div class="detail-field"><div class="d-label">Email</div><div class="d-value" id="d-email">${c.email}</div></div>
    </div>
    <div class="detail-section">
      <h3>Notes</h3>
      <div class="detail-field"><div class="d-value" id="d-notes">${c.notes || '—'}</div></div>
    </div>`;
}

// ── Edit ──────────────────────────────────────────────────────────────────

function openEdit() {
  const c = currentCustomer;
  document.getElementById('edit-name').value = c.name || '';
  document.getElementById('edit-phone').value = c.phone || '';
  document.getElementById('edit-email').value = c.email || '';
  document.getElementById('edit-status').value = c.status || 'Active';
  document.getElementById('edit-notes').value = c.notes || '';
  hideAlert('edit-error');
  hideAlert('edit-success');
  showScreen('screen-edit');
}

async function doUpdate(fields) {
  try {
    await apiCall('POST', '/webhook/crm/update', { customerId: currentCustomer.id, fields });
  } catch {
    await rpaCall('POST', '/rpa/update', { customerId: currentCustomer.id, fields });
  }
}

// ── History ───────────────────────────────────────────────────────────────

async function openHistory() {
  showScreen('screen-history');
  loading(true);
  hideAlert('history-error');
  document.getElementById('history-list').innerHTML = '';
  try {
    let logs;
    try {
      const data = await apiCall('GET', `/webhook/crm/history/${currentCustomer.id}`);
      logs = data.logs;
    } catch {
      const data = await rpaCall('GET', `/rpa/history/${currentCustomer.id}`);
      logs = data.logs;
    }
    renderHistory(logs);
  } catch (err) {
    showAlert('history-error', err.message);
  } finally { loading(false); }
}

function renderHistory(logs) {
  const el = document.getElementById('history-list');
  if (!logs || !logs.length) {
    el.innerHTML = '<div class="no-results">No activity history on record.</div>';
    return;
  }
  el.innerHTML = logs.map(l => `
    <div class="history-item">
      <div class="h-header">
        <span class="h-type">${l.type}</span>
        <span class="h-date">${l.date}</span>
      </div>
      <div class="h-agent">Agent: ${l.agent}</div>
      <div class="h-notes">${l.notes}</div>
    </div>`).join('');
}

// ── Event Wiring ──────────────────────────────────────────────────────────

document.addEventListener('deviceready', init, false);
document.addEventListener('DOMContentLoaded', init, false); // browser platform fallback

let _inited = false;
function init() {
  if (_inited) return;
  _inited = true;

  // Restore session
  if (restoreSession()) { showScreen('screen-search'); } else { showScreen('screen-login'); }

  // Login
  document.getElementById('btn-login').addEventListener('click', async () => {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    if (!u || !p) { showAlert('login-error', 'Please enter username and password.'); return; }
    hideAlert('login-error');
    setBtn('btn-login', true, 'Signing in…');
    loading(true);
    try {
      await doLogin(u, p);
      showScreen('screen-search');
    } catch (err) {
      showAlert('login-error', err.message);
    } finally { loading(false); setBtn('btn-login', false, 'Sign In'); }
  });

  // Allow Enter key on login fields
  ['login-username', 'login-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearSession();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
    showScreen('screen-login');
  });

  // Search
  document.getElementById('btn-search').addEventListener('click', async () => {
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;
    hideAlert('search-error');
    setBtn('btn-search', true, '…');
    loading(true);
    try {
      const results = await doSearch(q);
      renderSearchResults(results);
    } catch (err) {
      showAlert('search-error', err.message);
    } finally { loading(false); setBtn('btn-search', false, 'Search'); }
  });

  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-search').click();
  });

  // Detail back
  document.getElementById('btn-detail-back').addEventListener('click', () => showScreen('screen-search'));

  // Edit open/back
  document.getElementById('btn-edit').addEventListener('click', openEdit);
  document.getElementById('btn-edit-back').addEventListener('click', () => showScreen('screen-detail'));

  // Edit form submit
  document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert('edit-error');
    hideAlert('edit-success');

    const name  = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const email = document.getElementById('edit-email').value.trim();

    if (!name)  { showAlert('edit-error', 'Name is required.'); return; }
    if (!phone) { showAlert('edit-error', 'Phone number is required.'); return; }
    if (!email || !email.includes('@')) { showAlert('edit-error', 'Valid email is required.'); return; }

    setBtn('btn-save', true, 'Saving…');
    loading(true);
    try {
      await doUpdate({
        name, phone, email,
        status: document.getElementById('edit-status').value,
        notes:  document.getElementById('edit-notes').value.trim()
      });
      // Update local state
      Object.assign(currentCustomer, { name, phone, email });
      showAlert('edit-success', '✅ Record updated successfully.', 'success');
    } catch (err) {
      showAlert('edit-error', err.message);
    } finally { loading(false); setBtn('btn-save', false, '💾 Save Changes'); }
  });

  // History
  document.getElementById('btn-history').addEventListener('click', openHistory);
  document.getElementById('btn-history-back').addEventListener('click', () => showScreen('screen-detail'));
}
