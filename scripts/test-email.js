#!/usr/bin/env node
'use strict';

// Simple test helper to POST a tiny PNG to /api/send-charts on the local server
// and print the JSON response. Reads PORT from .env if present.

try { require('dotenv').config(); } catch (_) {}

const PORT = process.env.PORT || 3001;
const API_BASE = `${process.env.API_BASE || `http://localhost:${PORT}`}`;

const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

(async function main() {
  try {
    const res = await fetch(`${API_BASE}/api/send-charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.TEST_EMAIL || 'arun@qualsights.com', monthlyChart: dataUrl, totalsPieChart: dataUrl })
    });
    const json = await res.json().catch(() => ({}));
    console.log('Status:', res.status, res.statusText);
    console.log('Response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error posting to API:', err);
    process.exitCode = 1;
  }
})();
