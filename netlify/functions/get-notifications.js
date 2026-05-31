'use strict';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TTL_DAYS = 2;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

exports.handler = async function (event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Accept both GET (query params) and POST (body)
  let student_id;
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      student_id = body.student_id;
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  } else {
    student_id = event.queryStringParameters?.student_id;
  }

  if (!student_id) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'student_id is required' }) };
  }

  const cutoff = new Date(Date.now() - TTL_DAYS * 86_400_000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/notifications?student_id=eq.${student_id}&created_at=gte.${cutoff}&order=created_at.desc&select=*`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  'application/json',
      },
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: data || [] }),
    };
  } catch (err) {
    console.error('get-notifications error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
  }
};