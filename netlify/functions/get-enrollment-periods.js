const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  const key = SUPABASE_SERVICE_KEY;
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
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// POST { student_id, program_id, current_year }
// Note: program_id may be a UUID or a program name string — we handle both
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const { student_id, program_id, current_year } = JSON.parse(event.body || '{}');

  try {
    // ── 1. Resolve program name → UUID if needed ──────────────────────────────
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedProgramId = program_id;

    if (!UUID_RE.test(program_id || '')) {
      // Try exact name match first
      const progRows = await supabase(
        `degree_programs?name=eq.${encodeURIComponent(program_id)}&select=id&limit=1`
      );
      if (progRows && progRows.length > 0) {
        resolvedProgramId = progRows[0].id;
      } else {
        // Try matching via student's joined program
        const stuRows = await supabase(
          `students?id=eq.${encodeURIComponent(student_id)}&select=program,degree_programs(id)&limit=1`
        );
        const prog = stuRows && stuRows[0];
        if (prog && prog.degree_programs && prog.degree_programs.id) {
          resolvedProgramId = prog.degree_programs.id;
        } else {
          // Case-insensitive fallback across all programs
          const allProgs = await supabase(`degree_programs?select=id,name`);
          const match = (allProgs || []).find(p =>
            (p.name || '').toLowerCase().trim() === (program_id || '').toLowerCase().trim()
          );
          if (!match) {
            console.warn('[get-enrollment-periods] could not resolve program_id for:', program_id);
            return { statusCode: 200, headers,
                     body: JSON.stringify({ success: true, period: null }) };
          }
          resolvedProgramId = match.id;
        }
      }
    }

    // ── 2. Resolve year name → UUID (with fuzzy fallback) ────────────────────
    // Try exact match first, then case-insensitive match across all years.
    // This handles mismatches like "Year 3" vs "year 3" or "3rd Year".
    let yearId = null;

    const yearRowsExact = await supabase(
      `academic_years?name=eq.${encodeURIComponent(current_year)}&select=id&limit=1`
    );
    if (yearRowsExact && yearRowsExact.length > 0) {
      yearId = yearRowsExact[0].id;
    } else {
      // Fetch all years and match case-insensitively
      const allYears = await supabase(`academic_years?select=id,name`);
      const normalise = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const target    = normalise(current_year);
      const match     = (allYears || []).find(y => normalise(y.name) === target);
      if (match) {
        yearId = match.id;
      } else {
        console.warn('[get-enrollment-periods] year not found for:', current_year,
                     '| available:', (allYears || []).map(y => y.name));
        return { statusCode: 200, headers,
                 body: JSON.stringify({ success: true, period: null }) };
      }
    }

    // ── 3. Fetch active period matching program + from_year ───────────────────
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const periods = await supabase(
      `enrollment_periods` +
      `?program_id=eq.${encodeURIComponent(resolvedProgramId)}` +
      `&from_year_id=eq.${encodeURIComponent(yearId)}` +
      `&open_at=lte.${now}` +
      `&close_at=gte.${now}` +
      `&limit=1`
    );

    if (!periods || periods.length === 0) {
      console.warn('[get-enrollment-periods] no active period for program:', resolvedProgramId, 'year:', yearId, 'date:', now);
      return { statusCode: 200, headers,
               body: JSON.stringify({ success: true, period: null }) };
    }

    const period = periods[0];

    // ── 4. Run eligibility RPC ────────────────────────────────────────────────
    const eligibility = await supabase(
      `rpc/check_enrollment_eligibility`, {
        method: 'POST',
        body: JSON.stringify({
          p_student_id: String(student_id),
          p_period_id:  String(period.id)
        })
      }
    );

    // ── 5. Fetch existing enrollment request status ───────────────────────────
    const requests = await supabase(
      `enrollment_requests` +
      `?student_id=eq.${encodeURIComponent(student_id)}` +
      `&period_id=eq.${encodeURIComponent(period.id)}` +
      `&limit=1`
    );
    const existingRequest  = requests && requests[0];
    const enrollmentStatus = existingRequest ? existingRequest.status  : null;
    const toYear           = existingRequest ? existingRequest.to_year : null;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        period,
        eligibility: {
          ...eligibility,
          enrollment_status: enrollmentStatus,
          to_year:           toYear
        }
      })
    };

  } catch (err) {
    console.error('[get-enrollment-periods] error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, period: null, error: err.message })
    };
  }
};
