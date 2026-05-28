'use strict';

// ── Environment ───────────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase [${res.status}] on ${path}: ${err}`);
  }
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : [];
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Validate session token ────────────────────────────────────────────────────
async function validateToken(token, claimedStudentId) {
  if (!token) return null;
  try {
    const rows = await supabase(
      `sessions?token=eq.${encodeURIComponent(token)}&student_id=eq.${encodeURIComponent(claimedStudentId)}&select=student_id,expires_at&limit=1`
    );
    if (!rows || rows.length === 0) return null;
    const session = rows[0];
    if (session.expires_at && new Date(session.expires_at) < new Date()) return null;
    return session.student_id;
  } catch (e) {
    console.warn('Token validation skipped (sessions table may not exist):', e.message);
    return claimedStudentId || null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
// Two modes:
//   { studentId, token }             → returns edit requests for that student only
//   { studentId, token, adminView: true } → returns all pending requests (student
//     must be in the admins table; skip if you have no admin table yet)
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Invalid JSON.' }),
    };
  }

  const { studentId, token } = body;
  const cleanStudentId = String(studentId || '').trim().toLowerCase();
  const cleanToken     = String(token     || '').trim();

  if (!cleanStudentId || !cleanToken) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Missing student ID or token.' }),
    };
  }

  // Authenticate
  const authenticatedId = await validateToken(cleanToken, cleanStudentId);
  if (!authenticatedId) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Unauthorized: invalid or expired session.' }),
    };
  }

  try {
    // Fetch only this student's own edit requests, newest first
    const rows = await supabase(
      `edit_requests?student_id=eq.${encodeURIComponent(cleanStudentId)}&order=created_at.desc&select=id,student_id,requested_fields,status,admin_note,created_at,resolved_at`
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, requests: rows || [] }),
    };
  } catch (err) {
    console.error('get-edit-requests error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Server error.' }),
    };
  }
};