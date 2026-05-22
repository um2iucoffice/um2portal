// ============================================================
//  netlify/functions/login.js
//  Reads from Supabase PostgreSQL (students, grades tables)
//
//  Environment variables required (set in Netlify dashboard):
//    SUPABASE_URL          e.g. https://xxxx.supabase.co
//    SUPABASE_ANON_KEY     your anon/public key
//    SUPABASE_SERVICE_KEY  service_role key (used only server-side
//                          after password is verified — never sent
//                          to the browser)
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
    motherName:       row.mother          || '',
    motherNameMM:     row.mother_my       || '',
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
    gender:           row.gender          || '',
  };
}

// ── Map grade row ────────────────────────────────────────────
function mapGrade(row) {
  return {
    gradeId:      String(row.id          || ''),
    courseId:     String(row.course_id   || '').trim().toUpperCase(),  // ← was: row.CourseID || row.course_id
    course:       row.course             || '',
    grade:        row.letter             || '',
    numericScore: row.score              ?? '',                         // ← was: row.NumericScore
    gradePoint:   row.gp                 ?? '',
    year:         row.year               || '',
    attempt:      row.attempt            || '',
    notes:        row.notes              || '',
    updatedAt:    row.updated_at         || ''
  };
}

// ── Map enrollment row ───────────────────────────────────────
function mapEnrollment(row, programName) {
  return {
    id:               String(row.id                 || ''),
    degreeProgramId:  row.degree_program_id          || row.program_id || '',
    programName:      programName                    || row.program_name || row.degree_program_id || '',
    degreeLevel:      row.degree_level               || 'bachelor',
    currentYear:      row.current_year               || row.year || '',
    enrollmentStatus: row.enrollment_status          || row.status || '',
    admissionDate:    row.admission_date             || row.admission || '',
    gpa:              row.gpa != null ? String(row.gpa) : '',
    graduationStatus: row.graduation_status          || row.grad_status || '',
    graduationId:     row.graduation_id              || '',
    graduationDate:   row.graduation_date            || '',
    thesisTitle:      row.thesis_title               || '',
    supervisor:       row.supervisor                 || '',
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
    // ── 1. Fetch student by ID ───────────────────────────────
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

    // ── 3. Fetch degree program name for primary enrollment ──
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

    // ── 4. Map student ───────────────────────────────────────
    const student = mapStudent(raw, programName);

    // ── 5. Fetch grades ──────────────────────────────────────
    const gradeRows = await supabase(
      `grades?student_id=eq.${encodeURIComponent(raw.id)}&select=*&order=course_id.asc`,  // ← fixed
      {},
      true
    );
    const grades = (gradeRows || []).map(mapGrade);

    // ── 6. Fetch all courses ─────────────────────────────────
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

    // ── 7. Fetch enrollments ─────────────────────────────────
    let enrollments = [];
    try {
      const enrollmentRows = await supabase(
        `enrollments?student_id=eq.${encodeURIComponent(raw.id)}&select=*&order=admission_date.asc`,
        {},
        true
      );

      if (enrollmentRows && enrollmentRows.length > 0) {
        const programIds = [...new Set(
          enrollmentRows
            .map(e => e.degree_program_id || e.program_id)
            .filter(Boolean)
        )];

        const programMap = {};
        if (programIds.length > 0) {
          try {
            const progRows = await supabase(
              `degree_programs?id=in.(${programIds.map(encodeURIComponent).join(',')})&select=id,name`
            );
            for (const p of (progRows || [])) {
              programMap[p.id] = p.name;
            }
          } catch (e) {
            console.warn('Could not fetch program names for enrollments:', e.message);
          }
        }

        enrollments = enrollmentRows.map(row => {
          const pid = row.degree_program_id || row.program_id || '';
          return mapEnrollment(row, programMap[pid] || pid);
        });
      }
    } catch (e) {
      console.warn('Could not fetch enrollments (table may not exist):', e.message);
    }

    // ── 8. Fallback: synthesise enrollment from students row ─
    if (enrollments.length === 0) {
      enrollments = [{
        id:               '',
        degreeProgramId:  raw.program         || '',
        programName:      programName         || raw.program || '',
        degreeLevel:      raw.degree_level    || 'bachelor',
        currentYear:      raw.year            || '',
        enrollmentStatus: raw.status          || '',
        admissionDate:    raw.admission       || '',
        gpa:              raw.gpa != null ? String(raw.gpa) : '',
        graduationStatus: raw.grad_status     || '',
        graduationId:     raw.graduation_id   || '',
        graduationDate:   raw.graduation_date || '',
        thesisTitle:      '',
        supervisor:       raw.supervisor      || '',
      }];
    }

    // ── 9. Build photo URL if needed ─────────────────────────
    if (student.photo && !student.photo.startsWith('http')) {
      student.photo = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${student.photo}`;
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, student, grades, courses, enrollments })
    };

  } catch (err) {
    console.error('Login error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: 'Server error: ' + err.message })
    };
  }
};
