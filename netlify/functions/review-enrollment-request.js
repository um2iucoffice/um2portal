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

// POST { request_id, action, reviewed_by, override_reason, notes }
// action: 'approve' | 'reject' | 'override'
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const { request_id, action, reviewed_by,
          override_reason, notes } = JSON.parse(event.body || '{}');

  const status = action === 'approve' || action === 'override'
                 ? 'approved' : 'rejected';

  await supabase(
    `enrollment_requests?id=eq.${request_id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status,
        reviewed_by,
        reviewed_at:          new Date().toISOString(),
        eligibility_override: action === 'override',
        override_reason:      override_reason || null,
        notes:                notes || null
      })
    }, true
  );

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, status }) };
};
