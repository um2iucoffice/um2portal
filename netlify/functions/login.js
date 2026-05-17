// ============================================================
//  netlify/functions/login.js
//  Replaces: Code.gs + DataLayer.gs + StudentDomain.gs + Config.gs
//
//  Reads from Google Sheets via the Sheets REST API using a
//  service-account JWT — no SpreadsheetApp, no Apps Script.
//
//  Environment variables required (set in Netlify dashboard):
//    GOOGLE_SERVICE_ACCOUNT_EMAIL   e.g. portal@project.iam.gserviceaccount.com
//    GOOGLE_PRIVATE_KEY             PEM key (keep the \n newlines)
//    SPREADSHEET_ID                 The Google Sheet ID
// ============================================================

// ── Config (mirrors Config.gs) ───────────────────────────────
const SHEET_STUDENTS = 'Students';
const SHEET_GRADES   = 'Grades';
const GRADES_HEADER_SENTINEL = 'GradeID';

const COL = {
  PASSWORD:          0,
  STUDENT_ID:        1,
  PHOTO:             2,
  FULL_NAME_MM:      3,
  FATHER_NAME_MM:    4,
  FULL_NAME:         5,
  FATHER_NAME:       6,
  BIRTH_DATE:        7,
  EMAIL:             8,
  PHONE:             9,
  ADDRESS:           10,
  ADMISSION_YEAR:    11,
  CURRENT_STATUS:    12,
  OVERALL_GPA:       13,
  ENROLLMENT_STATUS: 14,
  GRADUATION_STATUS: 15
};

const GCOL = {
  GRADE_ID:      0,
  STUDENT_ID:    1,
  COURSE_ID:     2,
  GRADE:         3,
  NUMERIC_SCORE: 4,
  GRADE_POINT:   5,
  YEAR:          6,
  UPDATED_AT:    7,
  UPDATED_BY:    8
};

// ── Google Auth (manual JWT — no extra npm packages needed) ──
async function getAccessToken() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error('Missing Google service account env vars.');

  // Netlify stores env vars with literal \n; convert to real newlines.
  const privateKeyPem = rawKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now
  };

  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(payload)}`;

  // Sign with RS256 using Node's built-in crypto
  const { createSign } = await import('crypto');
  const sign = createSign('SHA256');
  sign.update(unsigned);
  const signature = sign.sign(privateKeyPem, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Google auth failed: ' + err);
  }
  const data = await resp.json();
  return data.access_token;
}

// ── DataLayer: fetch sheet values via REST API ───────────────
async function fetchSheetValues(token, sheetName) {
  const id  = process.env.SPREADSHEET_ID;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheetName)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets API error for "${sheetName}": ${err}`);
  }
  const json = await resp.json();
  // API returns objects with string values; normalise to 2-D array
  return json.values || [];
}

function findStudentRowByEmail(rows, email) {
  for (const row of rows.slice(1)) {              // skip header
    if (!row[COL.STUDENT_ID]) continue;
    if (String(row[COL.EMAIL] || '').trim().toLowerCase() === email) return row;
  }
  return null;
}

function fetchGradeRowsByStudentId(allRows, studentId) {
  let dataStart = 1;
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    if (String(allRows[i][0] || '').trim() === GRADES_HEADER_SENTINEL) {
      dataStart = i + 1;
      break;
    }
  }
  const normId = studentId.trim().toLowerCase();
  return allRows.slice(dataStart).filter(row => {
    const rowId = String(row[GCOL.STUDENT_ID] || '').trim().toLowerCase();
    return rowId && rowId === normId;
  });
}

// ── StudentDomain: mappers & business logic ──────────────────
function formatDate(serial) {
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (!serial || serial === '') return '—';
  // Google Sheets returns dates as formatted strings (not serials) via v4 API
  // but if a serial number slips through, convert it.
  if (!isNaN(Number(serial))) {
    const date = new Date((Number(serial) - 25569) * 86400 * 1000);
    return date.toLocaleDateString('en-GB', opts);
  }
  // Already a string — try to re-format or return as-is
  const d = new Date(serial);
  return isNaN(d) ? String(serial) : d.toLocaleDateString('en-GB', opts);
}

function mapRowToStudent(row) {
  return {
    id:               String(row[COL.STUDENT_ID] || '').trim(),
    fullNameMM:       row[COL.FULL_NAME_MM]      || '',
    fatherNameMM:     row[COL.FATHER_NAME_MM]    || '',
    fullName:         row[COL.FULL_NAME]         || '',
    fatherName:       row[COL.FATHER_NAME]       || '',
    birthDate:        formatDate(row[COL.BIRTH_DATE]),
    email:            row[COL.EMAIL]             || '',
    phone:            row[COL.PHONE]             || '',
    admissionYear:    row[COL.ADMISSION_YEAR]    || '',
    currentStatus:    row[COL.CURRENT_STATUS]    || '',
    overallGPA:       Number(row[COL.OVERALL_GPA] || 0).toFixed(2),
    enrollmentStatus: row[COL.ENROLLMENT_STATUS] || '',
    graduationStatus: row[COL.GRADUATION_STATUS] || ''
  };
}

function mapRowToGrade(row) {
  return {
    gradeId:      String(row[GCOL.GRADE_ID]      || ''),
    courseId:     String(row[GCOL.COURSE_ID]     || '').trim().toUpperCase(),
    grade:        row[GCOL.GRADE]                || '',
    numericScore: row[GCOL.NUMERIC_SCORE]        ?? '',
    gradePoint:   row[GCOL.GRADE_POINT]          ?? '',
    year:         row[GCOL.YEAR]                 || ''
  };
}

// ── Netlify handler ──────────────────────────────────────────
export const handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers (adjust origin in production if you want to restrict)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  let email, password;
  try {
    ({ email, password } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request body.' }) };
  }

  const normEmail = String(email    || '').trim().toLowerCase();
  const normPass  = String(password || '').trim();

  if (!normEmail || !normPass) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Email and password are required.' }) };
  }

  try {
    const token        = await getAccessToken();
    const studentRows  = await fetchSheetValues(token, SHEET_STUDENTS);
    const row          = findStudentRowByEmail(studentRows, normEmail);

    if (!row) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Email not found. Please check your credentials.' }) };
    }

    const storedPassword = String(row[COL.PASSWORD] || '').trim();
    if (storedPassword !== normPass) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Incorrect password. Please try again.' }) };
    }

    const student    = mapRowToStudent(row);
    const gradeRows  = await fetchSheetValues(token, SHEET_GRADES);
    const gradeData  = fetchGradeRowsByStudentId(gradeRows, student.id);
    const grades     = gradeData.map(mapRowToGrade).sort((a, b) => a.courseId.localeCompare(b.courseId));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, student, grades }) };

  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: 'Server error: ' + err.message }) };
  }
};
