require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASS = process.env.DASHBOARD_PASS || 'change-me';

app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: 30 * 24 * 60 * 60 * 1000,
  etag: true,
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === DASHBOARD_USER && pass === DASHBOARD_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="V Dental Dashboard"');
  return res.status(401).send('Authentication required');
}

// Public: lead capture from the landing page forms
app.post('/api/leads', (req, res) => {
  const { name, phone, source, utm_source, utm_medium, utm_campaign, gclid } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  const stmt = db.prepare(`
    INSERT INTO leads (name, phone, source, utm_source, utm_medium, utm_campaign, gclid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    String(name).trim(),
    String(phone).trim(),
    source || 'lead_form',
    utm_source || null,
    utm_medium || null,
    utm_campaign || null,
    gclid || null
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Protected: dashboard page + API
app.use('/dashboard', requireAuth, express.static(path.join(__dirname, '..', 'dashboard')));

app.get('/api/leads', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  res.json(rows);
});

app.patch('/api/leads/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/leads/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`V Dental landing page running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
