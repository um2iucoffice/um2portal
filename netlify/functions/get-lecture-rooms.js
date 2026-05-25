// netlify/functions/get-lecture-rooms.js
// Authenticates via session token (issued by login.js) — no password needed.

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseGet(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json'
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { studentId, token } = JSON.parse(event.body || '{}');

    if (!studentId || !token) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Missing credentials.' })
      };
    }

    const normId = String(studentId).trim().toLowerCase();

    // ── 1. Validate session token ─────────────────────────────────────────────
    const sessions = await supabaseGet(
      `sessions?student_id=eq.${encodeURIComponent(normId)}&token=eq.${encodeURIComponent(token)}&select=student_id,expires_at&limit=1`
    );

    if (!sessions || sessions.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Invalid credentials.' })
      };
    }

    // Check token hasn't expired
    const expiresAt = new Date(sessions[0].expires_at);
    if (expiresAt < new Date()) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Session expired. Please log in again.' })
      };
    }

    // ── 2. Fetch student year ─────────────────────────────────────────────────
    const students = await supabaseGet(
      `students?id=eq.${encodeURIComponent(normId)}&select=id,year&limit=1`
    );

    const studentYear = ((students[0] || {}).year || '').trim();

    // ── 3. Fetch active rooms ─────────────────────────────────────────────────
    const [roomsAll, roomsYear] = await Promise.all([
      supabaseGet(
        `lecture_rooms?select=id,subject,description,zoom_link,zoom_meeting_id,zoom_passcode,year_access,program&is_active=eq.true&year_access=cs.%7B%22ALL%22%7D&order=subject.asc`
      ),
      studentYear
        ? supabaseGet(
            `lecture_rooms?select=id,subject,description,zoom_link,zoom_meeting_id,zoom_passcode,year_access,program&is_active=eq.true&year_access=cs.%7B%22${encodeURIComponent(studentYear)}%22%7D&order=subject.asc`
          )
        : Promise.resolve([])
    ]);

    // Merge and deduplicate by id
    const seen = new Set();
    const rooms = [];
    for (const r of [...(roomsAll || []), ...(roomsYear || [])]) {
      if (!seen.has(r.id)) { seen.add(r.id); rooms.push(r); }
    }
    rooms.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, rooms, year: studentYear })
    };

  } catch (e) {
    console.error('[get-lecture-rooms] error:', e.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: e.message })
    };
  }
};
