// ============================================================
//  netlify/functions/upload-photo.js
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BUCKET = 'student-photos';

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

async function uploadToStorage(filePath, buffer, contentType) {
  // Use PUT with x-upsert so re-uploads always succeed (no "already exists" error)
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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Storage upload failed: ${errText}`);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const {
      studentId,
      password,
      imageBase64,
      mimeType,
      safeFilename,   // sent by frontend: e.g. "photo_1716300000000.jpg"
      removePhoto
    } = JSON.parse(event.body || '{}');

    if (!studentId || !password) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or password.' }) };
    }

    // 1. Verify credentials
    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password,photo&limit=1`
    );
    if (!students || students.length === 0) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Student not found.' }) };
    }
    if (String(students[0].master_password || '').trim() !== String(password).trim()) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Incorrect password.' }) };
    }

    const currentPhoto = students[0].photo || null;

    // ── REMOVE PHOTO PATH ─────────────────────────────────────
    if (removePhoto === true) {
      await supabaseRest(
        `students?id=eq.${encodeURIComponent(studentId)}`,
        {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ photo: null })
        }
      );
      // Also cancel any pending photo requests for this student
      await supabaseRest(
        `student_edit_requests?student_id=eq.${encodeURIComponent(studentId)}&field_name=eq.photo&status=eq.pending`,
        {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'cancelled' })
        }
      );
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true })
      };
    }

    // ── UPLOAD PATH ───────────────────────────────────────────
    if (!imageBase64) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'No image data received.' }) };
    }

    // Build a safe storage path.
    // safeFilename comes from the frontend (e.g. "photo_1716300000000.jpg").
    // Sanitize studentId to strip any chars Supabase Storage won't accept.
    const safeStudentId = studentId.replace(/[^a-z0-9_\-]/g, '_');
    const filename      = safeFilename
      ? safeFilename.replace(/[^a-z0-9_\-\.]/gi, '_')   // extra safety
      : `photo_${Date.now()}.jpg`;

    const pendingPath = `pending-photos/${safeStudentId}/${filename}`;
    const contentType = mimeType || 'image/jpeg';
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    await uploadToStorage(pendingPath, imageBuffer, contentType);

    const pendingUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${pendingPath}`;

    // Cancel any existing pending photo request for this student
    // (prevents duplicate rows piling up each time they re-upload)
    await supabaseRest(
      `student_edit_requests?student_id=eq.${encodeURIComponent(studentId)}&field_name=eq.photo&status=eq.pending`,
      {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'superseded' })
      }
    );

    // Insert fresh pending edit request
    await supabaseRest('student_edit_requests', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        student_id: studentId,
        field_name: 'photo',
        old_value:  currentPhoto || null,
        new_value:  null,
        photo_url:  pendingUrl,
        reason:     'Student photo update request',
        status:     'pending'
      })
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success:    true,
        pending:    true,
        pendingUrl: pendingUrl,   // returned so frontend overlay can show it
        message:    'Photo submitted for Registrar approval.'
      })
    };

  } catch (err) {
    console.error('upload-photo error:', err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
