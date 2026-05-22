const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { enabled: false },   // ← fixes the WebSocket crash
    global: { fetch: fetch }
  }
);

exports.handler = async () => {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, description, platform, channel_link, gp_link, members, sort_order, allowed_years')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, channels: data })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
