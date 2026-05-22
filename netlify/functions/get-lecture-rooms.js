const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { studentId, password, year } = JSON.parse(event.body || '{}');

    if (!studentId || !password) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, message: 'Missing credentials.' })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // ── 1. Verify student credentials (reuse your existing students table) ──
    const { data: student, error: authErr } = await supabase
      .from('students')
      .select('id, year, status')
      .eq('id', studentId)
      .eq('password', password)
      .single();

    if (authErr || !student) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, message: 'Invalid credentials.' })
      };
    }

    // ── 2. Use year from DB (authoritative) rather than trusting client ──
    const studentYear = student.year || year || '';

    // ── 3. Fetch active rooms accessible to this student's year ──
    //    Matches rows where year_access contains 'ALL' OR contains the student's year
    const { data: rooms, error: roomErr } = await supabase
      .from('lecture_rooms')
      .select('id, subject, description, zoom_link, zoom_meeting_id, zoom_passcode, year_access, program')
      .eq('is_active', true)
      .or(`year_access.cs.{"ALL"},year_access.cs.{"${studentYear}"}`)
      .order('subject', { ascending: true });

    if (roomErr) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, message: roomErr.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, rooms: rooms || [], year: studentYear })
    };

  } catch (e) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, message: e.message })
    };
  }
};
