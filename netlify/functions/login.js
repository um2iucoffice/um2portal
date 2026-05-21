// ============================================================
//  netlify/functions/login.js  — v2 (multi-degree support)
//  Reads from Supabase PostgreSQL:
//    students, grades, courses, degree_programs, degree_enrollments
//
//  Environment variables required (Netlify dashboard):
//    SUPABASE_URL          e.g. https://xxxx.supabase.co
//    SUPABASE_ANON_KEY     your anon / public key
//    SUPABASE_SERVICE_KEY  service_role key (never sent to browser)
// ============================================================

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Supabase REST helper ─────────────────────────────────────
async function supabase(path, options = {}, useServiceKey = false) {
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error on ${path}: ${err}`);
  }
  return res.json();
}

// ── Map student row (never expose master_password) ───────────
function mapStudent(row, programName) {
  return {
    id:               row.id              || '',
    fullName:         row.name_en         || '',
    fullNameMM:       row.name_my         || '',
    fatherName:       row.father          || '',
    fatherNameMM:     row.father_my       || '',
    dob:              row.dob             || '',
    email:            row.email           || '',
    phone:            row.phone           || '',
    address:          row.address         || '',
    admissionYear:    row.admission       || '',
    currentStatus:    row.year            || '',
    enrollmentStatus: row.status          || '',
    overallGPA:       row.gpa != null ? String(row.gpa) : '—',
    graduationStatus: row.grad_status     || '',
    graduationId:     row.graduation_id   || '',
    graduationDate:   row.graduation_date || '',
    photo:            row.photo           || '',
    program:          row.program         || '',
    programName:      programName         || row.program || '',
    degreeLevel:      row.degree_level    || 'bachelor',
    // master_password intentionally excluded
  };
}

// ── Map a single grade row ───────────────────────────────────
function mapGrade(row) {
  return {
    gradeId:      String(row.id                        || ''),
    courseId:     String(row.CourseID || row.course_id || '').trim().toUpperCase(),
    course:       row.course                           || '',
    grade:        row.letter                           || '',
    numericScore: row.NumericScore                     ?? '',
    gradePoint:   row.gp                               ?? '',
    year:         row.year                             || '',
    attempt:      row.attempt                          || '',
    notes:        row.notes                            || '',
    updatedAt:    row.updated_at                       || '',
    enrollmentId: row.enrollment_id                    || null,   // NEW: links grade → degree enrollment
  };
}

// ── Map a degree_enrollment row ──────────────────────────────
function mapEnrollment(row) {
  const prog = row.degree_programs || {};
  return {
    id:               row.id                  || '',
    studentId:        row.student_id          || '',
    degreeProgramId:  row.degree_program_id   || '',
    programName:      prog.name || row.degree_program_id || '',
    degreeLevel:      row.degree_level        || 'bachelor',
    currentYear:      row.current_year        || '',
    enrollmentStatus: row.enrollment_status   || '',
    gpa:              row.gpa != null ? String(row.gpa) : '',
    admissionDate:    row.admission_date      || '',
    graduationStatus: row.graduation_status   || '',
    graduationId:     row.graduation_id       || '',
    graduationDate:   row.graduation_date     || '',
    thesisTitle:      row.thesis_title        || '',
    supervisor:       row.supervisor          || '',
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
    // ── 1. Fetch student by ID (anon key) ────────────────────
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

    // ── 2. Verify password BEFORE using service key ──────────
    const storedPassword = String(raw.master_password || '').trim();
    if (storedPassword !== normPass) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Incorrect password. Please try again.' })
      };
    }

    // ── 3. Fetch primary degree program name ─────────────────
    let programName = raw.program || '';
    if (raw.program) {
      try {
        const programs = await supabase(
          `degree_programs?id=eq.${encodeURIComponent(raw.program)}&select=id,name&limit=1`
        );
        if (programs && programs.length > 0 && programs[0].name) {
          programName = programs[0].name;
        }
      } catch (e) {
        console.warn('Could not fetch degree program name:', e.message);
      }
    }

    // ── 4. Map student (strips master_password) ──────────────
    const student = mapStudent(raw, programName);

    // ── 5. Fetch grades (service key — password already verified) ──
    const gradeRows = await supabase(
      `grades?StudentID=eq.${encodeURIComponent(raw.id)}&select=*&order=CourseID.asc`,
      {},
      true
    );
    const grades = (gradeRows || []).map(mapGrade);

    // ── 6. Fetch all degree enrollments for this student ─────
    //       Joined with degree_programs to get name + level.
    let enrollments = [];
    try {
      const enrollmentRows = await supabase(
        `degree_enrollments?student_id=eq.${encodeURIComponent(raw.id)}`
        + `&select=*,degree_programs(id,name,level)&order=created_at.asc`,
        {},
        true
      );
      enrollments = (enrollmentRows || []).map(mapEnrollment);
    } catch (e) {
      console.warn('Could not fetch degree enrollments:', e.message);
      // Graceful fallback: synthesise a single bachelor enrollment from students row
      enrollments = [{
        id:               '',
        studentId:        raw.id,
        degreeProgramId:  raw.program         || '',
        programName:      programName          || '',
        degreeLevel:      raw.degree_level     || 'bachelor',
        currentYear:      raw.year             || '',
        enrollmentStatus: raw.status           || '',
        gpa:              raw.gpa != null ? String(raw.gpa) : '',
        admissionDate:    '',
        graduationStatus: raw.grad_status      || '',
        graduationId:     raw.graduation_id    || '',
        graduationDate:   raw.graduation_date  || '',
        thesisTitle:      '',
        supervisor:       '',
      }];
    }

    // ── 7. Fetch all courses (public) ────────────────────────
    let courses = {};
    try {
      const courseRows = await supabase(
        `courses?select=id,name,year,block_module,credits,assessment_type&order=id.asc`
      );
      for (const c of (courseRows || [])) {
        courses[c.id] = {
          name:       c.name            || '',
          year:       c.year            || '',
          block:      c.block_module    || '',
          credits:    c.credits         != null ? c.credits : null,
          assessment: c.assessment_type || ''
        };
      }
    } catch (e) {
      console.warn('Could not fetch courses:', e.message);
    }

    // ── 8. Build photo URL if needed ─────────────────────────
    if (student.photo && !student.photo.startsWith('http')) {
      student.photo = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${student.photo}`;
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        student,
        grades,
        courses,
        enrollments,   // NEW — array of all degree enrollments
      })
    };

  } catch (err) {
    console.error('Login error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
