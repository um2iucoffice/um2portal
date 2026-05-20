// ============================================================
//  netlify/functions/update-profile.js
//  Handles student photo upload — stores as <studentId>.jpg
//  in Supabase Storage bucket "student-photos", then updates
//  the students table photo column.
//
//  Environment variables required (set in Netlify dashboard):
//    SUPABASE_URL          e.g. https://xxxx.supabase.co
//    SUPABASE_ANON_KEY     your anon/public key
//    SUPABASE_SERVICE_KEY  service_role key (needed for storage upsert)
// ============================================================

import Busboy from 'busboy';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BUCKET = 'student-photos';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

// ── Supabase REST helper (uses anon key by default) ──────────
async function supabaseRest(path, options = {}, useServiceKey = false) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const url  = `${SUPABASE_URL}/rest/v1/${path}`;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`Supabase REST error on ${path}: ${await res.text()}`);
  return res.json();
}

// ── Supabase Storage upload (service key required for upsert) ─
async function uploadToStorage(filePath, fileBuffer, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':          SUPABASE_SERVICE_KEY,
      'Authorization':   `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':    contentType,
      'x-upsert':        'true'   // overwrite if file already exists
    },
    body: fileBuffer
  });
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
  return res.json();
}

// ── Parse multipart/form-data ────────────────────────────────
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let   fileBuffer   = null;
    let   fileContentType = 'image/jpeg';

    const bb = Busboy({
      headers: { 'content-type': event.headers['content-type'] }
    });

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, stream, info) => {
      fileContentType = info.mimeType || 'image/jpeg';
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end',  ()    => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('finish', () => resolve({ fields, fileBuffer, fileContentType }));
    bb.on('error',  err => reject(err));

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '', 'utf8');

    bb.write(body);
    bb.end();
  });
}

// ── Netlify handler ──────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { fields, fileBuffer, fileContentType } = await parseMultipart(event);

    const studentId = String(fields.studentId || '').trim().toLowerCase();
    const password  = String(fields.password  || '').trim();

    if (!studentId || !password) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'No photo file received.' }) };
    }

    // ── 1. Verify student credentials before allowing upload ──
    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    const storedPassword = String(students[0].master_password || '').trim();
    if (storedPassword !== password) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Incorrect password.' }) };
    }

    // ── 2. Upload photo — always named <studentId>.jpg ────────
    //   This guarantees each student has exactly one file and
    //   uploading again simply overwrites their own file only.
    const storagePath = `${studentId}.jpg`;
    await uploadToStorage(storagePath, fileBuffer, fileContentType);

    // ── 3. Update students table photo column ─────────────────
    await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ photo: storagePath })
      },
      true  // use service key for write
    );

    const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, photoUrl })
    };

  } catch (err) {
    console.error('update-profile error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
