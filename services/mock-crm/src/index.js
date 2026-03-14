'use strict';
const express = require('express');
const session = require('express-session');
const path = require('path');
const { customers, activityLogs } = require('./data/seed');

const app = express();
const PORT = process.env.PORT || 3001;
const CRM_USER = process.env.CRM_USER || 'admin';
const CRM_PASS = process.env.CRM_PASS || 'demo123';

// In-memory mutable customer store (copy seed so updates persist in session)
const store = customers.map(c => ({ ...c }));
const logStore = JSON.parse(JSON.stringify(activityLogs));

function findCustomer(id) { return store.find(c => c.id === id); }
function searchCustomers(q) {
  const lq = q.toLowerCase();
  return store.filter(c =>
    c.id.toLowerCase().includes(lq) ||
    c.name.toLowerCase().includes(lq) ||
    c.account.toLowerCase().includes(lq)
  );
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'crm-legacy-secret', resave: false, saveUninitialized: false }));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// --- Auth ---
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === CRM_USER && password === CRM_PASS) {
    req.session.user = username;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Invalid username or password.' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --- Dashboard ---
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// --- Customer Search ---
app.get('/customers/search', requireAuth, (req, res) => {
  const q = req.query.q || '';
  const results = q ? searchCustomers(q) : [];
  res.render('search', { q, results, user: req.session.user });
});

// --- Customer Detail ---
app.get('/customers/:id', requireAuth, (req, res) => {
  const customer = findCustomer(req.params.id.toUpperCase());
  if (!customer) return res.render('not-found', { id: req.params.id, user: req.session.user });
  res.render('customer-detail', { customer, user: req.session.user, saved: req.query.saved });
});

// --- Customer Edit Form ---
app.get('/customers/:id/edit', requireAuth, (req, res) => {
  const customer = findCustomer(req.params.id.toUpperCase());
  if (!customer) return res.render('not-found', { id: req.params.id, user: req.session.user });
  res.render('customer-edit', { customer, user: req.session.user, errors: [] });
});

app.post('/customers/:id/edit', requireAuth, (req, res) => {
  const customer = findCustomer(req.params.id.toUpperCase());
  if (!customer) return res.render('not-found', { id: req.params.id, user: req.session.user });

  const { name, phone, email, notes, status } = req.body;
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters.');
  if (!phone || !/^[0-9 +\-()]{7,}$/.test(phone)) errors.push('Phone number is invalid.');
  if (!email || !email.includes('@')) errors.push('Email address is invalid.');

  if (errors.length) return res.render('customer-edit', { customer, user: req.session.user, errors });

  // Apply updates
  customer.name = name.trim();
  customer.phone = phone.trim();
  customer.email = email.trim();
  customer.notes = notes ? notes.trim() : customer.notes;
  customer.status = status || customer.status;

  // Log the update
  const logs = logStore[customer.id] || [];
  logs.unshift({
    date: new Date().toISOString().split('T')[0],
    type: 'System Update',
    agent: req.session.user,
    notes: 'Record updated via RPA integration.'
  });
  logStore[customer.id] = logs;

  res.redirect(`/customers/${customer.id}?saved=1`);
});

// --- Activity History ---
app.get('/customers/:id/history', requireAuth, (req, res) => {
  const customer = findCustomer(req.params.id.toUpperCase());
  if (!customer) return res.render('not-found', { id: req.params.id, user: req.session.user });
  const logs = logStore[customer.id] || [];
  res.render('history', { customer, logs, user: req.session.user });
});

app.listen(PORT, () => {
  console.log(`Mock CRM running on http://localhost:${PORT}`);
});
