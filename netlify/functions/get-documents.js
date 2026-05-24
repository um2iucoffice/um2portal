'use strict';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  }
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase [${res.status}] on ${path}: ${errText}`);
  }
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : [];
}

const HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  try {
    const rows = await supabase(
      'documents?is_visible=eq.true&order=sort_order.asc,created_at.desc',
      { method: 'GET' }
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, documents: rows }),
    };
  } catch (err) {
    console.error('get-documents error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ success: false, error: 'Server error.' }),
    };
  }
};
