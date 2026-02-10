require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;
const OFFICIAL_EMAIL = process.env.OFFICIAL_EMAIL;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

if (!OFFICIAL_EMAIL) {
  console.error('Missing OFFICIAL_EMAIL in environment. Set OFFICIAL_EMAIL and restart.');
  // Do not exit; allow the server to run but all endpoints will return 500 until configured.
}

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Simple in-memory rate limiter (per-IP)
const rateMap = new Map();
const RATE_LIMIT = 120; // requests
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
app.use((req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateMap.get(ip) || { count: 0, start: now };
    if (now - entry.start > RATE_WINDOW_MS) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count += 1;
    }
    rateMap.set(ip, entry);
    if (entry.count > RATE_LIMIT) {
      return res.status(429).json({ is_success: false, official_email: OFFICIAL_EMAIL || null, error: 'Too many requests' });
    }
  } catch (err) {
    // don't block on rate limiter errors
  }
  next();
});

function isInteger(n) {
  return Number.isInteger(n);
}

function fibSeries(n) {
  const res = [];
  if (n <= 0) return res;
  res.push(0);
  if (n === 1) return res;
  res.push(1);
  while (res.length < n) {
    const l = res.length;
    res.push(res[l - 1] + res[l - 2]);
  }
  return res;
}

function isPrimeNum(x) {
  if (x <= 1) return false;
  if (x <= 3) return true;
  if (x % 2 === 0) return false;
  const r = Math.floor(Math.sqrt(x));
  for (let i = 3; i <= r; i += 2) if (x % i === 0) return false;
  return true;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  if (!b) return a;
  return gcd(b, a % b);
}

function gcdArray(arr) {
  return arr.reduce((acc, v) => gcd(acc, v));
}

function lcm2(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

function lcmArray(arr) {
  return arr.reduce((acc, v) => lcm2(acc, v));
}

// Helper to send uniform error responses
function sendError(res, status, message) {
  return res.status(status).json({ is_success: false, official_email: OFFICIAL_EMAIL || null, error: message });
}

app.get('/health', (req, res) => {
  if (!OFFICIAL_EMAIL) return sendError(res, 500, 'Server not configured: OFFICIAL_EMAIL missing');
  res.json({ is_success: true, official_email: OFFICIAL_EMAIL });
});

app.post('/bfhl', async (req, res) => {
  if (!OFFICIAL_EMAIL) return sendError(res, 500, 'Server not configured: OFFICIAL_EMAIL missing');

  const body = req.body;
  if (!body || typeof body !== 'object') return sendError(res, 400, 'Invalid JSON body');

  const allowedKeys = ['fibonacci', 'prime', 'lcm', 'hcf', 'AI'];
  const keys = Object.keys(body);
  if (keys.length !== 1) return sendError(res, 400, 'Request must contain exactly one top-level key');
  const key = keys[0];
  if (!allowedKeys.includes(key)) return sendError(res, 400, 'Unsupported key provided');

  try {
    if (key === 'fibonacci') {
      const n = body.fibonacci;
      if (!isInteger(n) || n <= 0 || n > 1000) return sendError(res, 400, 'fibonacci must be an integer in range 1..1000');
      const data = fibSeries(n);
      return res.json({ is_success: true, official_email: OFFICIAL_EMAIL, data });
    }

    if (key === 'prime') {
      const arr = body.prime;
      if (!Array.isArray(arr) || arr.length === 0) return sendError(res, 400, 'prime must be a non-empty array');
      const nums = arr.map((x) => {
        if (!isInteger(x)) throw new Error('prime array must contain integers');
        return x;
      });
      const data = nums.filter((x) => isPrimeNum(x));
      return res.json({ is_success: true, official_email: OFFICIAL_EMAIL, data });
    }

    if (key === 'hcf') {
      const arr = body.hcf;
      if (!Array.isArray(arr) || arr.length === 0) return sendError(res, 400, 'hcf must be a non-empty array');
      const nums = arr.map((x) => {
        if (!isInteger(x)) throw new Error('hcf array must contain integers');
        return x;
      });
      const data = gcdArray(nums);
      return res.json({ is_success: true, official_email: OFFICIAL_EMAIL, data });
    }

    if (key === 'lcm') {
      const arr = body.lcm;
      if (!Array.isArray(arr) || arr.length === 0) return sendError(res, 400, 'lcm must be a non-empty array');
      const nums = arr.map((x) => {
        if (!isInteger(x)) throw new Error('lcm array must contain integers');
        return x;
      });
      const data = lcmArray(nums);
      return res.json({ is_success: true, official_email: OFFICIAL_EMAIL, data });
    }

    if (key === 'AI') {
      const question = body.AI;
      if (typeof question !== 'string' || question.trim().length === 0) return sendError(res, 400, 'AI must be a non-empty string');
      if (!genAI) return sendError(res, 503, 'AI service not configured');

      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Answer Question: ${question}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        
        if (!content) return sendError(res, 502, 'AI service returned no answer');
        const single = content.trim().split(/\s+/)[0].replace(/["'.,?!;:—-]/g, '');
        console.log(`AI response for "${question}": ${single}`);
        return res.json({ is_success: true, official_email: OFFICIAL_EMAIL, data: single });
      } catch (err) {
        console.error('AI error:', err.message);
        return sendError(res, 502, 'AI service error');
      }
    }

    return sendError(res, 400, 'Unhandled key');
  } catch (err) {
    const msg = err && err.message ? err.message : 'Server error';
    return sendError(res, 400, msg);
  }
});

// Generic 404
app.use((req, res) => res.status(404).json({ is_success: false, official_email: OFFICIAL_EMAIL || null, error: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`bfhl-api listening on port ${PORT}`);
});
