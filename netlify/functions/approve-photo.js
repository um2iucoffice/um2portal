// netlify/functions/approve-photo.js

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

async function supabaseRest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`REST ${path} [${res.status}]: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function uploadToStorage(filePath, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method: 'PUT',
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  contentType,
        'x-upsert':      'true'
      },
      body: buffer
    }
  );
  if (!res.ok) throw new Error(`Storage upload failed [${res.status}]: ${await res.text()}`);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { studentId, pendingUrl } = JSON.parse(event.body || '{}');

    if (!studentId || !pendingUrl) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or pendingUrl.' }) };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_KEY not set.' }) };
    }

    // 1. Download the pending photo.
    //    Try with service key first (handles both public and private buckets).
    let dlRes = await fetch(pendingUrl, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    // Fallback: try without auth (public bucket)
    if (!dlRes.ok) {
      dlRes = await fetch(pendingUrl);
    }
    if (!dlRes.ok) {
      throw new Error(`Failed to download pending photo (${dlRes.status}). URL: ${pendingUrl}`);
    }

    const imageBuffer = Buffer.from(await dlRes.arrayBuffer());
    const contentType = dlRes.headers.get('content-type') || 'image/jpeg';
    const ext         = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    // 2. Copy to permanent path: photos/<studentId>.<ext>
    const permanentPath = `photos/${studentId}.${ext}`;
    await uploadToStorage(permanentPath, imageBuffer, contentType);

    // 3. Write RELATIVE path to students.photo (not full URL)
    await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      {
        method:  'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body:    JSON.stringify({ photo: permanentPath })
      }
    );

    const fullUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${permanentPath}`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, photoUrl: fullUrl })
    };

  } catch (err) {
    console.error('approve-photo error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
