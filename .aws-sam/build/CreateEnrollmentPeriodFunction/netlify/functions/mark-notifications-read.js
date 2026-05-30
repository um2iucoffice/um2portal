// netlify/functions/mark-notifications-read.js
// Marks a list of notification IDs as read for a student.

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    // Build filter: id=in.(id1,id2,...) and student_id=eq.xxx for safety
    const idList = ids.map(id => encodeURIComponent(id)).join(',');
    const url = `${SUPABASE_URL}/rest/v1/notifications`
      + `?id=in.(${idList})`
      + `&student_id=eq.${encodeURIComponent(student_id)}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({ is_read: true })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error: ${err}`);
    }

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