// ============================================================
//  netlify/functions/update-profile.js
//  Handles student photo upload — zero external dependencies.
//  Stores photo as <studentId>.jpg in Supabase Storage bucket
//  "student-photos", then updates the students table.
//
//  Environment variables required (set in Netlify dashboard):
//    SUPABASE_URL          e.g. https://xxxx.supabase.co
//    SUPABASE_ANON_KEY     your anon/public key
//    SUPABASE_SERVICE_KEY  service_role key (needed for storage write)
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BUCKET = 'student-photos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

// ── Supabase REST helper ─────────────────────────────────────
async function supabaseRest(path, options = {}, useServiceKey = false) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`REST ${path}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Supabase Storage upload ──────────────────────────────────
async function uploadToStorage(filePath, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  contentType,
        'x-upsert':      'true'   // overwrite existing — safe because filename = studentId
      },
      body: buffer
    }
  );
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
}

// ── Multipart parser — no external deps ──────────────────────
// Parses a multipart/form-data body (Buffer) into { fields, file }
// where file = { buffer, contentType } for the first file part found.
function parseMultipart(bodyBuffer, contentTypeHeader) {
  // Extract boundary from Content-Type header
  const boundaryMatch = contentTypeHeader.match(/boundary=("?)([^;"\s]+)\1/i);
  if (!boundaryMatch) throw new Error('No boundary found in Content-Type');
  const boundary = boundaryMatch[2];

  const fields = {};
  let   file   = null;

  // Split on --boundary
  const delimiter   = Buffer.from('\r\n--' + boundary);
  const terminator  = Buffer.from('\r\n--' + boundary + '--');

  // Find all part positions
  let   pos         = 0;
  const startMarker = Buffer.from('--' + boundary);

  // Walk the buffer part by part
  let   searchBuf   = bodyBuffer;
  let   offset      = 0;

  // Find first boundary
  let   idx         = searchBuf.indexOf(startMarker);
  if (idx === -1) return { fields, file };
  offset = idx + startMarker.length;

  while (offset < bodyBuffer.length) {
    // Skip \r\n after boundary line
    if (bodyBuffer[offset] === 0x0d && bodyBuffer[offset + 1] === 0x0a) offset += 2;
    else if (bodyBuffer[offset] === 0x2d && bodyBuffer[offset + 1] === 0x2d) break; // --

    // Find end of headers (blank line \r\n\r\n)
    const headerEnd = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), offset);
    if (headerEnd === -1) break;

    const rawHeaders = bodyBuffer.slice(offset, headerEnd).toString('utf8');
    offset = headerEnd + 4; // skip \r\n\r\n

    // Find next boundary
    const nextBoundary = bodyBuffer.indexOf(delimiter, offset);
    const partEnd      = nextBoundary === -1 ? bodyBuffer.length : nextBoundary;
    const partBody     = bodyBuffer.slice(offset, partEnd);

    // Parse part headers
    const headers      = {};
    for (const line of rawHeaders.split('\r\n')) {
      const colon = line.indexOf(':');
      if (colon > -1) {
        headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
      }
    }

    const disposition = headers['content-disposition'] || '';
    const nameMatch   = disposition.match(/\bname="([^"]+)"/i);
    const fileMatch   = disposition.match(/\bfilename="([^"]+)"/i);
    const partName    = nameMatch ? nameMatch[1] : null;

    if (fileMatch) {
      // File part — capture first file only
      if (!file) {
        file = {
          buffer:      partBody,
          contentType: headers['content-type'] || 'image/jpeg'
        };
      }
    } else if (partName) {
      // Text field
      fields[partName] = partBody.toString('utf8');
    }

    if (nextBoundary === -1) break;
    offset = nextBoundary + delimiter.length;
  }

  return { fields, file };
}

// ── Netlify handler ──────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Expected multipart/form-data.' }) };
    }

    // Decode body buffer
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '', 'utf8');

    const { fields, file } = parseMultipart(bodyBuffer, contentType);

    const studentId = String(fields.studentId || '').trim().toLowerCase();
    const password  = String(fields.password  || '').trim();

    if (!studentId || !password) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
    }
    if (!file || !file.buffer || file.buffer.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'No photo file received.' }) };
    }

    // ── 1. Verify student credentials ────────────────────────
    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    if (String(students[0].master_password || '').trim() !== password) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Incorrect password.' }) };
    }

    // ── 2. Upload — always <studentId>.jpg (never shared) ────
    const storagePath = `${studentId}.jpg`;
    await uploadToStorage(storagePath, file.buffer, file.contentType);

    // ── 3. Update photo column in students table ─────────────
    await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      {
        method:  'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body:    JSON.stringify({ photo: storagePath })
      },
      true  // use service key
    );

    const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, photoUrl })
    };

  } catch (err) {
    console.error('update-profile error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
