exports.handler = async (event) => {
  try {
    const { studentYear } = JSON.parse(event.body || '{}');

    const url = `${process.env.SUPABASE_URL}/rest/v1/channels?is_active=eq.true&order=sort_order.asc&select=id,name,description,platform,channel_link,gp_link,members,sort_order,allowed_years`;

    const res = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    // Filter by allowed_years if studentYear is provided.
    // A channel is shown if:
    //   - allowed_years is null/empty (open to all), OR
    //   - allowed_years contains "ALL", OR
    //   - allowed_years contains the student's year
    const channels = (data || []).filter(ch => {
      const allowed = ch.allowed_years;
      if (!allowed || allowed.length === 0) return true;
      if (allowed.includes('ALL')) return true;
      if (!studentYear) return false;
      return allowed.includes(studentYear);
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, channels })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
