const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { transport: ws }
  }
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const {
    student_id, title, body, type,
    image_url, event_date, event_time, event_location
  } = JSON.parse(event.body);

  if (!student_id || !title || !body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }

  const { error } = await supabase.from('announcements').insert({
    student_id,
    title,
    body,
    type:           type           || 'news',
    image_url:      image_url      || null,
    event_date:     event_date     || null,
    event_time:     event_time     || null,
    event_location: event_location || null,
    author_type:    'student',
    is_approved:    false,
    is_published:   false,
  });

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
