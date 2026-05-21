// netlify/functions/get-edit-requests.js
// Returns a student's own edit requests from student_edit_requests table

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseReq(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let studentId, password;
  try {
    ({ studentId, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normId = String(studentId || '').trim().toLowerCase();
  if (!normId || !password) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Missing fields.' }) };
  }

  try {
    // Verify student + password
    const students = await supabaseReq(
      `students?id=eq.${encodeURIComponent(normId)}&select=id,master_password&limit=1`
    );
    if (!students?.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    if (String(students[0].master_password || '').trim() !== String(password).trim()) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Unauthorized.' }) };
    }

    // Fetch this student's requests, newest first
    const requests = await supabaseReq(
      `student_edit_requests?student_id=eq.${encodeURIComponent(normId)}&order=submitted_at.desc`
    );

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, requests: requests || [] })
    };

  } catch (err) {
    console.error('get-edit-requests error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
