'use strict';
/**
 * n8n workflow mock — replicates the three webhook endpoints locally.
 * Used for Phase 2 test gate without requiring a full n8n Docker instance.
 * In production these are replaced by the real n8n workflows imported from workflows/*.json
 */
const express = require('express');
const crypto = require('crypto');
const app = express();

// CORS — allow browser app (any origin in dev; lock to Netlify URL in prod)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

const PORT = process.env.N8N_MOCK_PORT || 5678;
const RPA_URL = process.env.RPA_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-jwt-secret';

// ── Auth helper ────────────────────────────────────────────────────────────
function verifyJWTSignature(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  try {
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  if (token.startsWith('dev-token-')) return true;
  return verifyJWTSignature(token);
}

// ── Proxy to RPA ───────────────────────────────────────────────────────────
async function rpa(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${RPA_URL}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── POST /webhook/crm/search ───────────────────────────────────────────────
app.post('/webhook/crm/search', async (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' });
  try {
    const { status, body } = await rpa('POST', '/rpa/search', { query });
    res.status(status).json(body);
  } catch {
    res.status(503).json({ error: 'RPA service unavailable' });
  }
});

// ── GET /webhook/crm/customer/:id ──────────────────────────────────────────
app.get('/webhook/crm/customer/:id', async (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const { status, body } = await rpa('GET', `/rpa/customer/${req.params.id}`);
    res.status(status).json(body);
  } catch {
    res.status(503).json({ error: 'RPA service unavailable' });
  }
});

// ── POST /webhook/crm/update ───────────────────────────────────────────────
app.post('/webhook/crm/update', async (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  const { customerId, fields } = req.body || {};
  if (!customerId || !fields) return res.status(400).json({ error: 'customerId and fields are required' });
  // Sanitise string fields
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    clean[k] = typeof v === 'string' ? v.replace(/<[^>]*>/g, '').slice(0, 500) : v;
  }
  try {
    const { status, body } = await rpa('POST', '/rpa/update', { customerId: customerId.toUpperCase(), fields: clean });
    res.status(status).json(body);
  } catch {
    res.status(503).json({ error: 'RPA service unavailable' });
  }
});

// ── GET /webhook/crm/history/:customerId ──────────────────────────────────
app.get('/webhook/crm/history/:customerId', async (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const { status, body } = await rpa('GET', `/rpa/history/${req.params.customerId}`);
    res.status(status).json(body);
  } catch {
    res.status(503).json({ error: 'RPA service unavailable' });
  }
});

// ── POST /webhook/auth ─────────────────────────────────────────────────────
app.post('/webhook/auth', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'demo123') {
    const token = 'dev-token-' + Buffer.from(`${username}:${Date.now()}`).toString('base64');
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/healthz', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`n8n mock running on http://localhost:${PORT}`));
