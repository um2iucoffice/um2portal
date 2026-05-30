'use strict';

// ── Supabase REST helper ─────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      apikey:          SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase [${res.status}] on ${path}: ${errText}`);
  }

  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

// ── CORS headers ─────────────────────────────────────────────────────────────
const HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Allowed post types ────────────────────────────────────────────────────────
// Real columns: id, type, title, body, image_url, event_date, event_time,
//               event_location, published_at, is_published, created_by,
//               author_type, student_id, is_approved, author_name
const ALLOWED_TYPES = new Set(['news', 'event', 'article', 'announcement']);

// ── Sanitise a plain string (strip tags, trim, cap length) ───────────────────
function sanitise(val, maxLen = 500) {
  if (typeof val !== 'string') return null;
  return val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen) || null;
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // 1. CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS };
  }

  // 2. Method guard
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  try {
    // 3. Parse body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
      };
    }

    const {
      student_id,
      title,
      body:           postBody,
      type,
      image_url,
      author_name,
      event_date,
      event_time,
      event_location,
    } = body;

    // 4. Validate required fields
    const cleanTitle = sanitise(title, 200);
    const cleanBody  = sanitise(postBody, 5000);

    if (!cleanTitle) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Title is required.' }),
      };
    }
    if (!cleanBody) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Body is required.' }),
      };
    }

    // 5. Validate student_id
    const cleanStudentId = sanitise(student_id, 100);
    if (!cleanStudentId) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ success: false, error: 'Missing student ID.' }),
      };
    }

    // 6. Validate type
    const cleanType = typeof type === 'string' && ALLOWED_TYPES.has(type) ? type : 'news';

    // 7. Validate image_url (must be https or null)
    let cleanImageUrl = null;
    if (typeof image_url === 'string' && image_url.startsWith('https://')) {
      cleanImageUrl = image_url.slice(0, 1000);
    }

    // 8. Validate optional fields
    const cleanAuthorName    = sanitise(author_name, 150);
    const cleanEventDate     = /^\d{4}-\d{2}-\d{2}$/.test(event_date)    ? event_date : null;
    const cleanEventTime     = /^\d{2}:\d{2}(:\d{2})?$/.test(event_time) ? event_time : null;
    const cleanEventLocation = sanitise(event_location, 300);

    // 9. Insert — only real columns from announcements table
    await supabase('announcements', {
      method:  'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        student_id:     cleanStudentId,
        title:          cleanTitle,
        body:           cleanBody,
        type:           cleanType,
        image_url:      cleanImageUrl,
        author_name:    cleanAuthorName,
        event_date:     cleanEventDate,
        event_time:     cleanEventTime,
        event_location: cleanEventLocation,
        author_type:    'student',
        is_approved:    false,
        is_published:   false,
      }),
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true }),
    };

  } catch (err) {
    console.error('submit-post error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Server error. Please try again.' }),
    };
  }
};