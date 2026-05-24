// ============================================================
//  netlify/functions/get-timetable.js
//  Returns the lecture_timetable rows relevant to the logged-in
//  student, enriched with course names from the courses table.
//
//  POST body: { studentId, password }
//
//  Environment variables (same as login.js):
//    SUPABASE_URL
//    SUPABASE_ANON_KEY
//    SUPABASE_SERVICE_KEY
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}, useServiceKey = false) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const url  = `${SUPABASE_URL}/rest/v1/${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error on ${path}: ${err}`);
  }
  return res.json();
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let studentId, password;
  try {
    ({ studentId, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normId   = String(studentId || '').trim().toLowerCase();
  const normPass = String(password  || '').trim();

  if (!normId || !normPass) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student ID and password are required.' }) };
  }

  try {
    // ── 1. Verify student credentials ───────────────────────
    const students = await supabase(
      `students?id=eq.${encodeURIComponent(normId)}&select=id,master_password,program&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    const raw = students[0];
    if (String(raw.master_password || '').trim() !== normPass) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Incorrect password.' }) };
    }

    // ── 2. Get all enrollments to know which programs ────────
    let programIds = raw.program ? [raw.program] : [];
    try {
      const enrollRows = await supabase(
        `enrollments?student_id=eq.${encodeURIComponent(normId)}&select=program_id`,
        {}, true
      );
      (enrollRows || []).forEach(function(e) {
        const pid = e.program_id;
        if (pid && !programIds.includes(pid)) programIds.push(pid);
      });
    } catch (e) {
      console.warn('Could not fetch enrollments for timetable:', e.message);
    }

    // ── 3. Fetch timetable rows ──────────────────────────────
    //  We fetch ALL rows (no RLS student-filter needed; the table
    //  is school-wide). Filter by academic_year_id matching
    //  programs if possible; otherwise return all rows.
    let ttRows = [];
    try {
      // Fetch rows ordered by day then time_start
      const rawRows = await supabase(
        `lecture_timetable?select=id,course_id,room_id,day,time_start,time_end,academic_year_id,session_date,sub_topic&order=day.asc,time_start.asc`,
        {}, true
      );
      ttRows = rawRows || [];
    } catch (e) {
      throw new Error('Could not fetch timetable: ' + e.message);
    }

    if (ttRows.length === 0) {
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, timetable: [] })
      };
    }

    // ── 4. Enrich with course names ──────────────────────────
    const courseIds = [...new Set(ttRows.map(r => r.course_id).filter(Boolean))];
    const courseMap = {};
    if (courseIds.length > 0) {
      try {
        const courseRows = await supabase(
          `courses?id=in.(${courseIds.map(encodeURIComponent).join(',')})&select=id,name`
        );
        (courseRows || []).forEach(c => { courseMap[c.id] = c.name; });
      } catch (e) {
        console.warn('Could not fetch course names for timetable:', e.message);
      }
    }
// ── 4b. Enrich with room names ─────────────────────────────
const roomIds = [...new Set(ttRows.map(r => r.room_id).filter(Boolean))];
const roomMap = {};
if (roomIds.length > 0) {
  try {
    const roomRows = await supabase(
      `lecture_rooms?id=in.(${roomIds.map(encodeURIComponent).join(',')})&select=id,subject`
    );
    (roomRows || []).forEach(r => { roomMap[r.id] = r.subject; });
  } catch (e) {
    console.warn('Could not fetch room names:', e.message);
  }
}
    // ── 5. Map rows ──────────────────────────────────────────
    const timetable = ttRows.map(r => ({
      id:              r.id              || '',
      course_id:       r.course_id       || '',
      course_name:     courseMap[r.course_id] || r.course_id || '',
      room_id:   r.room_id || '',
      room_name: roomMap[r.room_id] || r.room_id || '',
      day:             r.day             || '',
      time_start:      r.time_start      || '',
      time_end:        r.time_end        || '',
      academic_year_id:r.academic_year_id|| null,
      session_date:    r.session_date    || null,
      sub_topic:       r.sub_topic       || '',
    }));

    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, timetable })
    };

  } catch (err) {
    console.error('get-timetable error:', err);
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
