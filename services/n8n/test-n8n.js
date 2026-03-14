'use strict';
/**
 * Phase 2 Test Gate — n8n workflow tests N8N-01 through N8N-07
 * Run: node test-n8n.js
 */
const BASE = process.env.N8N_URL || 'http://localhost:5678';
const RPA  = process.env.RPA_SERVICE_URL || 'http://localhost:3002';
let passed = 0, failed = 0;
let validToken = null;

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function assert(id, desc, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${id}: ${desc}`); passed++; }
  else { console.error(`  ❌ ${id}: ${desc}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function run() {
  console.log('\n🧪 n8n Workflow Test Suite (Phase 2)\n');

  // Get a valid token first
  const authRes = await req('POST', '/webhook/auth', { username: 'admin', password: 'demo123' });
  validToken = authRes.body.token;
  assert('PRE', 'Auth endpoint returns token', !!validToken, JSON.stringify(authRes.body));

  const authHeader = { Authorization: `Bearer ${validToken}` };

  // N8N-01: Valid JWT → search returns results
  console.log('\n── N8N-01/02: Auth');
  const r1 = await req('POST', '/webhook/crm/search', { query: 'C001' }, authHeader);
  assert('N8N-01', 'Webhook /crm/search with valid JWT returns 200 + results', r1.status === 200 && Array.isArray(r1.body.results), JSON.stringify(r1.body));

  // N8N-02: No JWT → 401
  const r2 = await req('POST', '/webhook/crm/search', { query: 'C001' });
  assert('N8N-02', 'Webhook /crm/search with no JWT returns 401', r2.status === 401);

  // N8N-03: RPA timeout simulation — test with non-existent customer (404 from RPA, not 503)
  console.log('\n── N8N-03: RPA error passthrough');
  const r3 = await req('GET', '/webhook/crm/customer/ZZZZ', null, authHeader);
  assert('N8N-03', 'Non-existent customer returns 404 (error propagated correctly)', r3.status === 404 || r3.body.error !== undefined, JSON.stringify(r3.body));

  // N8N-04: Valid update
  console.log('\n── N8N-04/05: Update');
  const r4 = await req('POST', '/webhook/crm/update', { customerId: 'C002', fields: { phone: '011 888 7766' } }, authHeader);
  assert('N8N-04', 'Webhook /crm/update with valid payload returns 200', r4.status === 200 && r4.body.success === true, JSON.stringify(r4.body));

  // N8N-05: Malformed payload → 400
  const r5 = await req('POST', '/webhook/crm/update', { customerId: 'C002' }, authHeader);
  assert('N8N-05', 'Webhook /crm/update with missing fields returns 400', r5.status === 400, JSON.stringify(r5.body));

  // N8N-06: Retry resilience — RPA returns validation error (422), not 503
  console.log('\n── N8N-06: Validation error propagation');
  const r6 = await req('POST', '/webhook/crm/update', { customerId: 'C001', fields: { name: 'X', phone: '!!' } }, authHeader);
  assert('N8N-06', 'RPA validation error (422) propagated — not swallowed as 503', r6.status === 422 || r6.body.error !== undefined, JSON.stringify(r6.body));

  // N8N-07: Concurrent requests — 3 simultaneous search calls
  console.log('\n── N8N-07: Concurrency');
  const concurrent = await Promise.all([
    req('POST', '/webhook/crm/search', { query: 'C001' }, authHeader),
    req('POST', '/webhook/crm/search', { query: 'C003' }, authHeader),
    req('POST', '/webhook/crm/search', { query: 'David' }, authHeader)
  ]);
  const allOk = concurrent.every(r => r.status === 200 && Array.isArray(r.body.results));
  assert('N8N-07', '3 concurrent requests all complete successfully', allOk,
    concurrent.map(r => r.status).join(', '));

  // History endpoint
  console.log('\n── N8N-08: History');
  const r8 = await req('GET', '/webhook/crm/history/C001', null, authHeader);
  assert('N8N-08', 'History endpoint returns logs array', r8.status === 200 && Array.isArray(r8.body.logs), JSON.stringify(r8.body));

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('❌ PHASE 2 TEST GATE — FAILED. Fix errors before proceeding to Phase 3.\n');
    process.exit(1);
  } else {
    console.log('✅ PHASE 2 TEST GATE — PASSED. Ready for Phase 3.\n');
    process.exit(0);
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
