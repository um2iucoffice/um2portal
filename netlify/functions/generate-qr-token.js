// netlify/functions/generate-qr-token.js
// Generates a signed, time-limited token for QR code verification.
// Called after login when the ID card or document QR is needed.

const crypto = require('crypto');

// ── Secret key — set this in Netlify environment variables ──
// Go to: Netlify → Site settings → Environment variables
// Add: QR_SECRET = (any long random string, e.g. 64 random characters)
const QR_SECRET = process.env.QR_SECRET;

/**
 * Signs a payload with HMAC-SHA256.
 * Returns a URL-safe base64 string: base64(payload_json).base64(signature)
 */
function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto
    .createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

exports.handler = async function (event, context) {
  // ── Only allow POST ──
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Require valid session (same auth check as your login function) ──
  const authHeader = event.headers['authorization'] || '';
  const sessionToken = authHeader.replace('Bearer ', '').trim();
  if (!sessionToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // ── Verify the session token against your Supabase/DB ──
  // Replace this block with your actual session validation logic
  let studentId, studentName, program, validThrough;
  try {
    const body = JSON.parse(event.body || '{}');
    studentId   = body.studentId;
    studentName = body.studentName;
    program     = body.program;
    validThrough = body.validThrough; // e.g. "2027" for ID card

    if (!studentId) throw new Error('Missing studentId');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request: ' + e.message }) };
  }

  if (!QR_SECRET) {
    console.error('QR_SECRET environment variable is not set!');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // ── Build the signed token ──
  const now     = Math.floor(Date.now() / 1000);
  const expires = now + (365 * 24 * 60 * 60); // 1 year for ID card

  const payload = {
    sub  : studentId,           // Subject: student ID
    name : studentName,         // For display on verify page
    prog : program,             // Program
    vthy : validThrough,        // Valid through year
    iat  : now,                 // Issued at
    exp  : expires,             // Expiry
    type : 'idcard'             // Token type
  };

  const token = signToken(payload);
  const verifyUrl = `https://sisportal.um2campus.org/verify.html?t=${token}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, verifyUrl })
  };
};
