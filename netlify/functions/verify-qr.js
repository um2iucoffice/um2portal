// netlify/functions/verify-qr.js
// Verifies a QR token and returns the student info if valid.
// Called by verify.html when someone scans the QR code.

const crypto = require('crypto');

const QR_SECRET = process.env.QR_SECRET;

function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Invalid token format');

  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Malformed token');

  const [data, sig] = parts;

  // ── Verify signature ──
  const expectedSig = crypto
    .createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('base64url');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf      = Buffer.from(sig,         'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');

  if (sigBuf.length !== expectedBuf.length) throw new Error('Invalid signature');
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) throw new Error('Invalid signature');

  // ── Decode payload ──
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));

  // ── Check expiry ──
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error('Token expired');
  if (payload.iat && payload.iat > now + 60) throw new Error('Token issued in the future');

  return payload;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!QR_SECRET) {
    console.error('QR_SECRET environment variable is not set!');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const token = (event.queryStringParameters || {}).t;
  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ valid: false, error: 'No token provided' })
    };
  }

  try {
    const payload = verifyToken(token);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid      : true,
        studentId  : payload.sub,
        name       : payload.name,
        program    : payload.prog,
        validThrough: payload.vthy,
        issuedAt   : new Date(payload.iat * 1000).toISOString(),
        expiresAt  : new Date(payload.exp * 1000).toISOString(),
        type       : payload.type
      })
    };
  } catch (e) {
    return {
      statusCode: 200, // Return 200 so verify.html can show the error message
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: e.message })
    };
  }
};
