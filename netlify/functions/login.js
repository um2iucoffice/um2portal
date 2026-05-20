// ============================================================
//  netlify/functions/login.js
//  Replaces: Google Sheets JWT auth + DataLayer.gs + StudentDomain.gs
//
//  Reads from Supabase PostgreSQL (students, grades, courses tables)
//
//  Environment variables required (set in Netlify dashboard):
//    SUPABASE_URL          e.g. https://xxxx.supabase.co
//    SUPABASE_ANON_KEY     your anon/public key
// ============================================================

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ── Supabase REST helper ─────────────────────────────────────
async function supabase(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error on ${path}: ${err}`);
  }
  return res.json();
}

// ── Map student row to safe object (never expose master_password) ──
function mapStudent(row) {
  return {
    id:               row.id              || '',
    fullName:         row.name_en         || '',
    fullNameMM:       row.name_my         || '',
    fatherName:       row.father          || '',
    fatherNameMM:     row.father_my       || '',
    email:            row.email           || '',
    phone:            row.phone           || '',
    address:          row.address         || '',
    admissionYear:    row.admission       || '',
    currentStatus:    row.status          || '',
    enrollmentStatus: row.year            || '',
    overallGPA:       row.gpa != null ? String(row.gpa) : '—',
    graduationStatus: row.program         || '',
    graduationId:     row.graduation_id   || '',
    graduationDate:   row.date            || '',
    photo:            row.photo           || '',
    // master_password is intentionally excluded
  };
}

// ── Map grade row ────────────────────────────────────────────
function mapGrade(row) {
  return {
    gradeId:      String(row.id          || ''),
    courseId:     String(row.course_id   || '').trim().toUpperCase(),
    grade:        row.grade              || '',
    numericScore: row.numeric_score      ?? '',
    gradePoint:   row.grade_point        ?? '',
    year:         row.year               || '',
    updatedAt:    row.updated_at         || ''
  };
}

// ── Netlify handler ──────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  let studentId, password;
  try {
    ({ studentId, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normId   = String(studentId || '').trim().toLowerCase();
  const normPass = String(password  || '').trim();

  if (!normId || !normPass) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: 'Student ID and password are required.' })
    };
  }

  try {
    // ── 1. Fetch student by ID (include master_password for auth check only) ──
    const students = await supabase(
      `students?id=eq.${encodeURIComponent(normId)}&select=*&limit=1`
    );

    if (!students || students.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Student ID not found. Please check your credentials.' })
      };
    }

    const raw = students[0];

    // ── 2. Verify master_password ────────────────────────────
    const storedPassword = String(raw.master_password || '').trim();
    if (storedPassword !== normPass) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Incorrect password. Please try again.' })
      };
    }

    // ── 3. Map student (strips master_password) ──────────────
    const student = mapStudent(raw);

    // ── 4. Fetch grades for this student ─────────────────────
    const gradeRows = await supabase(
      `grades?student_id=eq.${encodeURIComponent(raw.id)}&select=*&order=course_id.asc`
    );
    const grades = (gradeRows || []).map(mapGrade);

    // ── 5. Generate photo URL if photo path stored ────────────
    if (student.photo) {
      // If photo is already a full URL, use it; otherwise build Supabase Storage URL
      if (!student.photo.startsWith('http')) {
        student.photo = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${student.photo}`;
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, student, grades })
    };

  } catch (err) {
    console.error('Login error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
