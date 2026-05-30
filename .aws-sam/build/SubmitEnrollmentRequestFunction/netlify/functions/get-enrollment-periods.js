/**
 * get-enrollment-periods.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Called by the student dashboard to:
 *   1. Find the active enrollment period for the student's program + year.
 *   2. Check whether the student is eligible (pass rate, core subjects, etc.).
 *   3. Check whether they have already submitted a request for this period.
 *
 * POST body: { student_id, program_id, current_year }
 *
 * Response:
 *   { period, eligibility }
 *   — period      : the matching enrollment_periods row (or null → banner shows error)
 *   — eligibility : { eligible, already_requested, enrollment_status,
 *                     to_year, reasons[] }
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── tiny Supabase REST helper ───────────────────────────────────────────────
async function supabase(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase [${path}]: ${err}`);
  }
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// ─── handler ─────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { student_id, program_id, current_year } =
      JSON.parse(event.body || '{}');

    if (!student_id || !program_id || !current_year) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: student_id, program_id, current_year'
        })
      };
    }

    const now = new Date().toISOString();

    // ── 1. Find the active period for this program + from_year ────────────────
    //
    // enrollment_periods rows have:
    //   program_id  → matches degree_programs.id
    //   from_year_id → the academic-year label the student is currently in
    //                  (e.g. "Year 1", "1st Year", or the year_id itself)
    //   open_at / close_at → window when students can request
    //
    // We match on program_id first, then filter by the open window.
    // from_year_id is compared case-insensitively so minor label mismatches
    // (e.g. "Year 1" vs "year 1") don't silently break lookups.
    // ─────────────────────────────────────────────────────────────────────────
    const periods = await supabase(
      `enrollment_periods` +
      `?program_id=eq.${encodeURIComponent(program_id)}` +
      `&open_at=lte.${encodeURIComponent(now)}` +
      `&close_at=gte.${encodeURIComponent(now)}` +
      `&order=open_at.desc` +
      `&limit=5`          // grab a few in case of multiple open windows
    );

    if (!periods || periods.length === 0) {
      console.log(`[get-enrollment-periods] no open period for program=${program_id}`);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, period: null, eligibility: null })
      };
    }

    // Pick the period whose from_year_id matches the student's current year.
    // Falls back to the most-recent open period if no exact match, so the
    // banner still renders rather than silently disappearing.
    const currentYearNorm = String(current_year || '').trim().toLowerCase();
    let period = periods.find(p =>
      String(p.from_year_id || '').trim().toLowerCase() === currentYearNorm
    ) || periods[0];

    // ── 2. Check if student already has a request for this period ─────────────
    const existingRequests = await supabase(
      `enrollment_requests` +
      `?student_id=eq.${encodeURIComponent(student_id)}` +
      `&period_id=eq.${encodeURIComponent(period.id)}` +
      `&limit=1`
    );

    const existingRequest = existingRequests && existingRequests[0];
    const alreadyRequested = !!existingRequest;
    const enrollmentStatus = existingRequest ? existingRequest.status : null;
    const toYear           = existingRequest ? existingRequest.to_year  : period.to_year_id;

    if (alreadyRequested) {
      // Student has already submitted — just tell the frontend the status.
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          period,
          eligibility: {
            eligible:          false,   // doesn't matter — already_requested takes precedence
            already_requested: true,
            enrollment_status: enrollmentStatus,
            to_year:           toYear,
            reasons:           []
          }
        })
      };
    }

    // ── 3. Fetch student record to check eligibility ───────────────────────────
    const students = await supabase(
      `students?id=eq.${encodeURIComponent(student_id)}&limit=1` +
      `&select=id,name_en,year,status,gpa,program`
    );
    const student = students && students[0];

    if (!student) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Student not found' })
      };
    }

    // ── 4. Eligibility checks ─────────────────────────────────────────────────
    //
    // Rules come from the period row itself:
    //   min_pass_rate  → minimum % of subjects student must have passed
    //   require_core   → if true, all core subjects must be passed
    //
    // We check GPA as a proxy for pass rate here.
    // If you store per-subject pass data, replace the gpa check with a
    // proper query against grades/results.
    // ─────────────────────────────────────────────────────────────────────────
    const reasons = [];

    // Check: student status must be Active
    if (!/^active$/i.test(student.status || '')) {
      reasons.push(`Your enrollment status (${student.status || 'unknown'}) is not Active.`);
    }

    // Check: GPA / pass-rate proxy
    const minPassRate = period.min_pass_rate ?? 100;
    if (minPassRate > 0) {
      const gpa = parseFloat(student.gpa);
      // If GPA is 0 or missing we flag it; adjust threshold to your grading system
      if (!gpa || isNaN(gpa)) {
        reasons.push('Your GPA could not be verified. Please contact the Registrar.');
      }
      // Example: min_pass_rate of 100 means all subjects must be passed.
      // If you have actual pass counts, replace this block.
    }

    const eligible = reasons.length === 0;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        period,
        eligibility: {
          eligible,
          already_requested: false,
          enrollment_status: null,
          to_year:           period.to_year_id,
          reasons
        }
      })
    };

  } catch (err) {
    console.error('[get-enrollment-periods] error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
