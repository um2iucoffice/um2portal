// netlify/functions/get-notifications.js
// Returns notifications for a student from the last 2 days.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TTL_DAYS = 2;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { student_id } = body;
  if (!student_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'student_id is required' }) };
  }

  // Only fetch notifications from the last 2 days
  const cutoff = new Date(Date.now() - TTL_DAYS * 86_400_000).toISOString();

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('student_id', student_id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: data || [] })
    };
  } catch (err) {
    console.error('[get-notifications] error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch notifications' })
    };
  }
};