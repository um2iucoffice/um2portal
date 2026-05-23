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

    // 1. Fetch student's current year
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

    // 2. Fetch the enrollment period (need from_year_id and to_year_id)
    const periods = await supabase(
      `enrollment_periods?id=eq.${period_id}&select=from_year_id,to_year_id&limit=1`,
      { method: 'GET' }
    );
    const period = periods && periods[0];
    if (!period) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Enrollment period not found' })
      };
    }

    // 3. Resolve from_year_id and to_year_id → year label text from academic_years
    const yearIds = [period.from_year_id, period.to_year_id].filter(Boolean);
    const academicYears = await supabase(
      `academic_years?id=in.(${yearIds.join(',')})&select=id,year`,
      { method: 'GET' }
    );
    const yearMap = {};
    (academicYears || []).forEach(ay => { yearMap[ay.id] = ay.year; });

    const from_year = yearMap[period.from_year_id] || student.year;
    const to_year   = yearMap[period.to_year_id];

    if (!to_year) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Could not resolve target year from enrollment period' })
      };
    }

    // 4. Insert the enrollment request
    const result = await supabase(
      `enrollment_requests`, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          student_id,
          period_id,
          from_year,
          to_year,
          status:       'requested',
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
    if (err.message.includes('unique_student_period')) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'You have already submitted an enrollment request for this period.' })
      };
    }
    console.error('create-enrollment-request error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
