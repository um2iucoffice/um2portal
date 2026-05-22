// ============================================================
//  netlify/functions/get-channels.js
//  Returns active channels from Supabase, filtered by the
//  student's current academic year (passed as a query param).
//
//  Environment variables required (same as login.js):
//    SUPABASE_URL
//    SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error on ${path}: ${err}`);
  }
  return res.json();
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // The frontend passes ?year=Year+1  (URL-encoded)
  // e.g. "Year 1", "Year 2", "Alumni", etc.
  const studentYear = (event.queryStringParameters?.year || '').trim();

  try {
    // Fetch all active channels, ordered by sort_order
    const rows = await supabaseFetch(
      `channels?is_active=eq.true&select=id,name,description,platform,channel_link,gp_link,members,sort_order,allowed_years&order=sort_order.asc`
    );

    // Filter by allowed_years if the column exists and studentYear is provided
    // allowed_years is a text[] column, e.g. ["Year 1","Year 2","Alumni"]
    // If allowed_years is NULL or empty → channel is visible to everyone
    const channels = (rows || []).filter(ch => {
      const allowed = ch.allowed_years;
      if (!allowed || allowed.length === 0) return true;   // open to all
      if (!studentYear) return true;                        // no year context → show all
      return allowed.includes(studentYear);
    });

    // Strip the allowed_years field before sending to client
    const safe = channels.map(({ allowed_years, ...rest }) => rest);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, channels: safe }),
    };

  } catch (err) {
    console.error('get-channels error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, message: err.message }),
    };
  }
};
