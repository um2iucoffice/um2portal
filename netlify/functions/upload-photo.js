// netlify/functions/upload-photo.js
// Handles student photo uploads: saves photo to pending/ in Supabase Storage,
// then creates a student_edit_requests row with field_name='photo' and the pending URL.
// The Registrar reviews via the Edit Requests view and calls approve-photo on approval.

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
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} [${res.status}]: ${text}`);
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
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { studentId, safeFilename, password, imageBase64, mimeType } = body;

    if (!studentId || !imageBase64 || !mimeType) {
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Missing studentId, imageBase64, or mimeType.' })
      };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Server misconfiguration: environment variables not set.' })
      };
    }

    // 1. Verify student credentials (check master_password against students table)
    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password`
    );
    if (!students || !students.length) {
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Student not found.' })
      };
    }
    const student = students[0];
    if (password && student.master_password && student.master_password !== password) {
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Authentication failed.' })
      };
    }

    // 2. Decode base64 image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filename = safeFilename || `photo_${Date.now()}.${ext}`;

    // 3. Upload to pending/ path in Storage
    const pendingPath = `pending/${studentId}/${filename}`;
    await uploadToStorage(pendingPath, imageBuffer, mimeType);

    const pendingUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${pendingPath}`;

    // 4. Get current photo for old_value
    const allStudents = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=photo`
    );
    const currentPhoto = allStudents?.[0]?.photo || null;

    // 5. Create a pending edit request row
    //    NOTE: student_edit_requests needs a `photo_url` column (text).
    //    Run this migration if not yet present:
    //    ALTER TABLE student_edit_requests ADD COLUMN IF NOT EXISTS photo_url text;
    await supabaseRest('student_edit_requests', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        student_id:   studentId,
        field_name:   'photo',
        old_value:    currentPhoto || null,
        new_value:    filename,
        photo_url:    pendingUrl,
        reason:       'Photo upload request',
        status:       'pending',
        submitted_at: new Date().toISOString()
      })
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success:    true,
        pending:    true,
        pendingUrl: pendingUrl,
        message:    'Photo uploaded and pending Registrar approval.'
      })
    };

  } catch (err) {
    console.error('upload-photo error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
