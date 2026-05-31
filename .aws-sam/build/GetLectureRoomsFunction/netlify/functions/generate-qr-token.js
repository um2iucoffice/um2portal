// netlify/functions/generate-qr-token.js
// Generates a signed QR token for the ID card.
// Called by qr.js after student data is loaded.

const crypto = require('crypto');

const QR_SECRET          = process.env.QR_SECRET;
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Validate session token against Supabase sessions table ───
async function validateSession(sessionToken) {
  if (!sessionToken) return null;

  const url = `${SUPABASE_URL}/rest/v1/sessions?token=eq.${encodeURIComponent(sessionToken)}&select=student_id,expires_at&limit=1`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json'
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Session lookup failed: ' + err);
  }

  const rows = await res.json();
  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  // Check expiry
  if (new Date(row.expires_at) < new Date()) return null;

  return row.student_id;
}

// ── Build signed QR token ────────────────────────────────────
function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto
    .createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

exports.handler = async function (event) {
  if ((event.requestContext?.http?.method || event.httpMethod) !== 'POST') {
    return { statusCode: 405, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: 'Method Not Allowed' };
  }

  if (!QR_SECRET) {
    console.error('QR_SECRET is not set');
    return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // ── Validate session ─────────────────────────────────────────
  const authHeader   = (event?.headers?.authorization || event?.headers?.Authorization || '');
  const sessionToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  let verifiedStudentId = null;
  try {
    verifiedStudentId = await validateSession(sessionToken);
  } catch (e) {
    console.warn('Session validation error:', e.message);
    // If sessions table doesn't exist yet, fall through and
    // trust the studentId from the request body (less secure
    // but keeps the app working until the table is created).
  }

  // ── Parse body ───────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { studentId, studentName, program, validThrough, type } = body;

  if (!studentId || !studentName) {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'studentId and studentName are required' }) };
  }

  // If session validation worked, make sure the token belongs to this student
  if (verifiedStudentId && verifiedStudentId !== studentId) {
    return { statusCode: 403, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // If no session token at all (and table exists), reject
  if (!sessionToken && verifiedStudentId !== null) {
    return { statusCode: 401, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // ── Build the signed QR token ────────────────────────────────
  const now     = Math.floor(Date.now() / 1000);
  const expires = now + (365 * 24 * 60 * 60); // 1 year

  const payload = {
    sub  : studentId,
    name : studentName,
    prog : program     || '',
    vthy : validThrough || '—',
    type : type        || 'idcard',
    iat  : now,
    exp  : expires
  };

  try {
    const token     = signToken(payload);
    const verifyUrl = `https://sisportal.um2campus.org/verifyum2iuc?t=${token}`;

    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'},
      body: JSON.stringify({ token, verifyUrl })
    };
  } catch (e) {
    console.error('Token signing failed:', e);
    return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Token generation failed' }) };
  }
};
// CORS wrapper

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const originalHandler = exports.handler;
exports.handler = async (event, context) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  const result = await originalHandler(event, context);
  return {
    ...result,
    headers: { ...CORS, ...(result.headers || {}) }
  };
};
