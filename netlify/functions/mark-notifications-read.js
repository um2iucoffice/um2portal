// netlify/functions/mark-notifications-read.js
// Marks a list of notification IDs as read for a student.

const { createClient } = require('@supabase/supabase-js');
// AFTER
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { enabled: false },
    global: { fetch }
  }
);

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

  const { student_id, ids } = body;
  if (!student_id || !Array.isArray(ids) || ids.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'student_id and ids are required' }) };
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('student_id', student_id); // safety: only mark own notifications

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('[mark-notifications-read] error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to mark notifications as read' })
    };
  }
};