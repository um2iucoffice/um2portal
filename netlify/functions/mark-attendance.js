const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json'
};

async function supabase(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let studentId, lectureName, sessionDate, sessionFrom, sessionTill;
  try {
    ({ studentId, lectureName, sessionDate, sessionFrom, sessionTill } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, message: 'Invalid request.' }) };
  }

  if (!studentId || !lectureName || !sessionDate || !sessionFrom) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: false, message: 'Missing required fields.' }) };
  }

  const now      = new Date();
  const [sh, sm] = sessionFrom.split(':').map(Number);
  const startMs  = sh * 60 + sm;
  const nowMins  = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMins = (nowMins + 390) % (24 * 60);

  if (localMins < startMs - 15 || localMins > startMs + 30) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: false, message: 'Attendance window is closed for this class.' }) };
  }

  const existing = await supabase(
    `attendance?student_id=eq.${encodeURIComponent(studentId)}&lecture_name=eq.${encodeURIComponent(lectureName)}&session_date=eq.${encodeURIComponent(sessionDate)}&session_from=eq.${encodeURIComponent(sessionFrom)}&select=id&limit=1`
  ).catch(() => []);

  if (existing && existing.length > 0) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: false, message: 'Attendance already marked.' }) };
  }

  await supabase('attendance', {
    method: 'POST',
    body: JSON.stringify({
      student_id:   studentId,
      lecture_name: lectureName,
      session_date: sessionDate,
      session_from: sessionFrom,
      session_till: sessionTill || null,
      status:       'Present'
    })
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, message: 'Attendance marked successfully.' }) };
};