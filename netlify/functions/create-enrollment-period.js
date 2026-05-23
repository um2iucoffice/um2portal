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

// POST { program_id, from_year_id, to_year_id, open_at, close_at,
//        min_pass_rate, require_core, auto_promote, notes, created_by }
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const body = JSON.parse(event.body || '{}');

  const row = await supabase(`enrollment_periods`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      program_id:    body.program_id,
      from_year_id:  body.from_year_id,
      to_year_id:    body.to_year_id,
      open_at:       body.open_at,
      close_at:      body.close_at,
      min_pass_rate: body.min_pass_rate ?? 100,
      require_core:  body.require_core  ?? true,
      auto_promote:  body.auto_promote  ?? true,
      notes:         body.notes         || null,
      created_by:    body.created_by    || null
    })
  }, true);

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, period: row[0] }) };
};
