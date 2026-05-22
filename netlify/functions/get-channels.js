exports.handler = async () => {
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/channels?is_active=eq.true&order=sort_order.asc&select=id,name,description,platform,channel_link,gp_link,members,sort_order,allowed_years`;

    const res = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

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
