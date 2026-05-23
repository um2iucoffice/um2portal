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
