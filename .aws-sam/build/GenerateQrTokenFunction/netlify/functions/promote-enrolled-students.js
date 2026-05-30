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

// POST { period_id, promoted_by }
// Updates students.year for all approved requests in a closed period
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const { period_id, promoted_by } = JSON.parse(event.body || '{}');

  // Get period
  const periods = await supabase(
    `enrollment_periods?id=eq.${period_id}&limit=1`, {}, true);
  const period = periods[0];

  if (new Date() < new Date(period.close_at)) {
    return { statusCode: 200, headers,
             body: JSON.stringify({ success: false,
                                    message: 'Period not yet closed' }) };
  }

  // Get all approved requests for this period
  const requests = await supabase(
    `enrollment_requests?period_id=eq.${period_id}` +
    `&status=eq.approved`, {}, true
  );

  let promoted = 0;
  for (const req of requests) {
    // Update student year using to_year_id
    await supabase(`students?id=eq.${req.student_id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ year: period.to_year_id })
    }, true);

    // Mark request as promoted
    await supabase(`enrollment_requests?id=eq.${req.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status:      'promoted',
        promoted_at: new Date().toISOString(),
        reviewed_by: promoted_by
      })
    }, true);

    promoted++;
  }

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, promoted }) };
};
