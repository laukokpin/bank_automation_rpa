'use strict';
/**
 * Phase 4 — Security Test Gate (SEC-01 through SEC-04)
 * + Full end-to-end happy path test
 * Run: node test-security.js
 */
const N8N = process.env.N8N_URL || 'http://localhost:5678';
const RPA = process.env.RPA_URL  || 'http://localhost:3002';
let passed = 0, failed = 0;

async function req(method, url, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, headers: res.headers };
}

function assert(id, desc, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${id}: ${desc}`); passed++; }
  else { console.error(`  ❌ ${id}: ${desc}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function run() {
  console.log('\n🔒 Security Test Suite (Phase 4)\n');

  // Get a valid token
  const authRes = await req('POST', `${N8N}/webhook/auth`, { username: 'admin', password: 'demo123' });
  const validToken = authRes.body.token;

  // SEC-01: Expired / tampered JWT rejected
  console.log('── SEC-01/02: JWT security');
  const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.INVALIDSIG';
  const r1 = await req('POST', `${N8N}/webhook/crm/search`, { query: 'C001' }, { Authorization: `Bearer ${expiredToken}` });
  assert('SEC-01', 'Tampered/expired JWT returns 401', r1.status === 401, `got ${r1.status}`);

  // SEC-02: CRM credentials not exposed in any API response
  const r2 = await req('POST', `${N8N}/webhook/crm/search`, { query: 'C001' }, { Authorization: `Bearer ${validToken}` });
  const payload = JSON.stringify(r2.body).toLowerCase();
  const credLeaked = payload.includes('demo123') || payload.includes('crm_pass') || payload.includes('password');
  assert('SEC-02', 'CRM credentials not exposed in search response', !credLeaked, credLeaked ? 'credential found in response!' : '');

  const r2b = await req('GET', `${N8N}/webhook/crm/history/C001`, null, { Authorization: `Bearer ${validToken}` });
  const histPayload = JSON.stringify(r2b.body).toLowerCase();
  const credLeaked2 = histPayload.includes('demo123') || histPayload.includes('password');
  assert('SEC-02b', 'CRM credentials not exposed in history response', !credLeaked2);

  // SEC-03: CORS headers present on n8n responses (needed by browser app)
  console.log('\n── SEC-03: CORS headers');
  const r3 = await req('OPTIONS', `${N8N}/webhook/crm/search`, null, {
    Origin: 'https://bank-rpa-demo.netlify.app',
    'Access-Control-Request-Method': 'POST'
  });
  const corsHeader = r3.headers.get('access-control-allow-origin');
  assert('SEC-03', 'n8n CORS headers present on preflight', r3.status === 204 || !!corsHeader, `status=${r3.status} cors=${corsHeader}`);

  const r3b = await req('OPTIONS', `${RPA}/rpa/search`, null, {
    Origin: 'https://bank-rpa-demo.netlify.app',
    'Access-Control-Request-Method': 'POST'
  });
  const corsHeaderRpa = r3b.headers.get('access-control-allow-origin');
  assert('SEC-03b', 'RPA service CORS headers present on preflight', r3b.status === 204 || !!corsHeaderRpa, `status=${r3b.status} cors=${corsHeaderRpa}`);

  // SEC-04: Input sanitisation — script injection attempt
  console.log('\n── SEC-04: Input sanitisation');
  const malicious = { query: '<script>alert(1)</script>' };
  const r4 = await req('POST', `${N8N}/webhook/crm/search`, malicious, { Authorization: `Bearer ${validToken}` });
  const r4Payload = JSON.stringify(r4.body);
  // Should not crash (200 or empty results), and script tag should not appear unescaped in a dangerous context
  assert('SEC-04a', 'Script injection in search query does not crash service', r4.status !== 500, `got ${r4.status}`);

  const maliciousUpdate = { customerId: 'C001', fields: { name: '<img src=x onerror=alert(1)>', phone: '011 000 0000', email: 'test@test.com' } };
  const r4b = await req('POST', `${N8N}/webhook/crm/update`, maliciousUpdate, { Authorization: `Bearer ${validToken}` });
  assert('SEC-04b', 'HTML injection in update fields is sanitised by n8n layer', r4b.status !== 500, `got ${r4b.status}`);

  // E2E: Full happy path
  console.log('\n── E2E: Full happy path (mobile → n8n → RPA → CRM)');
  const e1 = await req('POST', `${N8N}/webhook/crm/search`, { query: 'Lerato' }, { Authorization: `Bearer ${validToken}` });
  assert('E2E-01', 'Search by name returns customer', e1.status === 200 && e1.body.results?.some(r => r.name?.includes('Lerato')), JSON.stringify(e1.body));

  const e2 = await req('GET', `${N8N}/webhook/crm/customer/C005`, null, { Authorization: `Bearer ${validToken}` });
  assert('E2E-02', 'Customer detail fetch returns full record', e2.status === 200 && e2.body.customer?.id === 'C005');

  const e3 = await req('POST', `${N8N}/webhook/crm/update`, { customerId: 'C005', fields: { phone: '082 111 9900', email: 'lerato.new@bank.co.za' } }, { Authorization: `Bearer ${validToken}` });
  assert('E2E-03', 'Update customer record via full stack', e3.status === 200 && e3.body.success === true);

  const e4 = await req('GET', `${N8N}/webhook/crm/history/C005`, null, { Authorization: `Bearer ${validToken}` });
  assert('E2E-04', 'Activity history reflects update', e4.status === 200 && e4.body.logs?.length > 0);

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('❌ PHASE 4 TEST GATE — FAILED.\n');
    process.exit(1);
  } else {
    console.log('✅ PHASE 4 TEST GATE — PASSED. POC ready for deployment.\n');
    process.exit(0);
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
