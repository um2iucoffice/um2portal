// netlify/functions/verify.js
//
// Called by verify.html with POST { id: "STU001" }
// Looks up the student in the same Google Sheet used by login.js
// Returns { success: true, student: { ... } } or { success: false, message: "..." }
//
// Required Netlify environment variables (same as login.js):
//   SHEET_ID       — your Google Sheet ID
//   GOOGLE_API_KEY — your Google Sheets API key (read-only is fine)
//
// Sheet must have a "Students" tab with at minimum these columns:
//   id, fullName, fullNameMM, currentStatus, enrollmentStatus,
//   graduationStatus, admissionYear, birthDate, fatherName, phone, email

const SHEET_NAME    = 'Students';   // adjust if your tab is named differently
const SHEET_ID      = process.env.SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Column name that holds the student ID (case-sensitive, must match sheet header)
const ID_COLUMN = 'id';

exports.handler = async function (event) {
  // ── CORS headers ──────────────────────────────────────────────
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  // ── Parse request ─────────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Invalid request body' }) };
  }

  const requestedId = (body.id || '').trim();
  if (!requestedId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Student ID is required' }) };
  }

  // ── Validate environment ──────────────────────────────────────
  if (!SHEET_ID || !GOOGLE_API_KEY) {
    console.error('Missing SHEET_ID or GOOGLE_API_KEY env vars');
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Server configuration error' }) };
  }

  // ── Fetch sheet data ──────────────────────────────────────────
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${GOOGLE_API_KEY}`;

  let sheetRes;
  try {
    sheetRes = await fetch(url);
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ success: false, message: 'Could not reach data source' }) };
  }

  if (!sheetRes.ok) {
    const text = await sheetRes.text();
    console.error('Sheet API error:', sheetRes.status, text);
    return { statusCode: 502, headers, body: JSON.stringify({ success: false, message: 'Data source error' }) };
  }

  const sheetData = await sheetRes.json();
  const rows = sheetData.values || [];
  if (rows.length < 2) {
    return { statusCode: 404, headers, body: JSON.stringify({ success: false, message: 'No student records found' }) };
  }

  // ── Map headers → indices ─────────────────────────────────────
  const headers_row = rows[0].map(h => (h || '').trim());
  const col = name => headers_row.indexOf(name);

  const idIdx             = col(ID_COLUMN);
  const fullNameIdx       = col('fullName');
  const fullNameMMIdx     = col('fullNameMM');
  const currentStatusIdx  = col('currentStatus');
  const enrollStatusIdx   = col('enrollmentStatus');
  const gradStatusIdx     = col('graduationStatus');
  const admissionYearIdx  = col('admissionYear');
  const birthDateIdx      = col('birthDate');
  const fatherNameIdx     = col('fatherName');
  const phoneIdx          = col('phone');
  const emailIdx          = col('email');

  if (idIdx === -1) {
    console.error('Could not find "id" column in sheet headers:', headers_row);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Sheet structure error' }) };
  }

  // ── Find student ──────────────────────────────────────────────
  const dataRows = rows.slice(1);
  const found = dataRows.find(row => {
    const rowId = (row[idIdx] || '').trim().toLowerCase();
    return rowId === requestedId.toLowerCase();
  });

  if (!found) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, message: `No student found with ID "${requestedId}"` }),
    };
  }

  const get = idx => (idx !== -1 && found[idx] !== undefined) ? String(found[idx]).trim() : '';

  // ── Return safe public fields only ───────────────────────────
  // NOTE: email and phone are intentionally excluded from the
  // public verification response for privacy. Add them back here
  // if your policy allows it.
  const student = {
    id:               get(idIdx),
    fullName:         get(fullNameIdx),
    fullNameMM:       get(fullNameMMIdx),
    currentStatus:    get(currentStatusIdx),
    enrollmentStatus: get(enrollStatusIdx),
    graduationStatus: get(gradStatusIdx),
    admissionYear:    get(admissionYearIdx),
    birthDate:        get(birthDateIdx),
    fatherName:       get(fatherNameIdx),
    // phone and email omitted for privacy on public verify endpoint
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, student }),
  };
};
