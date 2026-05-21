// netlify/functions/edit-request.js
// Handles student info change requests → inserts into student_edit_requests table

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
      'Prefer':        'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let studentId, password, changes, reason;
  try {
    ({ studentId, password, changes, reason } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normId = String(studentId || '').trim().toLowerCase();
  if (!normId || !password || !changes?.length || !reason) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Missing required fields.' }) };
  }

  try {
    // 1. Verify student + password
    const students = await supabaseReq(
      `students?id=eq.${encodeURIComponent(normId)}&select=id,master_password&limit=1`
    );
    if (!students?.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    if (String(students[0].master_password || '').trim() !== String(password).trim()) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Unauthorized.' }) };
    }

    // 2. Insert one row per changed field
    const rows = changes.map(c => ({
      student_id:  normId,
      field_name:  c.field,
      old_value:   c.old  || null,
      new_value:   c.new  || null,
      reason:      reason,
      status:      'pending',
      submitted_at: new Date().toISOString()
    }));

    await supabaseReq('student_edit_requests', {
      method: 'POST',
      body: JSON.stringify(rows)
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('edit-request error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
