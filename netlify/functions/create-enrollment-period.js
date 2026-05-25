/**
 * create-enrollment-period.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin lambda — creates a new enrollment period for a program + year range.
 *
 * POST body:
 *   { program_id, from_year_id, to_year_id, open_at, close_at,
 *     min_pass_rate, require_core, auto_promote, notes, created_by }
 *
 * Changes from original:
 *   • Validates that program_id exists in degree_programs (now includes
 *     'diploma' and 'certificate' levels after the SQL migration).
 *   • Rejects overlapping open periods for the same program+year to prevent
 *     duplicate-period confusion.
 *   • Returns the created row plus the resolved program name for confirmation.
 */

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      program_id,
      from_year_id,
      to_year_id,
      open_at,
      close_at,
      min_pass_rate = 100,
      require_core  = true,
      auto_promote  = true,
      notes         = null,
      created_by    = null
    } = body;

    // ── Validate required fields ──────────────────────────────────────────────
    const missing = ['program_id','from_year_id','to_year_id','open_at','close_at']
      .filter(k => !body[k]);
    if (missing.length) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: false,
          message: `Missing required fields: ${missing.join(', ')}`
        })
      };
    }

    if (new Date(close_at) <= new Date(open_at)) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: false,
          message: 'close_at must be after open_at'
        })
      };
    }

    // ── Validate program exists (now includes diploma + certificate) ──────────
    const programs = await supabase(
      `degree_programs?id=eq.${encodeURIComponent(program_id)}&limit=1`
    );
    if (!programs || programs.length === 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: false,
          message: `Program '${program_id}' not found in degree_programs. ` +
                   `Check the id or run the SQL migration to add diploma/certificate levels.`
        })
      };
    }
    const program = programs[0];

    // ── Check for overlapping active period for same program+year ─────────────
    // Overlap: existing period's window intersects the new one.
    const overlapping = await supabase(
      `enrollment_periods` +
      `?program_id=eq.${encodeURIComponent(program_id)}` +
      `&from_year_id=eq.${encodeURIComponent(from_year_id)}` +
      `&open_at=lte.${encodeURIComponent(close_at)}` +
      `&close_at=gte.${encodeURIComponent(open_at)}` +
      `&limit=1`
    );
    if (overlapping && overlapping.length > 0) {
      const ex = overlapping[0];
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: false,
          message: `An overlapping enrollment period already exists for this program and year ` +
                   `(period id: ${ex.id}, open: ${ex.open_at} → ${ex.close_at}). ` +
                   `Close or delete it before creating a new one.`
        })
      };
    }

    // ── Create the period ─────────────────────────────────────────────────────
    const rows = await supabase(`enrollment_periods`, {
      method:  'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        program_id,
        from_year_id,
        to_year_id,
        open_at,
        close_at,
        min_pass_rate,
        require_core,
        auto_promote,
        notes,
        created_by
      })
    });

    const period = rows && rows[0];

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success:      true,
        period,
        program_name: program.name,
        program_level: program.level
      })
    };

  } catch (err) {
    console.error('[create-enrollment-period] error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
