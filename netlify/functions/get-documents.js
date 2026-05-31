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

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Accept both GET (query params) and POST (body)
  let studentId;
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      studentId = (body.student_id || body.studentId || '').trim();
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Invalid JSON.' }) };
    }
  } else {
    studentId = (event.queryStringParameters?.student_id || event.queryStringParameters?.studentId || '').trim();
  }

  if (!studentId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: 'Missing student_id.' }) };
  }

  try {
    const [globalDocs, studentDocs] = await Promise.all([
      supabaseGet('documents?is_visible=eq.true&student_id=is.null&order=sort_order.asc,created_at.desc'),
      supabaseGet(`documents?is_visible=eq.true&student_id=eq.${encodeURIComponent(studentId)}&order=sort_order.asc,created_at.desc`),
    ]);

    const documents = [...(studentDocs || []), ...(globalDocs || [])];
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, documents }),
    };
  } catch (err) {
    console.error('get-documents error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Server error.' }) };
  }
};