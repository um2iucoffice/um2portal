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

const crypto = require('crypto');

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
    courseId:     String(row.course_id   || '').trim().toUpperCase(),
    course:       row.course             || '',
    grade:        row.letter             || '',
    numericScore: row.score              ?? '',
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

// ── Map academic year row ────────────────────────────────────
function mapAcademicYear(row) {
  return {
    id:             row.id               || '',
    name:           row.name             || '',
    sortOrder:      row.sort_order       ?? 99,
    programId:      row.program_id       || null,
    durationMonths: row.duration_months  ?? 12,
  };
}

// ── Store session token in Supabase ──────────────────────────
async function storeSessionToken(studentId, token) {
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
  try {
    await supabase(
      'sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          student_id:  studentId,
          token:       token,
          expires_at:  expiresAt,
        })
      },
      true // use service key
    );
  } catch (e) {
    // Non-fatal: sessions table may not exist yet.
    // Token will still work client-side; server-side validation
    // will simply be skipped until you create the table.
    console.warn('Could not store session token (sessions table may not exist):', e.message);
  }
}

// ── Netlify handler ──────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

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
      `students?id=eq.${encodeURIComponent(normId)}&select=*&limit=1`,
      {},
      true  // service key — server-side only, never exposed to browser
    );

    if (!students || students.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Student ID not found. Please check your credentials.' })
      };
    }

    const raw = students[0];

    // ── 2. Verify master_password ────────────────────────────
    const { createHash } = await import('crypto');
    const inputHash  = createHash('sha256').update(normPass).digest('hex');
    const storedHash = String(raw.master_password || '').trim();
    if (storedHash !== inputHash) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Incorrect password. Please try again.' })
      };
    }

    // ── 3. Generate session token ────────────────────────────
    // A cryptographically random token is issued after successful auth.
    // The plaintext password is NEVER returned to or stored by the client.
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Persist token to Supabase `sessions` table (optional but recommended).
    // Create the table with: id, student_id, token, expires_at, created_at
    await storeSessionToken(normId, sessionToken);

    // ── 4. Fetch degree program name for primary enrollment ──
    let programName = raw.program || '';
    if (raw.program) {
      try {
        const programs = await supabase(
          `degree_programs?id=eq.${encodeURIComponent(raw.program)}&select=id,name&limit=1`,
          {},
          true
        );
        if (programs && programs.length > 0 && programs[0].name) {
          programName = programs[0].name;
        }
      } catch (e) {
        console.warn('Could not fetch degree program name:', e.message);
      }
    }

    // ── 5. Map student ───────────────────────────────────────
    const student = mapStudent(raw, programName);

    // ── 6. Fetch grades ──────────────────────────────────────
    const gradeRows = await supabase(
      `grades?student_id=eq.${encodeURIComponent(raw.id)}&select=*&order=course_id.asc`,
      {},
      true
    );
    const grades = (gradeRows || []).map(mapGrade);

    // ── 7. Fetch all courses ─────────────────────────────────
    let courses = {};
    try {
      const courseRows = await supabase(
        `courses?select=id,name,year,block_module,credits,assessment_type&order=id.asc`,
        {},
        true
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

    // ── 8. Fetch enrollments ─────────────────────────────────
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
              `degree_programs?id=in.(${programIds.map(encodeURIComponent).join(',')})&select=id,name`,
              {},
              true
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

    // ── 9. Fallback: synthesise enrollment from students row ─
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

    // ── 10. Fetch markbook ───────────────────────────────────
    let markbook = [];
    try {
      const markbookRows = await supabase(
        `markbook?student_id=eq.${encodeURIComponent(raw.id)}&select=*&order=course_id.asc`,
        {},
        true
      );
      markbook = (markbookRows || []).map(r => ({
        courseId:       String(r.course_id || '').trim().toUpperCase(),
        assessmentName: r.assessment_name || '',
        maxScore:       r.max_score       ?? '',
        score:          r.score           ?? '',
        percentage:     r.percentage      ?? '',
        grade:          r.letter          || '',
        year:           r.year            || '',
        block:          r.block           || '',
        notes:          r.notes           || '',
        updatedAt:      r.updated_at      || ''
      }));
    } catch (e) {
      console.warn('Could not fetch markbook (table may not exist):', e.message);
    }

    // ── 11. Build photo URL if needed ────────────────────────
    if (student.photo && !student.photo.startsWith('http')) {
      student.photo = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${student.photo}`;
    }

    // ── 12. Fetch announcements ──────────────────────────────
    let announcements = [];
    try {
      const announcementRows = await supabase(
        `announcements?is_approved=eq.true&order=published_at.desc&select=*`,
        {},
        true
      );
      announcements = (announcementRows || []).map(a => ({
        id:             a.id             || '',
        type:           a.type           || 'news',
        title:          a.title          || '',
        body:           a.body           || '',
        image_url:      a.image_url      || null,
        event_date:     a.event_date     || null,
        event_time:     a.event_time     || null,
        event_location: a.event_location || null,
        published_at:   a.published_at   || '',
        author_type:    a.author_type    || '',
        author_name:    a.author_name    || null,
      }));
    } catch (e) {
      console.warn('Could not fetch announcements:', e.message);
    }

    // ── 13. Fetch academic years ─────────────────────────────
    let academicYears = [];
    try {
      const yearRows = await supabase(
        `academic_years?select=id,name,sort_order,program_id,duration_months&order=sort_order.asc`,
        {},
        true
      );
      academicYears = (yearRows || []).map(mapAcademicYear);
    } catch (e) {
      console.warn('Could not fetch academic years:', e.message);
    }

    // ── 14. Return — token included, password never returned ─
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success:       true,
        token:         sessionToken,   // ← replaces password on client
        student,
        grades,
        courses,
        enrollments,
        markbook,
        announcements,
        academicYears,
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