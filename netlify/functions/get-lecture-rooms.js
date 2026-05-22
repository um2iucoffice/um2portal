// netlify/functions/get-lecture-rooms.js
// Uses plain fetch (same pattern as login.js) — no @supabase/supabase-js,
// no WebSocket dependency, works on Node.js 18/20/22.

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
    const { studentId, password, year } = JSON.parse(event.body || '{}');

    if (!studentId || !password) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Missing credentials.' })
      };
    }

    // ── 1. Verify student credentials ────────────────────────────────────────
    const students = await supabaseGet(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,year,status&limit=1`
    );

    if (!students || students.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Invalid credentials.' })
      };
    }

    const student = students[0];

    // Verify password against master_password column
    const raw = await supabaseGet(
      `students?id=eq.${encodeURIComponent(studentId)}&select=master_password&limit=1`
    );
    const storedPassword = String((raw[0] || {}).master_password || '').trim();
    if (storedPassword !== String(password).trim()) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Invalid credentials.' })
      };
    }

    // ── 2. Use year from DB (authoritative) ──────────────────────────────────
    const studentYear = student.year || year || '';

    // ── 3. Fetch active rooms for this student's year ─────────────────────────
    // Supabase REST: filter on jsonb array containing "ALL" or the student's year
    // Using two separate queries and merging (avoids complex OR on jsonb via REST)
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
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: e.message })
    };
  }
};
