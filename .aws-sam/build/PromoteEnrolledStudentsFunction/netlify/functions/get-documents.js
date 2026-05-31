'use strict';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  }
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
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

const HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if ((event.requestContext?.http?.method || event.httpMethod) === 'OPTIONS') {
    return { statusCode: 204, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS };
  }
  if ((event.requestContext?.http?.method || event.httpMethod) !== 'POST') {
    return { statusCode: 405, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Invalid JSON.' }),
      };
    }

    const studentId = (body.student_id || body.studentId || '').trim();

    if (!studentId) {
      return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Missing student_id.' }),
      };
    }

    // Fetch university-wide docs (student_id is null) AND this student's personal docs
    const [globalDocs, studentDocs] = await Promise.all([
      supabase(
        'documents?is_visible=eq.true&student_id=is.null&order=sort_order.asc,created_at.desc',
        { method: 'GET' }
      ),
      supabase(
        `documents?is_visible=eq.true&student_id=eq.${encodeURIComponent(studentId)}&order=sort_order.asc,created_at.desc`,
        { method: 'GET' }
      ),
    ]);

    // Student-specific docs come first, then university-wide
    const documents = [...(studentDocs || []), ...(globalDocs || [])];

    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: true, documents }),
    };

  } catch (err) {
    console.error('get-documents error:', err);
    return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Server error.' }),
    };
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
