const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  const { studentId, password, year } = JSON.parse(event.body || '{}');

  // Verify the student session (reuse your existing login logic)
  // Then query rooms:
  const { data, error } = await supabase
    .from('lecture_rooms')
    .select('*')
    .eq('is_active', true)
    .or(`year_access.cs.{"ALL"},year_access.cs.{"${year}"}`);

  if (error) return { statusCode: 200, body: JSON.stringify({ success: false, message: error.message }) };

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, rooms: data })
  };
};
