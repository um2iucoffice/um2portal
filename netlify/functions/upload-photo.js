// ============================================================
// netlify/functions/upload-photo.js
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BUCKET = 'student-photos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function supabaseRest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!res.ok) throw new Error(`REST ${path}: ${await res.text()}`);

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function uploadToStorage(filePath, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    }
  );

  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, message: 'Method not allowed.' })
    };
  }

  try {
    const { studentId, password, imageBase64, mimeType, removePhoto } =
      JSON.parse(event.body || '{}');

    if (!studentId || !password) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          message: 'Missing studentId or password.'
        })
      };
    }

    const students = await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}&select=id,master_password,photo&limit=1`
    );

    if (!students || students.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Student not found.' })
      };
    }

    if (String(students[0].master_password || '').trim() !== String(password).trim()) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, message: 'Incorrect password.' })
      };
    }

    const currentPhoto = students[0].photo || null;

    // Remove photo directly
    if (removePhoto === true) {
      await supabaseRest(
        `students?id=eq.${encodeURIComponent(studentId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ photo: null })
        }
      );

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          message: 'Photo removed successfully.'
        })
      };
    }

    if (!imageBase64) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          message: 'No image data received.'
        })
      };
    }

    const pendingPath = `pending-photos/${studentId}.jpg`;
    const contentType = mimeType || 'image/jpeg';
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    await uploadToStorage(pendingPath, imageBuffer, contentType);

    const pendingUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${pendingPath}`;

    await supabaseRest('student_edit_requests', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        student_id: studentId,
        field_name: 'photo',
        old_value: currentPhoto,
        new_value: null,
        photo_url: pendingUrl,
        reason: 'Student photo update request',
        status: 'pending'
      })
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        pending: true,
        message: 'Photo submitted for Registrar approval.'
      })
    };

  } catch (err) {
    console.error('upload-photo error:', err);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        message: 'Server error: ' + err.message
      })
    };
  }
};
