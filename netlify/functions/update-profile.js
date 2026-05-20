// ============================================================
//  netlify/functions/update-profile.js
//
//  Handles two operations:
//    1. POST with JSON body  → update writable student fields
//    2. POST with multipart  → upload photo to Supabase Storage
//
//  Protected (read-only) fields — never updated:
//    id, gpa, graduation_id, date, master_password, updated_at
//
//  Environment variables required:
//    SUPABASE_URL
//    SUPABASE_SERVICE_KEY   ← use SERVICE ROLE key here (not anon)
//                             needed to write to Storage and bypass RLS
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Fields students are NEVER allowed to update
const PROTECTED_FIELDS = new Set([
  'id', 'gpa', 'graduation_id', 'date',
  'master_password', 'updated_at', 'created_at'
]);

// ── Supabase REST helper ─────────────────────────────────────
async function supabaseREST(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase REST error: ${err}`);
  }
  return res;
}

// ── Verify student identity before any write ─────────────────
async function verifyStudent(studentId, password) {
  const url = `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password&limit=1`;
  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (!res.ok) return false;
  const rows = await res.json();
  if (!rows || rows.length === 0) return false;
  return String(rows[0].master_password || '').trim() === String(password || '').trim();
}

// ── Netlify handler ──────────────────────────────────────────
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const contentType = event.headers['content-type'] || '';

  // ── PHOTO UPLOAD (multipart/form-data) ──────────────────────
  if (contentType.includes('multipart/form-data')) {
    // Parse multipart manually using boundary
    try {
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) throw new Error('No boundary in multipart');

      const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      const parts = parseMultipart(bodyBuffer, boundary);

      const studentId = parts['studentId']?.text?.trim();
      const password  = parts['password']?.text?.trim();
      const file      = parts['photo'];

      if (!studentId || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
      }
      if (!file || !file.data) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'No photo file provided.' }) };
      }

      // Verify identity
      const valid = await verifyStudent(studentId, password);
      if (!valid) {
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication failed.' }) };
      }

      // Validate file type
      const mimeType = file.contentType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Only JPEG, PNG, or WebP images are allowed.' }) };
      }
      const ext = mimeType.split('/')[1].replace('jpeg','jpg');
      const fileName = `${studentId.toLowerCase()}.${ext}`;

      // Upload to Supabase Storage bucket: student-photos
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/student-photos/${fileName}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT', // upsert — overwrites existing photo
        headers: {
          'apikey':          SUPABASE_SERVICE_KEY,
          'Authorization':   `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':    mimeType,
          'x-upsert':        'true'
        },
        body: file.data
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error('Storage upload failed: ' + err);
      }

      // Save photo path in students table
      await supabaseREST(
        `students?id=eq.${encodeURIComponent(studentId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            photo:      fileName,
            updated_at: new Date().toISOString()
          })
        }
      );

      const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${fileName}`;
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, photoUrl })
      };

    } catch (err) {
      console.error('Photo upload error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: err.message }) };
    }
  }

  // ── PROFILE UPDATE (application/json) ───────────────────────
  try {
    const body = JSON.parse(event.body || '{}');
    const { studentId, password, updates } = body;

    if (!studentId || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
    }
    if (!updates || typeof updates !== 'object') {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'No updates provided.' }) };
    }

    // Verify identity
    const valid = await verifyStudent(studentId, password);
    if (!valid) {
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: 'Authentication failed.' }) };
    }

    // Strip any protected fields from updates
    const safeUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!PROTECTED_FIELDS.has(key)) {
        safeUpdates[key] = value;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'No valid fields to update.' }) };
    }

    // Always stamp updated_at
    safeUpdates.updated_at = new Date().toISOString();

    await supabaseREST(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      { method: 'PATCH', body: JSON.stringify(safeUpdates) }
    );

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: 'Profile updated successfully.' })
    };

  } catch (err) {
    console.error('Update profile error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: err.message }) };
  }
};

// ── Minimal multipart parser ─────────────────────────────────
function parseMultipart(buffer, boundary) {
  const parts = {};
  const boundaryBuf = Buffer.from('--' + boundary);
  let start = 0;

  while (start < buffer.length) {
    const boundaryIdx = indexOf(buffer, boundaryBuf, start);
    if (boundaryIdx === -1) break;
    const headerStart = boundaryIdx + boundaryBuf.length + 2; // skip \r\n
    const headerEnd   = indexOf(buffer, Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headerStr  = buffer.slice(headerStart, headerEnd).toString();
    const nextBound  = indexOf(buffer, boundaryBuf, headerEnd + 4);
    const dataEnd    = nextBound === -1 ? buffer.length : nextBound - 2; // strip \r\n before boundary
    const data       = buffer.slice(headerEnd + 4, dataEnd);

    const nameMatch  = headerStr.match(/name="([^"]+)"/);
    const ctMatch    = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    if (nameMatch) {
      const name = nameMatch[1];
      parts[name] = {
        text:        ctMatch ? null : data.toString(),
        data:        ctMatch ? data : null,
        contentType: ctMatch ? ctMatch[1].trim() : null
      };
    }
    start = nextBound === -1 ? buffer.length : nextBound;
  }
  return parts;
}

function indexOf(buf, search, offset = 0) {
  for (let i = offset; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}
