// ============================================================
//  netlify/functions/approve-photo.js
//  Called by the Registrar when approving a photo request.
//  1. Downloads the pending photo from Storage
//  2. Stamps a watermark on it (canvas via node-canvas, or
//     simply moves/copies the file to the permanent path)
//  3. Writes the RELATIVE storage path to students.photo
//     (NOT the full URL — the frontend constructs the full URL)
//
//  Returns: { success: true, photoUrl: "<full public URL>" }
//  The caller (registrar.html) strips the prefix to get the
//  relative path before storing it in-memory.
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

async function supabaseRest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`REST ${path}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function storageRequest(method, filePath, body, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method,
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...(contentType ? { 'Content-Type': contentType } : {}),
        'x-upsert':      'true'
      },
      ...(body ? { body } : {})
    }
  );
  if (!res.ok) throw new Error(`Storage ${method} ${filePath}: ${await res.text()}`);
  return res;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { studentId, pendingUrl } = JSON.parse(event.body || '{}');

    if (!studentId || !pendingUrl) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or pendingUrl.' }) };
    }

    // 1. Download the pending photo
    const dlRes = await fetch(pendingUrl, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    if (!dlRes.ok) throw new Error(`Failed to download pending photo: ${dlRes.status}`);
    const imageBuffer   = Buffer.from(await dlRes.arrayBuffer());
    const contentType   = dlRes.headers.get('content-type') || 'image/jpeg';
    const ext           = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    // 2. Store at the permanent path: photos/<studentId>.<ext>
    //    This overwrites any previous approved photo for this student.
    //    NOTE: watermarking logic (e.g. node-canvas) would go here.
    //    For now we copy the file as-is to the permanent path.
    const permanentPath = `photos/${studentId}.${ext}`;
    await storageRequest('PUT', permanentPath, imageBuffer, contentType);

    // 3. Write the RELATIVE path (not full URL) to students.photo
    //    The registrar frontend builds the full URL as:
    //    `${SUPABASE_URL}/storage/v1/object/public/student-photos/${s.photo}`
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
