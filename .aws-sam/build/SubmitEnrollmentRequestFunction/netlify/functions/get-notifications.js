const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TTL_DAYS = 2;

exports.handler = async function (event) {
  if ((event.requestContext?.http?.method || event.httpMethod) !== 'POST') {
    return { statusCode: 405, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { student_id } = body;
  if (!student_id) {
    return { statusCode: 400, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body: JSON.stringify({ error: 'student_id is required' }) };
  }

  const cutoff = new Date(Date.now() - TTL_DAYS * 86_400_000).toISOString();

  const url = `${SUPABASE_URL}/rest/v1/notifications?student_id=eq.${student_id}&created_at=gte.${cutoff}&order=created_at.desc&select=*`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json();
  return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'},
    body: JSON.stringify({ notifications: data || [] })
  };
};
// CORS wrapper

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const originalHandler = exports.handler;
exports.handler = async (event, context) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  const result = await originalHandler(event, context);
  return {
    ...result,
    headers: { ...CORS, ...(result.headers || {}) }
  };
};
