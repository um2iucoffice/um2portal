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

// ── Validate session token against the sessions table ────────────────────────
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

// ── Allowed field names students can request edits for ───────────────────────
const ALLOWED_FIELDS = new Set([
  'photo', 'father', 'father_my', 'mother', 'mother_my',
  'email', 'gender',
]);

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if ((event.requestContext?.http?.method || event.httpMethod) === 'OPTIONS') {
    return { statusCode: 204, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS };
  }
  if ((event.requestContext?.http?.method || event.httpMethod) !== 'POST') {
    return { statusCode: 405, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Invalid JSON.' }),
    };
  }

  const { studentId, token, fields, oldValues, reason } = body;

  // ── Basic input validation ─────────────────────────────────────────────────
  const cleanStudentId = String(studentId || '').trim().toLowerCase();
  const cleanToken     = String(token     || '').trim();
  const cleanReason    = String(reason    || '').replace(/<[^>]*>/g, '').trim().slice(0, 1000);

  if (!cleanStudentId) {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Missing student ID.' }),
    };
  }
  if (!cleanToken) {
    return { statusCode: 401, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Unauthorized: no session token provided.' }),
    };
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authenticatedId = await validateToken(cleanToken, cleanStudentId);
  if (!authenticatedId) {
    return { statusCode: 401, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Unauthorized: invalid or expired session.' }),
    };
  }
  if (authenticatedId.toLowerCase() !== cleanStudentId) {
    return { statusCode: 403, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Forbidden.' }),
    };
  }

  // ── Validate fields object ────────────────────────────────────────────────
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Missing or invalid fields object.' }),
    };
  }

  const sanitisedFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const cleaned = String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
    if (cleaned) sanitisedFields[key] = cleaned;
  }

  if (Object.keys(sanitisedFields).length === 0) {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'No valid fields provided.' }),
    };
  }

  // ── Insert one row per changed field ──────────────────────────────────────
  try {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(sanitisedFields)) {
      await supabase('student_edit_requests', {
        method:  'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          student_id:   cleanStudentId,
          field_name:   key,
          new_value:    value,
          old_value:    String((oldValues && oldValues[key]) || '').trim(),
          reason:       cleanReason,
          status:       'pending',
          submitted_at: now,
          created_at:   now,
        }),
      });
    }

    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('edit-request error:', err);
    return { statusCode: 500, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'},  headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Server error. Please try again.' }),
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
