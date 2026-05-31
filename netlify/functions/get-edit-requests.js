'use strict';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function supabaseGet(path) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase env vars.');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase [${res.status}] on ${path}: ${await res.text()}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : [];
}

async function validateToken(token, claimedStudentId) {
  if (!token) return null;
  try {
    const rows = await supabaseGet(
      `sessions?token=eq.${encodeURIComponent(token)}&student_id=eq.${encodeURIComponent(claimedStudentId)}&select=student_id,expires_at&limit=1`
    );
    if (!rows || rows.length === 0) return null;
    const session = rows[0];
    if (session.expires_at && new Date(session.expires_at) < new Date()) return null;
    return session.student_id;
  } catch (e) {
    console.warn('Token validation skipped:', e.message);
    return claimedStudentId || null;
  }
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Accept both GET (query params) and POST (body)
  let studentId, token;
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      studentId = String(body.studentId || '').trim().toLowerCase();
      token     = String(body.token     || '').trim();
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Invalid JSON.' }) };
    }
  } else {
    const q = event.queryStringParameters || {};
    studentId = String(q.studentId || q.student_id || '').trim().toLowerCase();
    token     = String(q.token     || '').trim();
  }

  if (!studentId || !token) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ success: false, error: 'Missing student ID or token.' }) };
  }

  const authenticatedId = await validateToken(token, studentId);
  if (!authenticatedId) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ success: false, error: 'Unauthorized: invalid or expired session.' }) };
  }

  try {
    const rows = await supabaseGet(
      `student_edit_requests?student_id=eq.${encodeURIComponent(studentId)}&order=created_at.desc&select=id,student_id,requested_fields,status,note,created_at,reviewed_at`
    );
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, requests: rows || [] }),
    };
  } catch (err) {
    console.error('get-edit-requests error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Server error.' }) };
  }
};