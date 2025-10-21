'use strict';

// Load .env in development if present
try { require('dotenv').config(); } catch (_) {}

// Lightweight Express server to receive email + chart images (as base64 PNGs)
// and send them via email using Nodemailer. Optimized for small footprint and
// clarity; uses streaming buffers and rejects oversized payloads.

const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Config via env
const PORT = process.env.PORT || 3001;
const MAX_JSON = process.env.MAX_JSON || '2mb'; // limit payload
const MAIL_FROM = process.env.MAIL_FROM; // optional; will fall back to SMTP user
const MAIL_TO_FALLBACK = process.env.MAIL_TO || ''; 

// Transport: prefer SMTP_URL; else SMTP host creds; else fallback to Ethereal (dev)
let transporterPromise = null;
function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (process.env.SMTP_URL) {
      return nodemailer.createTransport(process.env.SMTP_URL);
    }
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: /^true$/i.test(String(process.env.SMTP_SECURE || 'false')),
        auth: (process.env.SMTP_USER || process.env.SMTP_PASS) ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
    }
    // Dev fallback: auto-create ethereal account for preview
    const testAcc = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAcc.user, pass: testAcc.pass },
    });
  })();
  return transporterPromise;
}

// Middleware
// Minimal CORS support to allow calls from other ports/hosts (e.g., XAMPP)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: MAX_JSON }));
app.use(express.urlencoded({ extended: true, limit: MAX_JSON }));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Email endpoint
// Body: { email: string, monthlyChart: string (dataURL), totalsPieChart: string (dataURL) }
app.post('/api/send-charts', async (req, res) => {
  try {
    const { email, monthlyChart, totalsPieChart } = req.body || {};
    const to = String(email || '').trim() || MAIL_TO_FALLBACK;
    if (!to) return res.status(400).json({ ok: false, error: 'Email is required' });

    // Helper to convert dataURL->Buffer and filename
    function parseDataUrl(dataUrl, name) {
      if (!dataUrl || typeof dataUrl !== 'string') return null;
      const m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!m) return null;
      const mime = m[1] || 'image/png';
      const buf = Buffer.from(m[2], 'base64');
      return { filename: `${name}.png`, content: buf, contentType: mime }; 
    }

    const attachments = [];
    const a1 = parseDataUrl(monthlyChart, 'monthly-chart');
    const a2 = parseDataUrl(totalsPieChart, 'totals-pie-chart');
    if (a1) attachments.push(a1);
    if (a2) attachments.push(a2);
    if (attachments.length === 0) return res.status(400).json({ ok: false, error: 'No chart images provided' });

    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject: 'Bucks2Bar charts',
      text: 'Attached are your requested charts.',
      html: '<p>Attached are your requested charts.</p>',
      attachments,
    });

    const previewUrl = nodemailer.getTestMessageUrl?.(info) || null;
    res.json({ ok: true, messageId: info.messageId, previewUrl });
  } catch (err) {
    console.error('send-charts error:', err);
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Serve static site for convenience (optional)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
