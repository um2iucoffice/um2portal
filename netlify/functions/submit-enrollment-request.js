const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}, useServiceKey = false) {
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
  return res.json();
}

// POST { student_id, period_id }
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { student_id, period_id } = JSON.parse(event.body || '{}');

    if (!student_id || !period_id) {
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: false, message: 'Missing student_id or period_id' }) };
    }

    // Re-run eligibility server-side
    const eligibility = await supabase(`rpc/check_enrollment_eligibility`, {
      method: 'POST',
      body: JSON.stringify({ p_student_id: student_id, p_period_id: period_id })
    }, true);

    if (!eligibility.eligible && !eligibility.already_requested) {
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: false,
                                      message: 'Not eligible',
                                      reasons: eligibility.reasons }) };
    }

    // Get period for from_year_id/to_year_id
    const periods = await supabase(
      `enrollment_periods?id=eq.${period_id}&limit=1`, {}, true);
    const period = periods[0];

    if (!period) {
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: false, message: 'Period not found' }) };
    }

    // Insert request
    await supabase(`enrollment_requests`, {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        student_id,
        period_id,
        from_year: period.from_year_id,
        to_year:   period.to_year_id,
        status:    'requested'
      })
    }, true);

    return { statusCode: 200, headers,
             body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('submit-enrollment-request error:', err);
    return { statusCode: 200, headers,
             body: JSON.stringify({ success: false, message: err.message }) };
  }
};
