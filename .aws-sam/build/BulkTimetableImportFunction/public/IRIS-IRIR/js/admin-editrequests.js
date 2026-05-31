// ══════════════════════════════════════
// Edit Requests (Student Info Change Approval)
// ══════════════════════════════════════

// ══════════════════════════════════════════
// EDIT REQUESTS (student info change approval)
// ══════════════════════════════════════════
// Table: student_edit_requests
// Required SQL (run once in Supabase SQL Editor):
// create table if not exists student_edit_requests (
//   id           uuid primary key default gen_random_uuid(),
//   student_id   text references students(id) on delete cascade,
//   field_name   text not null,
//   old_value    text,
//   new_value    text,
//   reason       text,
//   status       text not null default 'pending',
//   submitted_at timestamptz not null default now(),
//   reviewed_at  timestamptz,
//   reviewed_by  text,
//   note         text
// );

let editRequests = [];

const ER_FIELD_LABELS = {
  father:    "Father's Name (English)",
  father_my: "Father's Name (Myanmar)",
  mother:    "Mother's Name (English)",
  mother_my: "Mother's Name (Myanmar)",
  photo:     "Profile Photo"
};

async function loadEditRequests() {
  try {
    const { data, error } = await db
      .from('student_edit_requests')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) { toast('Failed to load edit requests: ' + error.message, '⚠'); return; }
    editRequests = data || [];
    renderEditRequestsTable();
    updateEditRequestsBadge();
  } catch(e) {
    toast('Error loading edit requests: ' + e.message, '⚠');
  }
}

function updateEditRequestsBadge() {
  const pending = editRequests.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('editRequestsBadge');
  const navBadge = badge;
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? '' : 'none';
  }
}

function renderEditRequestsTable() {
  const statusFilter = (document.getElementById('erStatusFilter')?.value ?? '').toLowerCase();
  const searchVal    = (document.getElementById('erSearchInput')?.value  || '').toLowerCase();
  const tbody        = document.getElementById('editRequestsBody');
  if (!tbody) return;

  let filtered = editRequests;
  if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
  if (searchVal) {
    filtered = filtered.filter(r =>
      (r.student_id || '').toLowerCase().includes(searchVal) ||
      (students.find(s => s.id === r.student_id)?.name_en || '').toLowerCase().includes(searchVal)
    );
  }

  const pending = editRequests.filter(r => r.status === 'pending').length;
  const countEl = document.getElementById('erPendingCount');
  if (countEl) countEl.textContent = pending > 0 ? pending + ' pending' : '';

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--ink3);padding:32px">No ${statusFilter || ''} requests found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const student = students.find(s => s.id === r.student_id);
    const sName   = student ? student.name_en : '—';
    const fieldLbl = ER_FIELD_LABELS[r.field_name] || r.field_name;
    const statusBadge = r.status === 'approved'
      ? '<span class="badge b-green">✓ Approved</span>'
      : r.status === 'rejected'
      ? '<span class="badge b-red">✗ Rejected</span>'
      : '<span class="badge b-gold">⏳ Pending</span>';
    const isMM = r.field_name === 'father_my' || r.field_name === 'mother_my';
    const mmStyle = isMM ? 'font-family:"Pyidaungsu","Noto Sans Myanmar","Myanmar Text",sans-serif' : '';
    const actions = r.status === 'pending' && currentRole === 'registrar'
      ? `<button class="btn btn-success btn-sm" onclick="openErReviewModal('${r.id}')">Review</button>`
      : `<span style="color:var(--ink3);font-size:12px">${r.reviewed_at ? r.reviewed_at.slice(0,10) : '—'}</span>`;

    return `<tr>
      <td class="text-mono text-crimson">${r.student_id}</td>
      <td>${sName}</td>
      <td>${fieldLbl}</td>
      <td style="color:var(--ink3);${mmStyle}">${r.old_value || '—'}</td>
      <td style="font-weight:600;${mmStyle}">${r.new_value || '—'}</td>
      <td style="font-style:italic;color:var(--ink3);max-width:180px;white-space:normal">${r.reason || '—'}</td>
      <td class="text-mono">${r.submitted_at ? r.submitted_at.slice(0,10) : '—'}</td>
      <td>${statusBadge}</td>
      <td class="registrar-only">${actions}</td>
    </tr>`;
  }).join('');
}

function openErReviewModal(reqId) {
  const r = editRequests.find(x => x.id === reqId);
  if (!r) return;
  const student = students.find(s => s.id === r.student_id);
  const isMM = r.field_name === 'father_my' || r.field_name === 'mother_my';
  const mmFont = isMM ? '"Pyidaungsu","Noto Sans Myanmar","Myanmar Text",sans-serif' : '"DM Sans",sans-serif';

  document.getElementById('erReviewId').value         = r.id;
  document.getElementById('erReviewStudentId').value  = r.student_id;
  document.getElementById('erReviewField').value      = r.field_name;
  document.getElementById('erReviewNewValue').value   = r.new_value || '';
  document.getElementById('erReviewPhotoUrl').value   = r.photo_url  || '';

  document.getElementById('erReviewStudentName').textContent      = student ? student.name_en : '—';
  document.getElementById('erReviewStudentIdDisplay').textContent = r.student_id;
  document.getElementById('erReviewFieldLabel').textContent       = ER_FIELD_LABELS[r.field_name] || r.field_name;
  document.getElementById('erReviewReason').textContent           = r.reason || '—';

  const oldEl = document.getElementById('erReviewOldValue');
  oldEl.textContent  = r.old_value || '—';
  oldEl.style.fontFamily = mmFont;

  const newEl = document.getElementById('erReviewNewValueDisplay');
  newEl.textContent  = r.new_value || '—';
  newEl.style.fontFamily = mmFont;

  document.getElementById('erReviewNote').value = '';

  // Photo preview — show only for photo requests
  const photoWrap = document.getElementById('erPhotoPreviewWrap');
  const currentPhotoWrap = document.getElementById('erCurrentPhotoWrap');
  const pendingPhotoWrap = document.getElementById('erPendingPhotoWrap');
  if (r.field_name === 'photo') {
    photoWrap.style.display = '';
    // Current photo (from students table — stored as relative path, build full URL)
    const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/student-photos/`;
    const rawCurrentPhoto = student ? (student.photo || null) : null;
    // Handle both relative paths and accidentally-stored full URLs
    const currentPhotoUrl = rawCurrentPhoto
      ? (rawCurrentPhoto.startsWith('http') ? rawCurrentPhoto : STORAGE_BASE + rawCurrentPhoto)
      : null;
    currentPhotoWrap.innerHTML = currentPhotoUrl
      ? `<img src="${currentPhotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;pointer-events:none" draggable="false" oncontextmenu="return false" onerror="this.parentElement.innerHTML='<span style=\'font-size:11px;color:var(--ink3)\'>No photo</span>'">`
      : '<svg width="36" height="42" viewBox="0 0 56 64" fill="none"><ellipse cx="28" cy="20" rx="13" ry="14" fill="#D1D5DB"/><path d="M2 58c0-13.255 11.64-24 26-24s26 10.745 26 24" fill="#D1D5DB"/></svg>';
    // Pending photo (from photo_url column)
    pendingPhotoWrap.innerHTML = r.photo_url
     ? `<img src="${r.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;pointer-events:none;user-select:none;-webkit-user-select:none" draggable="false" oncontextmenu="return false" onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:var(--ink3)\\'>Failed to load</span>'">`
      : '<span style="font-size:11px;color:var(--ink3)">No URL</span>';
    // Hide the text value rows since they're not meaningful for photos
    document.getElementById('erReviewOldValue').closest('div').style.display = 'none';
    document.getElementById('erReviewNewValueDisplay').closest('div').style.display = 'none';
  } else {
    photoWrap.style.display = 'none';
    document.getElementById('erReviewOldValue').closest('div').style.display = '';
    document.getElementById('erReviewNewValueDisplay').closest('div').style.display = '';
  }

  document.getElementById('erReviewModal').classList.add('open');
}

async function processEditRequest(decision) {
  const reqId     = document.getElementById('erReviewId').value;
  const studentId = document.getElementById('erReviewStudentId').value;
  const fieldName = document.getElementById('erReviewField').value;
  const newValue  = document.getElementById('erReviewNewValue').value;
  const photoUrl  = document.getElementById('erReviewPhotoUrl').value;
  const note      = (document.getElementById('erReviewNote').value || '').trim();

  const reviewedAt = new Date().toISOString();
  const reviewedBy = currentUser?.staff_id || currentUser?.email || 'Secretariat';

  try {
    // 1. Update the request record
    const { error: rErr } = await db
      .from('student_edit_requests')
      .update({ status: decision, reviewed_at: reviewedAt, reviewed_by: reviewedBy, note: note || null })
      .eq('id', reqId);

    if (rErr) throw rErr;

    // 2. Apply change to student record ONLY on approval — never on rejection
    if (decision === 'approved') {
      if (fieldName === 'photo') {
        if (!photoUrl) throw new Error('No photo URL stored for this request.');

        // Call approve-photo to watermark and move to permanent storage
        let wmRes;
        try {
          wmRes = await fetch('https://4dgx435mmk.execute-api.ap-southeast-1.amazonaws.com/approve-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, pendingUrl: photoUrl })
          });
        } catch (fetchErr) {
          throw new Error('Could not reach approve-photo function. Is it deployed? (' + fetchErr.message + ')');
        }
        if (!wmRes.ok) throw new Error('approve-photo returned HTTP ' + wmRes.status);
        const wmData = await wmRes.json();
        if (!wmData.success) throw new Error('approve-photo error: ' + wmData.message);

        // Store the RELATIVE path in-memory (same format as DB).
        // approve-photo returns the full URL; strip the storage prefix.
        const STORAGE_PFX = `${SUPABASE_URL}/storage/v1/object/public/student-photos/`;
        let storedPath = wmData.photoUrl || '';
        if (storedPath.startsWith(STORAGE_PFX)) storedPath = storedPath.slice(STORAGE_PFX.length);

        const s = students.find(x => x.id === studentId);
if (s) s.photo = storedPath;

const { error: photoDbErr } = await db
  .from('students')
  .update({ photo: storedPath, updated_at: reviewedAt })
  .eq('id', studentId);
if (photoDbErr) throw new Error('Photo DB update failed: ' + photoDbErr.message);

        const student = students.find(x => x.id === studentId);
        if (student) {
          await logEmail(student.email, studentId, '[UM2] Your profile photo has been updated', 'Photo edit request approved');
        }
      } else {
        const DB_COLUMN = {
          father:    'father',
          father_my: 'father_my',
          mother:    'mother',
          mother_my: 'mother_my'
        };
        const col = DB_COLUMN[fieldName];
        if (col) {
          const updateData = { [col]: newValue, updated_at: reviewedAt };
          const { error: uErr } = await db.from('students').update(updateData).eq('id', studentId);
          if (uErr) throw uErr;

          // Update in-memory students array
          const s = students.find(x => x.id === studentId);
          if (s) s[col] = newValue;

          // Log email notification
          const student = students.find(x => x.id === studentId);
          if (student) {
            await logEmail(student.email, studentId, '[UM2] Your profile information has been updated', 'Edit request approved');
          }
        }
      }
    }
    // decision === 'rejected': no student record changes, request row already updated above

    // Update in-memory requests
    const req = editRequests.find(x => x.id === reqId);
    if (req) {
      req.status      = decision;
      req.reviewed_at = reviewedAt;
      req.reviewed_by = reviewedBy;
      req.note        = note || null;
    }

    renderEditRequestsTable();
    renderStudentTable(students);
    updateEditRequestsBadge();
    closeModal('erReviewModal');

    const label = decision === 'approved' ? '✅ Approved & applied' : '✗ Rejected';
    toast(`${label} — ${ER_FIELD_LABELS[fieldName] || fieldName} for ${studentId}`, '✓');

    // If the student profile is currently open, refresh it
    if (currentProfileId === studentId) showProfile(studentId);

  } catch(e) {
    toast('Error processing request: ' + e.message, '❌');
  }
}

// ── Bulk Gender Update ──
let _bulkGenderTargets = [];

function openBulkGenderModal() {
  const checked = Array.from(document.querySelectorAll('#studentTableBody .stu-cb:checked'));
  const usingSelection = checked.length > 0;
  if (usingSelection) {
    _bulkGenderTargets = checked.map(cb => cb.dataset.id);
  } else {
    const rows = document.querySelectorAll('#studentTableBody tr[id^="stu-row-"]');
    _bulkGenderTargets = Array.from(rows).map(r => r.id.replace('stu-row-', ''));
  }
  if (!_bulkGenderTargets.length) { toast('No students visible in the table to update.', '⚠'); return; }

  // Update modal text and button label to reflect mode
  const countEl = document.getElementById('bulkGenderCount');
  const modeEl  = document.getElementById('bulkGenderMode');
  const btnEl   = document.getElementById('bulkGenderApplyBtn');
  if (countEl) countEl.textContent = _bulkGenderTargets.length;
  if (modeEl)  modeEl.textContent  = usingSelection
    ? `${_bulkGenderTargets.length} selected student${_bulkGenderTargets.length !== 1 ? 's' : ''}`
    : `all ${_bulkGenderTargets.length} visible student${_bulkGenderTargets.length !== 1 ? 's' : ''}`;
  if (btnEl)   btnEl.textContent   = usingSelection ? 'Apply to Selected' : 'Apply to All Listed';

  document.getElementById('bulkGenderModal').classList.add('open');
}

async function submitBulkGender() {
  const gender = document.getElementById('bulkGenderValue').value;
  if (!gender || !_bulkGenderTargets.length) return;
  closeModal('bulkGenderModal');
  const label = gender.charAt(0).toUpperCase() + gender.slice(1);
  toast(`Updating ${_bulkGenderTargets.length} students to ${label}…`, '⏳');
  const CHUNK = 100;
  let okCount = 0, errCount = 0;
  for (let i = 0; i < _bulkGenderTargets.length; i += CHUNK) {
    const chunk = _bulkGenderTargets.slice(i, i + CHUNK);
    const { error } = await db.from('students').update({ gender }).in('id', chunk);
    if (error) { errCount += chunk.length; }
    else {
      chunk.forEach(id => { const s = students.find(x => x.id === id); if (s) s.gender = gender; });
      okCount += chunk.length;
    }
  }
  renderStudentTable(students);
  toast(`✓ ${okCount} student${okCount !== 1 ? 's' : ''} set to ${label}${errCount ? ' · ' + errCount + ' failed' : ''}.`, '✓');
}

// ── Refresh Grade Preview ──
function refreshGradePreview() {
  if (!gradeCSVRows || !gradeCSVRows.length) { toast('No CSV loaded yet.', '⚠'); return; }
  const fallbackAttempt = document.getElementById('grade-attempt').value;
  const fallbackYear    = (document.getElementById('grade-year').value || '').trim();
  const preview = document.getElementById('csvPreviewTable');
  let validCount = 0, errorCount = 0;
  let body = '<tbody>';
  gradeCSVRows.forEach((row, idx) => {
    const score      = parseFloat(row.NumericScore || row.numericscore || row.numeric_score || 0);
    const { gp, letter } = computeGradePoint(score);
    const sid        = (row.StudentID || row.studentid || row.student_id || '').trim();
    const cid        = (row.CourseID  || row.courseid  || row.course_id  || '').trim();
    const rowAttempt = (row.Attempt   || row.attempt   || '').trim() || fallbackAttempt;
    const rowYear    = (row.Year      || row.year      || '').trim() || fallbackYear || '—';
    const gid        = stableGradeId(sid, cid, rowAttempt, rowYear);
    const studentMatch = students.find(s => s.id.toLowerCase() === sid.toLowerCase());
    const courseMatch  = courses.find(c => c[0].toLowerCase() === cid.toLowerCase());
    const stuStatus = studentMatch
      ? '<span class="badge b-green">✓ Valid</span>'
      : '<span class="badge b-red">✗ Student not found</span>';
    const crsWarn = cid && !courseMatch
      ? ' <span class="badge b-gold" title="Course not in catalogue — grade will still save">⚠ Course unknown</span>'
      : '';
    if (studentMatch) validCount++; else errorCount++;
    body += `<tr class="${studentMatch ? '' : 'bulk-row-err'}">
      <td style="color:var(--ink3);font-size:11px">${idx+1}</td>
      <td class="text-mono">${sid||'<span class="text-crimson">(blank)</span>'}</td>
      <td class="text-mono">${cid||'—'}</td>
      <td>${score}</td>
      <td><span class="badge b-blue">${rowAttempt}</span></td>
      <td class="text-mono" style="font-size:11px;color:var(--ink3)">${rowYear}</td>
      <td class="text-mono text-crimson" style="font-size:11px">${'GRD-' + gid}</td>
      <td><span class="badge ${gradeBadgeClass(letter)}">${formatGradeLetter(letter)}</span></td>
      <td><strong class="text-green">${gp.toFixed(1)}</strong></td>
      <td>${stuStatus}${crsWarn}</td>
    </tr>`;
  });
  body += '</tbody>';
  preview.innerHTML = `<thead><tr>
    <th>#</th><th>Student ID</th><th>Course ID</th><th>Score</th>
    <th>Attempt</th><th>Year</th><th>Grade ID (auto)</th><th>Letter</th><th>GP</th><th>Status</th>
  </tr></thead>` + body;
  document.getElementById('gradePreviewCount').textContent = gradeCSVRows.length;
  const okBadge  = document.getElementById('gradePreviewOk');
  const errBadge = document.getElementById('gradePreviewErr');
  if (okBadge)  okBadge.textContent  = validCount  + ' ready';
  if (errBadge) errBadge.textContent = errorCount + ' errors';
  toast('Preview refreshed with current Year & Attempt.', '✓');
}

// ── Student checkbox helpers ──
function onStudentCheckChange() {
  const all  = document.querySelectorAll('#studentTableBody .stu-cb');
  const checked = document.querySelectorAll('#studentTableBody .stu-cb:checked');
  const count = checked.length;
  const selCount = document.getElementById('stuSelCount');
  if (selCount) {
    selCount.style.display = count > 0 ? '' : 'none';
    selCount.textContent   = count + ' selected';
  }
  // Sync select-all header checkbox state
  const allCb = document.getElementById('selectAllStudents');
  if (allCb) {
    allCb.checked       = count > 0 && count === all.length;
    allCb.indeterminate = count > 0 && count < all.length;
  }
  // Sync group checkboxes
  document.querySelectorAll('.stu-group-cb').forEach(gcb => {
    const group = gcb.dataset.group;
    const groupCbs = document.querySelectorAll(`.stu-cb[data-group="${group}"]`);
    // group cbs don't have data-group — use the rows' gender via id lookup
    // Just check if all in this section are checked via the section rows
  });
}

function toggleSelectAllStudents(masterCb) {
  const all = document.querySelectorAll('#studentTableBody .stu-cb');
  all.forEach(cb => { cb.checked = masterCb.checked; });
  // Sync group checkboxes too
  document.querySelectorAll('.stu-group-cb').forEach(gcb => { gcb.checked = masterCb.checked; });
  onStudentCheckChange();
}

function toggleSelectGroup(groupCb, groupKey) {
  // Find all rows belonging to this group by traversing siblings after the header row
  const headerRow = groupCb.closest('tr');
  let row = headerRow.nextElementSibling;
  while (row && row.querySelector('.stu-group-cb') === null) {
    const cb = row.querySelector('.stu-cb');
    if (cb) cb.checked = groupCb.checked;
    row = row.nextElementSibling;
  }
  onStudentCheckChange();
}

