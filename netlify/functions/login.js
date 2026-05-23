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
    ({ studentId,
