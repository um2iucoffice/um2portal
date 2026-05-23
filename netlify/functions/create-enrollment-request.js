const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  const key = SUPABASE_SERVICE_KEY;
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
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// POST { student_id, period_id }
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { student_id, period_id } = JSON.parse(event.body || '{}');

    if (!student_id || !period_id) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Missing student_id or period_id' })
      };
    }

    // 1. Fetch the student's current year
    const students = await supabase(
      `students?id=eq.${student_id}&select=year&limit=1`,
      { method: 'GET' }
    );
    const student = students && students[0];
    if (!student) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Student not found' })
      };
    }

    // 2. Fetch the enrollment period to get to_year
    const periods = await supabase(
      `enrollment_periods?id=eq.${period_id}&select=*&limit=1`,
      { method: 'GET' }
    );
    const period = periods && periods[0];
    if (!period) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Enrollment period not found' })
      };
    }

    // 3. Insert the enrollment request
    // unique_student_period constraint handles duplicate submissions
    const result = await supabase(
      `enrollment_requests`, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          student_id,
          period_id,
          from_year:   student.year,
          to_year:     period.to_year,   // adjust field name to match your enrollment_periods schema
          status:      'requested',
          requested_at: new Date().toISOString()
        })
      }
    );

    const newRequest = result && result[0];

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, request_id: newRequest?.id })
    };

  } catch (err) {
    // Handle duplicate submission gracefully
    if (err.message.includes('unique_student_period')) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Enrollment request already submitted for this period' })
      };
    }

    console.error('create-enrollment-request error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
