// POST { program_id, from_year, to_year, open_at, close_at,
//        min_pass_rate, require_all_core, auto_promote, notes, created_by }
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const body = JSON.parse(event.body || '{}');

  const row = await supabase(`enrollment_periods`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      program_id:       body.program_id,
      from_year:        body.from_year,
      to_year:          body.to_year,
      open_at:          body.open_at,
      close_at:         body.close_at,
      min_pass_rate:    body.min_pass_rate    ?? 100,
      require_all_core: body.require_all_core ?? true,
      auto_promote:     body.auto_promote     ?? true,
      notes:            body.notes            || null,
      created_by:       body.created_by       || null
    })
  }, true);

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, period: row[0] }) };
};
