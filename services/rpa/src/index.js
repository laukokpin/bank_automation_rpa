'use strict';
const express = require('express');
const { chromium } = require('playwright');

const app = express();

// CORS — allow Cordova browser app and any local dev origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

const PORT = process.env.PORT || 3002;
const CRM_URL = process.env.CRM_URL || 'http://mock-crm:3001';
const CRM_USER = process.env.CRM_USER || 'admin';
const CRM_PASS = process.env.CRM_PASS || 'demo123';

// Shared browser + page state
let browser = null;
let page = null;

// Serialise all RPA operations — one at a time to avoid page conflicts
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn).catch(fn);
  return queue;
}
// Wrap a handler so it runs exclusively
function serialised(handler) {
  return (req, res) => {
    let resolve;
    const slot = new Promise(r => { resolve = r; });
    queue = queue.then(() => handler(req, res).finally(resolve));
    slot; // intentionally not awaited — express handles the response
  };
}

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
  return browser;
}

async function getAuthenticatedPage() {
  const b = await getBrowser();
  if (!page || page.isClosed()) {
    const ctx = await b.newContext();
    page = await ctx.newPage();
  }

  // Check if already logged in
  try {
    await page.goto(`${CRM_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 10000 });
    if (page.url().includes('/login')) {
      await login(page);
    }
  } catch {
    await login(page);
  }
  return page;
}

async function login(p) {
  await p.goto(`${CRM_URL}/login`, { waitUntil: 'networkidle', timeout: 10000 });
  await p.fill('#username', CRM_USER);
  await p.fill('#password', CRM_PASS);
  await p.click('#login-btn');
  await p.waitForURL(`${CRM_URL}/dashboard`, { timeout: 8000 });
}

// POST /rpa/search  { query: "C001" | "Aisha" }
app.post('/rpa/search', serialised(async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' });

  try {
    const p = await getAuthenticatedPage();
    await p.goto(`${CRM_URL}/customers/search?q=${encodeURIComponent(query.trim())}`, { waitUntil: 'networkidle', timeout: 10000 });

    const noResults = await p.$('#no-results');
    if (noResults) return res.json({ results: [] });

    const rows = await p.$$eval('#results-table tbody .result-row', rows =>
      rows.map(row => ({
        id:      row.querySelector('.col-id')?.textContent?.trim(),
        name:    row.querySelector('.col-name')?.textContent?.trim(),
        account: row.querySelector('.col-account')?.textContent?.trim(),
        status:  row.querySelector('.badge')?.textContent?.trim()
      }))
    );
    res.json({ results: rows });
  } catch (err) {
    console.error('[RPA search]', err.message);
    page = null;
    res.status(503).json({ error: 'RPA error', detail: err.message });
  }
}));

// GET /rpa/customer/:id
app.get('/rpa/customer/:id', serialised(async (req, res) => {
  try {
    const p = await getAuthenticatedPage();
    await p.goto(`${CRM_URL}/customers/${req.params.id}`, { waitUntil: 'networkidle', timeout: 10000 });

    const notFound = await p.$('#not-found-msg');
    if (notFound) return res.status(404).json({ error: 'Customer not found' });

    const customer = await p.evaluate(() => ({
      id:      document.querySelector('#customer-id')?.textContent?.trim(),
      name:    document.querySelector('#customer-name')?.textContent?.trim(),
      phone:   document.querySelector('#detail-phone')?.textContent?.trim(),
      email:   document.querySelector('#detail-email')?.textContent?.trim(),
      notes:   document.querySelector('#detail-notes')?.textContent?.trim(),
      status:  document.querySelector('.badge')?.textContent?.trim()
    }));
    res.json({ customer });
  } catch (err) {
    console.error('[RPA customer]', err.message);
    page = null;
    res.status(503).json({ error: 'RPA error', detail: err.message });
  }
}));

// POST /rpa/update  { customerId, fields: { name, phone, email, notes, status } }
app.post('/rpa/update', serialised(async (req, res) => {
  const { customerId, fields } = req.body;
  if (!customerId || !fields) return res.status(400).json({ error: 'customerId and fields are required' });

  try {
    const p = await getAuthenticatedPage();
    await p.goto(`${CRM_URL}/customers/${customerId}/edit`, { waitUntil: 'networkidle', timeout: 10000 });

    const notFound = await p.$('#not-found-msg');
    if (notFound) return res.status(404).json({ error: 'Customer not found' });

    if (fields.name  !== undefined) { await p.fill('#name',  fields.name); }
    if (fields.phone !== undefined) { await p.fill('#phone', fields.phone); }
    if (fields.email !== undefined) { await p.fill('#email', fields.email); }
    if (fields.notes !== undefined) { await p.fill('#notes', fields.notes); }
    if (fields.status !== undefined) { await p.selectOption('#status', fields.status); }

    const editUrl = p.url();
    await p.click('#save-btn');

    // Wait for either: redirect away from edit page (success) OR form-errors visible (validation fail)
    await Promise.race([
      p.waitForURL(url => !url.toString().includes('/edit'), { timeout: 10000 }).catch(() => {}),
      p.waitForSelector('#form-errors', { timeout: 10000 }).catch(() => {})
    ]);

    const currentUrl = p.url();

    // Check for validation errors (stayed on edit page)
    const formErrors = await p.$('#form-errors');
    if (formErrors || currentUrl.includes('/edit')) {
      const errorText = await formErrors.textContent();
      return res.status(422).json({ error: 'Validation failed', detail: errorText.trim() });
    }

    // Check for success confirmation
    const confirmation = await p.$('#save-confirmation');
    if (confirmation) {
      return res.json({ success: true, message: 'Record updated successfully' });
    }

    res.json({ success: true, message: 'Update submitted' });
  } catch (err) {
    console.error('[RPA update]', err.message);
    page = null;
    res.status(503).json({ error: 'RPA error', detail: err.message });
  }
}));

// GET /rpa/history/:customerId
app.get('/rpa/history/:customerId', serialised(async (req, res) => {
  try {
    const p = await getAuthenticatedPage();
    await p.goto(`${CRM_URL}/customers/${req.params.customerId}/history`, { waitUntil: 'networkidle', timeout: 10000 });

    const notFound = await p.$('#not-found-msg');
    if (notFound) return res.status(404).json({ error: 'Customer not found' });

    const logs = await p.$$eval('#history-table tbody .history-row', rows =>
      rows.map(row => ({
        date:  row.querySelector('.col-date')?.textContent?.trim(),
        type:  row.querySelector('.col-type')?.textContent?.trim(),
        agent: row.querySelector('.col-agent')?.textContent?.trim(),
        notes: row.querySelector('.col-notes')?.textContent?.trim()
      }))
    );
    res.json({ customerId: req.params.customerId.toUpperCase(), logs });
  } catch (err) {
    console.error('[RPA history]', err.message);
    page = null;
    res.status(503).json({ error: 'RPA error', detail: err.message });
  }
}));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`RPA service running on http://localhost:${PORT}`));

// Graceful shutdown
process.on('SIGTERM', async () => { if (browser) await browser.close(); process.exit(0); });
