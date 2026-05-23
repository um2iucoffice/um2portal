// POST { student_id, program_id, current_year }
// Returns active period + eligibility result for that student
// Uses: enrollment_periods (service key), 
//       calls check_enrollment_eligibility RPC
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const { student_id, program_id, current_year } = JSON.parse(event.body || '{}');

  // Fetch active period matching program + from_year
  const periods = await supabase(
    `enrollment_periods?program_id=eq.${program_id}` +
    `&from_year=eq.${encodeURIComponent(current_year)}` +
    `&open_at=lte.${new Date().toISOString()}` +
    `&close_at=gte.${new Date().toISOString()}` +
    `&limit=1`, {}, true
  );

  if (!periods || periods.length === 0) {
    return { statusCode: 200, headers,
             body: JSON.stringify({ success: true, period: null }) };
  }

  const period = periods[0];

  // Call eligibility function
  const result = await supabase(
    `rpc/check_enrollment_eligibility`, {
      method: 'POST',
      body: JSON.stringify({ p_student_id: student_id, 
                             p_period_id: period.id })
    }, true
  );

  return { statusCode: 200, headers,
           body: JSON.stringify({ success: true, period, eligibility: result }) };
};
