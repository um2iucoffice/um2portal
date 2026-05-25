// netlify/functions/get-timetable.js

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

  let studentId;
  try {
    ({ studentId } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normId = String(studentId || '').trim().toLowerCase();

  if (!normId) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student ID is required.' }) };
  }

  try {
    // ── 1. Fetch student ─────────────────────────────────────
    const students = await supabase(
      `students?id=eq.${encodeURIComponent(normId)}&select=id,program,year,status&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    const raw = students[0];

    // ── 2. Enrollments + year resolution in parallel ─────────
    let programIds = raw.program ? [raw.program] : [];
    let yearId = null;

    await Promise.all([
      supabase(`enrollments?student_id=eq.${encodeURIComponent(normId)}&select=program_id`, {}, true)
        .then(rows => (rows || []).forEach(e => {
          const pid = e.program_id;
          if (pid && !programIds.includes(pid)) programIds.push(pid);
        }))
        .catch(e => console.warn('Could not fetch enrollments:', e.message)),

      raw.year
        ? supabase(`academic_years?name=eq.${encodeURIComponent(raw.year)}&select=id&limit=1`, {}, true)
            .then(rows => { if (rows && rows.length > 0) yearId = rows[0].id; })
            .catch(() => {})
        : Promise.resolve(),
    ]);

    // ── 3. Fetch & filter timetable rows ─────────────────────
    let ttRows = [];
    const rawRows = await supabase(
      `lecture_timetable?select=id,course_id,room_id,day,time_start,time_end,academic_year_id,session_date,sub_topic&order=day.asc,time_start.asc`,
      {}, true
    );
    const studentStatus = (raw.status || '').toLowerCase();
    const isAlumni = studentStatus === 'degree awarded' || studentStatus === 'graduated' || studentStatus === 'alumni';

    ttRows = (rawRows || []).filter(row => {
      const ayid = (row.academic_year_id || '').trim();
      if (!ayid) return true;
      if (ayid === yearId) return true;
      if (ayid === 'All Academic Year') return !isAlumni;
      return false;
    });

    if (ttRows.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, timetable: [] }) };
    }

    // ── 4. Enrich with course + room names ───────────────────
    const courseIds = [...new Set(ttRows.map(r => r.course_id).filter(Boolean))];
    const roomIds   = [...new Set(ttRows.map(r => r.room_id).filter(Boolean))];
    const courseMap = {};
    const roomMap   = {};

    await Promise.all([
      courseIds.length > 0
        ? supabase(`courses?id=in.(${courseIds.map(encodeURIComponent).join(',')})&select=id,name`)
            .then(rows => (rows || []).forEach(c => { courseMap[c.id] = c.name; }))
            .catch(e => console.warn('Could not fetch course names:', e.message))
        : Promise.resolve(),

      roomIds.length > 0
        ? supabase(`lecture_rooms?id=in.(${roomIds.join(',')})&select=id,subject`, {}, true)
            .then(rows => (rows || []).forEach(r => { roomMap[r.id] = r.subject; }))
            .catch(e => console.warn('Could not fetch room names:', e.message))
        : Promise.resolve(),
    ]);

    const timetable = ttRows.map(r => ({
      id:               r.id               || '',
      course_id:        r.course_id        || '',
      course_name:      courseMap[r.course_id] || r.course_id || '',
      room_id:          r.room_id          || '',
      room_name:        roomMap[r.room_id] || r.room_id || '',
      day:              r.day              || '',
      time_start:       r.time_start       || '',
      time_end:         r.time_end         || '',
      academic_year_id: r.academic_year_id || null,
      session_date:     r.session_date     || null,
      sub_topic:        r.sub_topic        || '',
    }));

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, timetable }) };

  } catch (err) {
    console.error('get-timetable error:', err);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Server error: ' + err.message }) };
  }
};
