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

// POST { period_id } — IRIR admin use
// Returns all requests for a period with student details
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const { period_id } = JSON.parse(event.body || '{}');

  const requests = await supabase(
    `enrollment_requests?period_id=eq.${period_id}` +
    `&select=*,students(id,name_en,name_my,year,status,gpa,program)` +
    `&order=requested_at.asc`, {}, true
  );

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, requests }) };
};
