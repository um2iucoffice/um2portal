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

// POST { student_id, program_id, current_year }
// current_year is a year NAME (e.g. "Foundation Year")
// Resolves name → ID before querying enrollment_periods
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const { student_id, program_id, current_year } = JSON.parse(event.body || '{}');

  try {
    // Resolve year name → ID
    const yearRows = await supabase(
      `academic_years?name=eq.${encodeURIComponent(current_year)}&limit=1`, {}, true
    );
    if (!yearRows || yearRows.length === 0) {
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: true, period: null }) };
    }
    const yearId = yearRows[0].id;

    // Fetch active period matching program + from_year_id
    const periods = await supabase(
      `enrollment_periods?program_id=eq.${encodeURIComponent(program_id)}` +
      `&from_year_id=eq.${encodeURIComponent(yearId)}` +
      `&open_at=lte.${new Date().toISOString()}` +
      `&close_at=gte.${new Date().toISOString()}` +
      `&limit=1`, {}, true
    );

    if (!periods || periods.length === 0) {
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: true, period: null }) };
    }

    const period = periods[0];

    // Call eligibility RPC
    const result = await supabase(
      `rpc/check_enrollment_eligibility`, {
        method: 'POST',
        body: JSON.stringify({ p_student_id: student_id,
                               p_period_id:  period.id })
      }, true
    );

    return { statusCode: 200, headers,
             body: JSON.stringify({ success: true, period, eligibility: result }) };

  } catch (err) {
    console.error('get-enrollment-periods error:', err);
    return { statusCode: 200, headers,
             body: JSON.stringify({ success: false, period: null, error: err.message }) };
  }
};
