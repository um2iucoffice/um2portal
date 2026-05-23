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

// POST { request_id, action, reviewed_by, override_reason, notes }
// action: 'approve' | 'reject' | 'override'
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { request_id, action, reviewed_by,
            override_reason, notes } = JSON.parse(event.body || '{}');

    const isApproval = action === 'approve' || action === 'override';
    const status     = isApproval ? 'promoted' : 'rejected';
    const now        = new Date().toISOString();

    // 1. Fetch the enrollment request to get student_id + to_year
    const rows = await supabase(
      `enrollment_requests?id=eq.${request_id}&limit=1`,
      { method: 'GET' }
    );
    const request = rows && rows[0];
    if (!request) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: false, message: 'Request not found' })
      };
    }

    // 2. Update enrollment_request → promoted (or rejected)
    await supabase(
      `enrollment_requests?id=eq.${request_id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          status,
          reviewed_by,
          reviewed_at:          now,
          promoted_at:          isApproval ? now : null,
          eligibility_override: action === 'override',
          override_reason:      override_reason || null,
          notes:                notes || null
        })
      }
    );

    // 3. If approving, update the student's year immediately
    if (isApproval && request.student_id && request.to_year) {
      await supabase(
        `students?id=eq.${request.student_id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            year:       request.to_year,
            updated_at: now
          })
        }
      );
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, status })
    };

  } catch (err) {
    console.error('review-enrollment-request error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: false, message: err.message })
    };
  }
};
