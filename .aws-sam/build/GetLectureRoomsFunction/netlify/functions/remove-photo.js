// ============================================================
//  netlify/functions/remove-photo.js
//  Clears photo from students table and cancels any pending
//  photo requests in student_edit_requests.
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

async function supabaseRest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`REST ${path}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
  if ((event.requestContext?.http?.method || event.httpMethod) === 'OPTIONS') return { statusCode: 204, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS };
  if ((event.requestContext?.http?.method || event.httpMethod) !== 'POST')    return { statusCode: 405, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { studentId, token } = JSON.parse(event.body || '{}');

    if (!studentId || !token) {
      return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or token.' }) };
    }

    // 1. Verify session token
    const sessions = await supabaseRest(
      `sessions?token=eq.${encodeURIComponent(token)}&student_id=eq.${encodeURIComponent(studentId)}&select=student_id,expires_at&limit=1`
    );
    if (!sessions || sessions.length === 0) {
      return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Unauthorized: invalid or expired session.' }) };
    }
    if (sessions[0].expires_at && new Date(sessions[0].expires_at) < new Date()) {
      return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Unauthorized: session expired.' }) };
    }

    // 2. Null out the photo column in students
    await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ photo: null })
      }
    );

    // 3. Cancel any pending/superseded photo edit requests for this student
    await supabaseRest(
      `student_edit_requests?student_id=eq.${encodeURIComponent(studentId)}&field_name=eq.photo&status=in.(pending,superseded)`,
      {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled' })
      }
    );

    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('remove-photo error:', err);
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
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
