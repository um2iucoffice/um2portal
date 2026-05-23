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
