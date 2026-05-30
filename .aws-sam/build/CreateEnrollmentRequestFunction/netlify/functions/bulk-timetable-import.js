// netlify/functions/bulk-timetable-import.js
// Bulk imports timetable entries from CSV data.
// - Uses logged-in admin's staff_id by default
// - Per-row staff_nickname overrides to another staff member
// - Inserts all rows with notify_students = false
// - After insert, sends ONE summary notification per affected student

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Auth: get calling admin's UUID ────────────────────────────
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  const adminId = user.id;

  // ── Parse body ────────────────────────────────────────────────
  let rows;
  try {
    const body = JSON.parse(event.body);
    rows = body.rows; // array of row objects parsed from CSV on frontend
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No rows provided' }) };
  }

  // ── Build nickname → user_id map for staff lookup ─────────────
  const nicknames = [...new Set(rows.map(r => r.staff_nickname).filter(Boolean))];
  const staffMap = {}; // nickname → uuid

  if (nicknames.length > 0) {
    const { data: staffRows } = await supabase
      .from('staff_profiles')
      .select('user_id, nickname')
      .in('nickname', nicknames);

    (staffRows || []).forEach(s => { staffMap[s.nickname] = s.user_id; });
  }

  // ── Validate & build insert rows ──────────────────────────────
  const insertRows = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Resolve staff_id
    let staffId = adminId;
    if (r.staff_nickname && r.staff_nickname.trim()) {
      const resolved = staffMap[r.staff_nickname.trim()];
      if (!resolved) {
        errors.push(`Row ${rowNum}: staff_nickname "${r.staff_nickname}" not found in staff_profiles`);
        continue;
      }
      staffId = resolved;
    }

    // Required fields
    if (!r.course_id)       { errors.push(`Row ${rowNum}: missing course_id`);       continue; }
    if (!r.session_date)    { errors.push(`Row ${rowNum}: missing session_date`);     continue; }
    if (!r.time_start)      { errors.push(`Row ${rowNum}: missing time_start`);       continue; }
    if (!r.time_end)        { errors.push(`Row ${rowNum}: missing time_end`);         continue; }
    if (!r.room_id)         { errors.push(`Row ${rowNum}: missing room_id`);          continue; }
    if (!r.day)             { errors.push(`Row ${rowNum}: missing day`);              continue; }

    insertRows.push({
      staff_id:         staffId,
      course_id:        r.course_id.trim(),
      course_name:      r.course_name?.trim() || null,
      session_date:     r.session_date.trim(),
      time_start:       r.time_start.trim(),
      time_end:         r.time_end.trim(),
      room_id:          r.room_id.trim(),
      day:              r.day.trim(),
      academic_year_id: r.academic_year_id?.trim() || null,
      sub_topic:        r.sub_topic?.trim() || null,
      notify_students:  false, // suppress per-row trigger
    });
  }

  if (errors.length > 0 && insertRows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All rows failed validation', details: errors }) };
  }

  // ── Bulk insert ───────────────────────────────────────────────
  const { error: insertErr } = await supabase
    .from('lecture_timetable')
    .insert(insertRows);

  if (insertErr) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Insert failed', details: insertErr.message }) };
  }

  // ── Send one summary notification per student per academic year ─
  // Group inserted rows by academic_year_id
  const yearGroups = {};
  for (const row of insertRows) {
    const key = row.academic_year_id || '__none__';
    if (!yearGroups[key]) yearGroups[key] = [];
    yearGroups[key].push(row);
  }

  for (const [yearId, yearRows] of Object.entries(yearGroups)) {
    if (yearId === '__none__') continue; // no academic year = no notification

    // Get academic year name
    const { data: ayData } = await supabase
      .from('academic_years')
      .select('name')
      .eq('id', yearId)
      .single();

    const yearName = ayData?.name || yearId;

    // Get unique course names for summary
    const courseNames = [...new Set(yearRows.map(r => r.course_name || r.course_id))];
    const sessionCount = yearRows.length;

    // Find students in this academic year
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('year', yearName)
      .eq('status', 'Active');

    if (!students || students.length === 0) continue;

    // Build summary message
    const courseList = courseNames.slice(0, 3).join(', ') +
      (courseNames.length > 3 ? ` and ${courseNames.length - 3} more` : '');

    const message = `${sessionCount} new timetable session${sessionCount > 1 ? 's' : ''} ` +
      `have been scheduled for ${yearName} — ${courseList}.`;

    // Insert one notification per student
    const notifications = students.map(s => ({
      student_id: s.id,
      type:       'timetable_added',
      title:      'New Timetable Sessions',
      message,
    }));

    await supabase.from('notifications').insert(notifications);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      inserted: insertRows.length,
      skipped: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
  };
};