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
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const { student_id, program_id, current_year } = JSON.parse(event.body || '{}');
  console.log('[get-enrollment-periods] input:', { student_id, program_id, current_year });

  try {
    // ── 1. Resolve program_id → the value stored in enrollment_periods ────────
    // enrollment_periods.program_id may store a short id (e.g. "1002"), a UUID,
    // or a name. We try in order:
    //   a) use as-is if it already matches something in degree_programs.id
    //   b) match by degree_programs.name (exact, then case-insensitive)
    //   c) look up via the student row's foreign key join
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedProgramId = program_id;

    if (!UUID_RE.test(program_id || '')) {
      // (a) Try matching degree_programs.id directly (handles short ids like "1002")
      const progById = await supabase(
        `degree_programs?id=eq.${encodeURIComponent(program_id)}&select=id&limit=1`
      );
      if (progById && progById.length > 0) {
        resolvedProgramId = progById[0].id;
        console.log('[get-enrollment-periods] program resolved by id:', resolvedProgramId);
      } else {
        // (b) Try exact name match
        const progByName = await supabase(
          `degree_programs?name=eq.${encodeURIComponent(program_id)}&select=id&limit=1`
        );
        if (progByName && progByName.length > 0) {
          resolvedProgramId = progByName[0].id;
          console.log('[get-enrollment-periods] program resolved by exact name:', resolvedProgramId);
        } else {
          // (c) Try via student row join
          const stuRows = await supabase(
            `students?id=eq.${encodeURIComponent(student_id)}&select=program,degree_programs(id)&limit=1`
          );
          const prog = stuRows && stuRows[0];
          if (prog && prog.degree_programs && prog.degree_programs.id) {
            resolvedProgramId = prog.degree_programs.id;
            console.log('[get-enrollment-periods] program resolved via student join:', resolvedProgramId);
          } else {
            // (d) Case-insensitive name fallback
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
            console.log('[get-enrollment-periods] program resolved by fuzzy name:', resolvedProgramId);
          }
        }
      }
    }

    // ── 2. Resolve current_year → the value stored in enrollment_periods ──────
    // enrollment_periods.from_year_id may store a short id (e.g. "AY001"), a UUID,
    // or a name. We try in order:
    //   a) use as-is if it matches academic_years.id directly
    //   b) match by academic_years.name (exact, then case-insensitive)
    let yearId = null;

    // (a) Try matching academic_years.id directly (handles "AY001" etc.)
    const yearById = await supabase(
      `academic_years?id=eq.${encodeURIComponent(current_year)}&select=id&limit=1`
    );
    if (yearById && yearById.length > 0) {
      yearId = yearById[0].id;
      console.log('[get-enrollment-periods] year resolved by id:', yearId);
    } else {
      // (b) Try exact name match
      const yearByName = await supabase(
        `academic_years?name=eq.${encodeURIComponent(current_year)}&select=id&limit=1`
      );
      if (yearByName && yearByName.length > 0) {
        yearId = yearByName[0].id;
        console.log('[get-enrollment-periods] year resolved by exact name:', yearId);
      } else {
        // (c) Case-insensitive name fallback
        const allYears = await supabase(`academic_years?select=id,name`);
        const normalise = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const target    = normalise(current_year);
        const match     = (allYears || []).find(y => normalise(y.name) === target);
        if (match) {
          yearId = match.id;
          console.log('[get-enrollment-periods] year resolved by fuzzy name:', yearId);
        } else {
          console.warn('[get-enrollment-periods] year not found for:', current_year,
                       '| available ids+names:', (allYears || []).map(y => `${y.id}/${y.name}`));
          return { statusCode: 200, headers,
                   body: JSON.stringify({ success: true, period: null }) };
        }
      }
    }

    // ── 3. Fetch active period matching program + from_year ───────────────────
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    console.log('[get-enrollment-periods] querying period for program:', resolvedProgramId, 'year:', yearId, 'date:', now);

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

    // ── 4. Fetch existing enrollment request status ───────────────────────────
    const requests = await supabase(
      `enrollment_requests` +
      `?student_id=eq.${encodeURIComponent(student_id)}` +
      `&period_id=eq.${encodeURIComponent(period.id)}` +
      `&limit=1`
    );
    const existingRequest  = requests && requests[0];
    const enrollmentStatus = existingRequest ? existingRequest.status : null;
    const toYear           = existingRequest ? existingRequest.to_year : null;

    // ── 5. Short-circuit: already promoted → hide the banner ─────────────────
    if (enrollmentStatus === 'promoted') {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, period: null })
      };
    }

    // ── 6. Run eligibility RPC ────────────────────────────────────────────────
    const eligibility = await supabase(
      `rpc/check_enrollment_eligibility`, {
        method: 'POST',
        body: JSON.stringify({
          p_student_id:         String(student_id),
          p_period_id:          String(period.id),
          p_skip_already_check: false
        })
      }
    );

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
