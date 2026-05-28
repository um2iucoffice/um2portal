// ── Auth ─────────────────────────────────────────────────────

// ── Rate limiting (client-side layer — server must also enforce) ──
const _loginAttempts = { count: 0, lockedUntil: 0 };
const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 15 * 60 * 1000; // 15 minutes

document.addEventListener('DOMContentLoaded', function () {
  // Attach Enter key listener
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !document.getElementById('loginScreen').classList.contains('hidden')) {
      doLogin();
    }
  });

  // Attach login button via addEventListener (removes need for unsafe-inline in CSP)
  const signinBtn = document.getElementById('signinBtn');
  if (signinBtn) signinBtn.addEventListener('click', doLogin);
});

function doLogin() {
  const errEl = document.getElementById('accessError');
  errEl.classList.remove('show');

  // ── Check client-side lockout ──
  if (_loginAttempts.lockedUntil && Date.now() < _loginAttempts.lockedUntil) {
    const remaining = Math.ceil((_loginAttempts.lockedUntil - Date.now()) / 60000);
    errEl.textContent = `Too many failed attempts. Please wait ${remaining} minute(s) before trying again.`;
    errEl.classList.add('show');
    return;
  }

  // ── Sanitise inputs ──
  const rawId   = (document.getElementById('loginStudentId').value  || '').trim();
  const rawPass = (document.getElementById('loginPassword').value   || '').trim();

  // Validate: only allow safe characters in Student ID
  if (!/^[a-zA-Z0-9_\-\.@]+$/.test(rawId) && rawId.length > 0) {
    errEl.textContent = 'Student ID contains invalid characters.';
    errEl.classList.add('show');
    return;
  }

  const studentId = rawId.toLowerCase();
  const password  = rawPass;

  if (!studentId || !password) {
    errEl.textContent = 'Please enter your Student ID and password.';
    errEl.classList.add('show');
    return;
  }

  // ── Max length guards ──
  if (studentId.length > 50 || password.length > 128) {
    errEl.textContent = 'Invalid credentials.';
    errEl.classList.add('show');
    return;
  }

  const btn = document.getElementById('signinBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  document.getElementById('accessLoading').classList.add('show');

  fetch('/.netlify/functions/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ studentId, password })
  })
    .then(res => {
      if (!res.ok && res.status !== 401 && res.status !== 403) {
        throw new Error('Server error: ' + res.status);
      }
      return res.json();
    })
    .then(handleAuth)
    .catch(handleAuthErr);
}

function handleAuth(r) {
  const btn   = document.getElementById('signinBtn');
  const errEl = document.getElementById('accessError');
  btn.disabled    = false;
  btn.textContent = 'Sign in';
  document.getElementById('accessLoading').classList.remove('show');

  if (!r || !r.success) {
    // ── Increment failed-attempt counter ──
    _loginAttempts.count += 1;
    if (_loginAttempts.count >= MAX_ATTEMPTS) {
      _loginAttempts.lockedUntil = Date.now() + LOCKOUT_MS;
      _loginAttempts.count = 0;
      errEl.textContent = 'Too many failed attempts. Please wait 15 minutes before trying again.';
    } else {
      const left = MAX_ATTEMPTS - _loginAttempts.count;
      errEl.textContent = (r && r.message)
        ? r.message
        : `Invalid Student ID or password. ${left} attempt(s) remaining.`;
    }
    errEl.classList.add('show');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    return;
  }

  if (!r.student) {
    errEl.textContent = 'Login succeeded but no student data was returned. Please try again or contact support.';
    errEl.classList.add('show');
    console.error('handleAuth: r.student is missing. Full response:', r);
    btn.disabled    = false;
    btn.textContent = 'Sign in';
    return;
  }

  // ── Reset failed-attempt counter on success ──
  _loginAttempts.count       = 0;
  _loginAttempts.lockedUntil = 0;

  try {
    window._announcements = r.announcements || [];
    populate(r.student, r.grades || [], r.courses || {}, r.program_meta || null, r.enrollments || [], r.academicYears || [], r.markbook || []);
  } catch (e) {
    errEl.textContent = 'Login succeeded but failed to load profile: ' + e.message + '. Please try again.';
    errEl.classList.add('show');
    console.error('populate() error:', e);
    btn.disabled    = false;
    btn.textContent = 'Sign in';
    return;
  }

  // ── Persist session (3 min TTL) — password is NOT stored ──
  try {
    window._sessionToken = r.token;
    sessionStorage.setItem('iris_session', JSON.stringify({
      token        : window._sessionToken,
      studentData  : r.student,
      grades       : r.grades        || [],
      courses      : r.courses       || {},
      program_meta : r.program_meta  || null,
      enrollments  : r.enrollments   || [],
      academicYears: r.academicYears || [],
      markbook     : r.markbook      || [],
      announcements: r.announcements || [],
      savedAt      : Date.now()
      // ✅ password intentionally NOT stored
    }));
  } catch (e) {
    console.warn('Could not persist session:', e);
  }

  document.getElementById('loginScreen').classList.add('hidden');
  const dash = document.getElementById('dashboard');
  dash.style.display = '';
  setTimeout(() => { dash.classList.add('show'); _resolveInitialHash(); }, 100);
}

function handleAuthErr(err) {
  const btn   = document.getElementById('signinBtn');
  const errEl = document.getElementById('accessError');
  btn.disabled    = false;
  btn.textContent = 'Sign in';
  document.getElementById('accessLoading').classList.remove('show');
  // Don't expose raw error details to the user
  errEl.textContent = 'Connection error. Please try again.';
  errEl.classList.add('show');
  console.error('Login network error:', err);
}

// ── Data normalisation helpers ───────────────────────────────
function firstValue(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') return val;
    }
  }
  return fallback;
}

function normaliseStudent(raw) {
  const s = raw || {};
  return Object.assign({}, s, {
    id               : firstValue(s, ['id', 'student_id', 'studentId', 'Student ID', 'StudentID']),
    fullName         : firstValue(s, ['name_en', 'fullName', 'full_name', 'Name', 'name']),
    fullNameMM       : firstValue(s, ['name_my', 'fullNameMM', 'full_name_mm', 'Name Myanmar', 'name_mm']),
    fatherName       : firstValue(s, ['father', 'fatherName', 'father_name']),
    fatherNameMM     : firstValue(s, ['father_my', 'fatherNameMM', 'father_name_mm']),
    motherName       : firstValue(s, ['mother', 'motherName', 'mother_name']),
    motherNameMM     : firstValue(s, ['mother_my', 'motherNameMM', 'mother_name_mm']),
    birthDate        : firstValue(s, ['dob', 'birthDate', 'birth_date', 'date_of_birth']),
    phone            : firstValue(s, ['phone', 'Phone']),
    email            : firstValue(s, ['email', 'Email']),
    address          : firstValue(s, ['address', 'Address']),
    admissionYear    : firstValue(s, ['admission', 'admissionYear', 'admission_year']),
    currentStatus    : firstValue(s, ['year', 'currentStatus', 'current_status', 'academic_year']),
    enrollmentStatus : firstValue(s, ['status', 'enrollmentStatus', 'enrollment_status']),
    program          : firstValue(s, ['program', 'Program']),
    programId        : firstValue(s, ['program_id', 'programId', 'program_uuid']),
    programName      : firstValue(s, ['programName', 'program_name', 'program', 'Program']),
    graduationStatus : firstValue(s, ['grad_status', 'graduationStatus', 'graduation_status']),
    graduationId     : firstValue(s, ['graduation_id', 'graduationId']),
    graduationDate   : firstValue(s, ['graduation_date', 'graduationDate']),
    graduationIdMY   : firstValue(s, ['graduation_id_my', 'graduationIdMY']),
    graduationDateMY : firstValue(s, ['graduation_date_my', 'graduationDateMY']),
    gpa              : firstValue(s, ['Overall GPA', 'overall_gpa', 'OverallGPA', 'overallGPA', 'gpa', 'GPA']),
    gender           : firstValue(s, ['gender', 'Gender', 'sex', 'Sex'])
  });
}

function normaliseGradeRow(raw) {
  const g = raw || {};
  const courseId = String(firstValue(g, [
    'courseId', 'course_id', 'Course ID', 'CourseID', 'course_code', 'Course Code', 'code'
  ], '')).trim();

  return Object.assign({}, g, {
    courseId,
    course          : firstValue(g, ['course', 'Course', 'course_name', 'CourseName', 'courseName', 'subject', 'Subject']),
    numericScore    : firstValue(g, ['numericScore', 'NumericScore', 'numeric_score', 'score', 'Score']),
    grade           : firstValue(g, ['grade', 'Grade', 'letter', 'letter_grade', 'LetterGrade']),
    gradePoint      : firstValue(g, ['gradePoint', 'grade_point', 'gp', 'GP', 'GradePoint', 'gradepoint']),
    attempt         : firstValue(g, ['attempt', 'Attempt', 'attemptNo', 'attempt_no']),
    completionType  : firstValue(g, ['assessment_type', 'assessmentType', 'AssessmentType', 'completionType', 'CompletionType', 'completion_type', 'type_of_completion', 'assessment']),
    completionYear  : firstValue(g, ['completionYear', 'CompletionYear', 'completion_year', 'year', 'Year']),
    academicYear    : firstValue(g, ['academicYear', 'AcademicYear', 'academic_year', 'yearLevel', 'YearLevel', 'course_year']),
    note            : firstValue(g, ['note', 'Note', 'notes', 'Notes', 'comment', 'Comment', 'remarks', 'Remarks'])
  });
}
