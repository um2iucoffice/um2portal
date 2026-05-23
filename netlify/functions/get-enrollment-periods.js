// POST { student_id, program_id, current_year }
// current_year is a year NAME (e.g. "Foundation Year")
// We resolve it to an ID before querying enrollment_periods
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' };
  const { student_id, program_id, current_year } = JSON.parse(event.body || '{}');

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
    `enrollment_periods?program_id=eq.${program_id}` +
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
