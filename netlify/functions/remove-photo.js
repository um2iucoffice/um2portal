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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { studentId, password } = JSON.parse(event.body || '{}');

    if (!studentId || !password) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
    }

    // 1. Verify credentials
    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    if (String(students[0].master_password || '').trim() !== String(password).trim()) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Incorrect password.' }) };
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

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('remove-photo error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
