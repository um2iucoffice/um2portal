// ══════════════════════════════════════
// Enrollment Periods & Requests
// ══════════════════════════════════════

// ══════════════════════════════════════════
// ENROLLMENT PERIODS & REQUESTS
// ══════════════════════════════════════════

// ── Helpers ───────────────────────────────
function epToggle(checkId, trackId) {
  const cb = document.getElementById(checkId);
  const track = document.getElementById(trackId);
  const knob = track.querySelector('span');
  const label = document.getElementById(checkId + 'Label');
  cb.checked = !cb.checked;
  if (cb.checked) {
    track.style.background = 'var(--green)';
    knob.style.transform = 'translateX(18px)';
    if (label) label.textContent = 'Yes';
  } else {
    track.style.background = 'var(--line)';
    knob.style.transform = 'translateX(0)';
    if (label) label.textContent = 'No';
  }
}

function epFmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function epStatus(period) {
  const now = new Date();
  const open  = new Date(period.open_at);
  const close = new Date(period.close_at);
  if (now < open)  return { label: 'Upcoming', cls: 'b-blue' };
  if (now > close) return { label: 'Closed',   cls: 'b-red' };
  return { label: 'Open', cls: 'b-green' };
}

// ── Enrollment Periods view ───────────────
function initEnrollPeriodsView() {
  // Populate program dropdown from degreePrograms array
  const prog = document.getElementById('ep-program');
  const cur = prog.value;
  prog.innerHTML = '<option value="">— select program —</option>';
  (degreePrograms || []).forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name || p.id;
    prog.appendChild(o);
  });
  if (cur) prog.value = cur;
  renderEpTable();
}

function loadEpYears() {
  const programId = document.getElementById('ep-program').value;
  const fromSel = document.getElementById('ep-fromYear');
  const toSel   = document.getElementById('ep-toYear');
  fromSel.innerHTML = '<option value="">— select year —</option>';
  toSel.innerHTML   = '<option value="">— select From Year first —</option>';
  if (!programId) return;
  const years = (academicYears || [])
    .filter(y => !y.program_id || y.program_id === programId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y.id;
    o.textContent = y.name || y.year_name || y.id;
    fromSel.appendChild(o);
  });
}

function populateEpToYear() {
  const programId  = document.getElementById('ep-program').value;
  const fromVal    = document.getElementById('ep-fromYear').value;
  const toSel      = document.getElementById('ep-toYear');
  toSel.innerHTML  = '<option value="">— select year —</option>';
  if (!fromVal) return;
  const years = (academicYears || [])
    .filter(y => !y.program_id || y.program_id === programId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const fromIdx = years.findIndex(y => y.id === fromVal);
  years.slice(fromIdx + 1).forEach(y => {
    const o = document.createElement('option');
    o.value = y.id;
    o.textContent = y.name || y.year_name || y.id;
    toSel.appendChild(o);
  });
  if (toSel.options.length === 2) toSel.selectedIndex = 1;
}

function resetEpForm() {
  document.getElementById('ep-program').value  = '';
  document.getElementById('ep-fromYear').innerHTML = '<option value="">— select program first —</option>';
  document.getElementById('ep-toYear').innerHTML   = '<option value="">— select From Year first —</option>';
  document.getElementById('ep-openAt').value  = '';
  document.getElementById('ep-closeAt').value = '';
  document.getElementById('ep-minPass').value = 80;
  document.getElementById('ep-minPassFill').style.width = '80%';
  document.getElementById('ep-minPassLabel').textContent = '80';
  document.getElementById('ep-minPassedCourses').value = 0;
  // Reset toggles: requireNoFailures defaults ON, others OFF
  ['ep-requireCore', 'ep-requireAllGraded', 'ep-autoPromote'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb && cb.checked) epToggle(id, id + 'Track');
  });
  // requireNoFailures defaults to ON — ensure it's on after reset
  const noFail = document.getElementById('ep-requireNoFailures');
  if (noFail && !noFail.checked) epToggle('ep-requireNoFailures', 'ep-requireNoFailuresTrack');
  const msg = document.getElementById('ep-msg');
  if (msg) msg.style.display = 'none';
}

async function saveEnrollmentPeriod() {
  const programId  = document.getElementById('ep-program').value;
  const fromYear   = document.getElementById('ep-fromYear').value;
  const toYear     = document.getElementById('ep-toYear').value;
  const openAt     = document.getElementById('ep-openAt').value;
  const closeAt    = document.getElementById('ep-closeAt').value;
  const minPass    = parseInt(document.getElementById('ep-minPass').value, 10);
  const reqCore    = document.getElementById('ep-requireCore').checked;
  const reqNoFail  = document.getElementById('ep-requireNoFailures').checked;
  const reqAllGraded = document.getElementById('ep-requireAllGraded').checked;
  const minPassedCourses = parseInt(document.getElementById('ep-minPassedCourses').value, 10) || 0;
  const autoPromote= document.getElementById('ep-autoPromote').checked;
  const msg        = document.getElementById('ep-msg');

  if (!programId || !fromYear || !toYear || !openAt || !closeAt) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Please fill in all required fields.';
    return;
  }
  if (new Date(openAt) >= new Date(closeAt)) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Close date must be after open date.';
    return;
  }

  const payload = {
    program_id:           programId,
    from_year_id:         fromYear,
    to_year_id:           toYear,
    open_at:              openAt,
    close_at:             closeAt,
    min_pass_rate:        minPass / 100,
    require_core:         reqCore,
    require_no_failures:  reqNoFail,
    require_all_graded:   reqAllGraded,
    min_passed_courses:   minPassedCourses,
    auto_promote:         autoPromote
  };

  try {
    const { data, error } = await db.from('enrollment_periods').insert(payload).select().single();
    if (error) throw error;
    toast('Enrollment period created.', '✅');
    resetEpForm();
    // Cache locally and re-render table
    window._enrollmentPeriods = window._enrollmentPeriods || [];
    window._enrollmentPeriods.push(data);
    renderEpTable();
    // Refresh period selector in requests view
    populateErPeriodSelect();
  } catch(e) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Error: ' + e.message;
  }
}

async function renderEpTable() {
  const tbody = document.getElementById('epTableBody');
  if (!tbody) return;

  // Fetch periods if not cached
  if (!window._enrollmentPeriods) {
    const { data } = await db.from('enrollment_periods').select('*').order('close_at', { ascending: false });
    window._enrollmentPeriods = data || [];
  }

  const periods = window._enrollmentPeriods;
  if (!periods.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--ink3);padding:24px">No periods yet</td></tr>';
    return;
  }

  const yearMap = {};
  (academicYears || []).forEach(y => { yearMap[y.id] = y.name || y.year_name || y.id; });
  const progMap = {};
  (degreePrograms || []).forEach(p => { progMap[p.id] = p.name || p.id; });

  tbody.innerHTML = periods.map(p => {
    const st = epStatus(p);
    return `<tr>
      <td>${progMap[p.program_id] || p.program_id}</td>
      <td>${yearMap[p.from_year_id] || p.from_year_id} → ${yearMap[p.to_year_id] || p.to_year_id}</td>
      <td>${epFmt(p.open_at)}</td>
      <td>${epFmt(p.close_at)}</td>
      <td>${Math.round((p.min_pass_rate || 0) * 100)}%</td>
      <td>${p.require_no_failures !== false ? '<span class="badge b-green">✓ Yes</span>' : '<span class="badge b-muted">—</span>'}</td>
      <td>${p.require_all_graded ? '<span class="badge b-blue">✓ Yes</span>' : '<span class="badge b-muted">—</span>'}</td>
      <td>${p.require_core ? '<span class="badge b-gold">✓ Yes</span>' : '<span class="badge b-muted">—</span>'}</td>
      <td>${p.min_passed_courses > 0 ? '<span class="badge b-blue">' + p.min_passed_courses + '</span>' : '<span class="badge b-muted">—</span>'}</td>
      <td>${p.auto_promote ? '✓' : '—'}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td style="white-space:nowrap;display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="editEnrollmentPeriod('${p.id}')">Edit</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--crimson);color:var(--crimson)" onclick="deleteEnrollmentPeriod('${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function deleteEnrollmentPeriod(id) {
  if (!confirm('Delete this enrollment period? This cannot be undone.')) return;
  const { error } = await db.from('enrollment_periods').delete().eq('id', id);
  if (error) { toast('Delete failed: ' + error.message, '❌'); return; }
  window._enrollmentPeriods = (window._enrollmentPeriods || []).filter(p => p.id !== id);
  renderEpTable();
  populateErPeriodSelect();
  toast('Period deleted.', '🗑');
}

// ── Enrollment Requests view ──────────────
async function initEnrollRequestsView() {
  await populateErPeriodSelect();
  const sel = document.getElementById('er-periodSelect');
  if (sel.options.length > 1) {
    sel.selectedIndex = 1;
    await loadEnrollRequests();
  }
}

async function populateErPeriodSelect() {
  if (!window._enrollmentPeriods) {
    const { data } = await db.from('enrollment_periods').select('*').order('close_at', { ascending: false });
    window._enrollmentPeriods = data || [];
  }
  const sel = document.getElementById('er-periodSelect');
  if (!sel) return;
  const cur = sel.value;
  const yearMap = {};
  (academicYears || []).forEach(y => { yearMap[y.id] = y.name || y.year_name || y.id; });
  const progMap = {};
  (degreePrograms || []).forEach(p => { progMap[p.id] = p.name || p.id; });
  sel.innerHTML = '<option value="">— select enrollment period —</option>';
  (window._enrollmentPeriods || []).forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${progMap[p.program_id] || p.program_id}: ${yearMap[p.from_year_id] || p.from_year_id} → ${yearMap[p.to_year_id] || p.to_year_id} (closes ${epFmt(p.close_at)})`;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

async function loadEnrollRequests() {
  const periodId = document.getElementById('er-periodSelect').value;
  const tbody    = document.getElementById('er-tableBody');
  const stats    = document.getElementById('er-stats');
  const statusEl = document.getElementById('er-periodStatus');
  const promBtn  = document.getElementById('promoteAllBtn');

  if (!periodId) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--ink3);padding:24px">Select an enrollment period above</td></tr>';
    if (stats) stats.style.display = 'none';
    if (statusEl) statusEl.textContent = '';
    if (promBtn) promBtn.disabled = true;
    return;
  }

  // Period metadata
  const period = (window._enrollmentPeriods || []).find(p => p.id === periodId);
  const isClosed = period && new Date() > new Date(period.close_at);
  if (statusEl) statusEl.textContent = isClosed ? '· Period closed' : `· Closes ${epFmt(period?.close_at)}`;
  if (promBtn) promBtn.disabled = !isClosed;

  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--ink3);padding:24px">Loading…</td></tr>';

  try {
    const { data: requests, error } = await db
      .from('enrollment_requests')
      .select('*, student:student_id(id, name_en, name_my, year, gpa), eligibility_snapshot')
      .eq('period_id', periodId)
      .order('requested_at', { ascending: true });
    if (error) throw error;

    if (!requests || !requests.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--ink3);padding:24px">No requests for this period</td></tr>';
      if (stats) stats.style.display = 'none';
      return;
    }

    // Stats
    const total    = requests.length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const pending  = requests.filter(r => r.status === 'requested').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const inelig   = requests.filter(r => r.status === 'ineligible').length;
    document.getElementById('er-statTotal').textContent     = total    + ' total';
    document.getElementById('er-statApproved').textContent  = approved + ' approved';
    document.getElementById('er-statPending').textContent   = pending  + ' pending';
    document.getElementById('er-statRejected').textContent  = rejected + ' rejected';
    document.getElementById('er-statIneligible').textContent= inelig   + ' ineligible';
    if (stats) stats.style.display = 'flex';

    const yearMap = {};
    (academicYears || []).forEach(y => { yearMap[y.id] = y.name || y.year_name || y.id; });

    tbody.innerHTML = requests.map(r => {
      const s    = r.student || {};
      const snap = r.eligibility_snapshot || {};
      const reasons = (snap.reasons || []);
      const reasonTip = reasons.length
        ? `<div style="font-size:11px;color:var(--crimson);margin-top:3px">${reasons.map(x => '· ' + x).join('<br>')}</div>`
        : '';
      const eligBadge = snap.eligible
        ? `<span class="badge b-green">Eligible</span>`
        : `<span class="badge b-red">Ineligible</span>${reasonTip}`;
      const statusBadge = {
        requested:  `<span class="badge b-gold">Pending</span>`,
        approved:   `<span class="badge b-green">Approved</span>`,
        rejected:   `<span class="badge b-red">Rejected</span>`,
        ineligible: `<span class="badge" style="background:var(--surface);border:1px solid var(--line);color:var(--ink3)">Ineligible</span>`,
        promoted:   `<span class="badge b-blue">Promoted</span>`
      }[r.status] || `<span class="badge">${r.status}</span>`;

      const canApprove = r.status !== 'approved' && r.status !== 'promoted';
      const canReject  = r.status !== 'rejected'  && r.status !== 'promoted';
      const isInelig   = !snap.eligible;

      const displayName = s.name_en || '—';
      const displayYear = yearMap[s.year] || s.year || '—';
      return `<tr>
        <td style="font-weight:600">${displayName}${s.name_my ? `<br><span style="font-size:11px;color:var(--ink3)">${s.name_my}</span>` : ''}</td>
        <td style="font-family:monospace;font-size:12px">${s.id || r.student_id}</td>
        <td>${displayYear}</td>
        <td>${s.gpa != null ? Number(s.gpa).toFixed(2) : '—'}</td>
        <td>${snap.pass_rate != null ? snap.pass_rate + '%' : '—'}</td>
        <td>${snap.core_total != null
              ? (snap.core_total === 0
                  ? '<span style="color:var(--ink3)">N/A</span>'
                  : snap.core_passed + '/' + snap.core_total
                    + (snap.core_passed >= snap.core_total
                        ? ' <span style="color:var(--green)">✓</span>'
                        : ' <span style="color:var(--crimson)">✗</span>'))
              : '—'}</td>
        <td>${eligBadge}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">
          ${canApprove && !isInelig ? `<button class="btn btn-outline btn-sm" style="margin-right:4px" onclick="actionEnrollRequest('${r.id}','approved')">Approve</button>` : ''}
          ${canApprove && isInelig  ? `<button class="btn btn-outline btn-sm" style="margin-right:4px;border-color:var(--gold);color:var(--gold)" onclick="openOverrideModal('${r.id}','${displayName.replace(/'/g,"\\'")}')" >Override</button>` : ''}
          ${canReject  ? `<button class="btn btn-outline btn-sm" style="border-color:var(--crimson);color:var(--crimson)" onclick="actionEnrollRequest('${r.id}','rejected')">Reject</button>` : ''}
        </td>
      </tr>`;
    }).join('');

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--crimson);padding:24px">Error: ${e.message}</td></tr>`;
  }
}

async function actionEnrollRequest(requestId, newStatus) {
  try {
    const res  = await fetch('/.netlify/functions/submit-enrollment-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        request_id:  requestId,
        action:      newStatus === 'approved' ? 'approve' : 'reject',
        reviewed_by: window._adminUserId || null
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Unknown error');
    toast(newStatus === 'approved' ? 'Request approved — student year updated.' : 'Request rejected.', newStatus === 'approved' ? '✅' : '🚫');
    loadEnrollRequests();
  } catch(e) {
    toast('Update failed: ' + e.message, '❌');
  }
}

// Override modal
let _overrideRequestId = null;
function openOverrideModal(requestId, studentName) {
  _overrideRequestId = requestId;
  document.getElementById('overrideStudentName').textContent = studentName;
  document.getElementById('overrideReason').value = '';
  document.getElementById('overrideModal').style.display = 'flex';
}
function closeOverrideModal() {
  document.getElementById('overrideModal').style.display = 'none';
  _overrideRequestId = null;
}
async function confirmOverride() {
  const reason = document.getElementById('overrideReason').value.trim();
  if (!reason) { toast('Please enter an override reason.', '⚠️'); return; }
  try {
    const res  = await fetch('/.netlify/functions/submit-enrollment-request', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        request_id:      _overrideRequestId,
        action:          'override',
        reviewed_by:     window._adminUserId || null,
        override_reason: reason
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Unknown error');
    closeOverrideModal();
    toast('Override approved — student year updated.', '✅');
    loadEnrollRequests();
  } catch(e) {
    toast('Override failed: ' + e.message, '❌');
  }
}

// Promote All Approved
async function promoteAllApproved() {
  const periodId = document.getElementById('er-periodSelect').value;
  if (!periodId) return;
  const period = (window._enrollmentPeriods || []).find(p => p.id === periodId);
  if (!period) return;

  if (!confirm('Promote all approved students to the next year? This will update their enrollment records.')) return;

  const btn = document.getElementById('promoteAllBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/.netlify/functions/promote-enrolled-students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    toast(`Promoted ${data.promoted || 0} student(s) to next year.`, '🎓');
    // Invalidate cache and reload
    window._enrollmentPeriods = null;
    loadEnrollRequests();
  } catch(e) {
    toast('Promotion failed: ' + e.message, '❌');
    if (btn) btn.disabled = false;
  }
}

// ── Edit Enrollment Period ────────────────
function editEnrollmentPeriod(id) {
  const p = (window._enrollmentPeriods || []).find(x => x.id === id);
  if (!p) { toast('Period not found.', '❌'); return; }

  // Store editing id
  document.getElementById('epEditId').value = id;

  // Populate program dropdown
  const progSel = document.getElementById('epEdit-program');
  progSel.innerHTML = '<option value="">— select program —</option>';
  (degreePrograms || []).forEach(dp => {
    const o = document.createElement('option');
    o.value = dp.id;
    o.textContent = dp.name || dp.id;
    if (dp.id === p.program_id) o.selected = true;
    progSel.appendChild(o);
  });

  // Populate from/to year dropdowns
  _epEditLoadYears(p.program_id, p.from_year_id, p.to_year_id);

  // Dates
  document.getElementById('epEdit-openAt').value  = p.open_at  ? p.open_at.slice(0,10)  : '';
  document.getElementById('epEdit-closeAt').value = p.close_at ? p.close_at.slice(0,10) : '';

  // Min pass rate slider
  const pct = Math.round((p.min_pass_rate || 0) * 100);
  document.getElementById('epEdit-minPass').value = pct;
  document.getElementById('epEdit-minPassLabel').textContent = pct;
  document.getElementById('epEdit-minPassFill').style.width = pct + '%';

  // Min passed courses
  document.getElementById('epEdit-minPassedCourses').value = p.min_passed_courses || 0;

  // Toggles — set each to match DB value
  _epEditSetToggle('epEdit-requireNoFailures', 'epEdit-requireNoFailuresTrack', 'epEdit-requireNoFailuresLabel', p.require_no_failures !== false);
  _epEditSetToggle('epEdit-requireAllGraded',  'epEdit-requireAllGradedTrack',  'epEdit-requireAllGradedLabel',  !!p.require_all_graded);
  _epEditSetToggle('epEdit-requireCore',       'epEdit-requireCoreTrack',       'epEdit-requireCoreLabel',       !!p.require_core);
  _epEditSetToggle('epEdit-autoPromote',       'epEdit-autoPromoteTrack',       'epEdit-autoPromoteLabel',       !!p.auto_promote);

  document.getElementById('epEditMsg').style.display = 'none';
  document.getElementById('epEditModal').classList.add('open');
}

function _epEditSetToggle(cbId, trackId, labelId, value) {
  const cb    = document.getElementById(cbId);
  const track = document.getElementById(trackId);
  const label = document.getElementById(labelId);
  const knob  = track ? track.querySelector('span') : null;
  if (!cb) return;
  cb.checked = value;
  if (track) track.style.background = value ? 'var(--crimson)' : 'var(--line)';
  if (knob)  knob.style.transform   = value ? 'translateX(18px)' : 'translateX(0)';
  if (label) label.textContent      = value ? 'Yes' : 'No';
}

function _epEditLoadYears(programId, fromVal, toVal) {
  const fromSel = document.getElementById('epEdit-fromYear');
  const toSel   = document.getElementById('epEdit-toYear');
  const years   = (academicYears || [])
    .filter(y => !y.program_id || y.program_id === programId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  fromSel.innerHTML = '<option value="">— select year —</option>';
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y.id;
    o.textContent = y.name || y.year_name || y.id;
    if (y.id === fromVal) o.selected = true;
    fromSel.appendChild(o);
  });

  toSel.innerHTML = '<option value="">— select year —</option>';
  const fromIdx = years.findIndex(y => y.id === fromVal);
  years.slice(fromIdx + 1).forEach(y => {
    const o = document.createElement('option');
    o.value = y.id;
    o.textContent = y.name || y.year_name || y.id;
    if (y.id === toVal) o.selected = true;
    toSel.appendChild(o);
  });
}

function epEditLoadYears() {
  const programId = document.getElementById('epEdit-program').value;
  const fromSel   = document.getElementById('epEdit-fromYear');
  const curFrom   = fromSel.value;
  _epEditLoadYears(programId, curFrom, '');
}

function epEditPopulateToYear() {
  const programId = document.getElementById('epEdit-program').value;
  const fromVal   = document.getElementById('epEdit-fromYear').value;
  const toSel     = document.getElementById('epEdit-toYear');
  toSel.innerHTML = '<option value="">— select year —</option>';
  if (!fromVal) return;
  const years = (academicYears || [])
    .filter(y => !y.program_id || y.program_id === programId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const fromIdx = years.findIndex(y => y.id === fromVal);
  years.slice(fromIdx + 1).forEach(y => {
    const o = document.createElement('option');
    o.value = y.id;
    o.textContent = y.name || y.year_name || y.id;
    toSel.appendChild(o);
  });
  if (toSel.options.length === 2) toSel.selectedIndex = 1;
}

async function saveEditEnrollmentPeriod() {
  const id         = document.getElementById('epEditId').value;
  const programId  = document.getElementById('epEdit-program').value;
  const fromYear   = document.getElementById('epEdit-fromYear').value;
  const toYear     = document.getElementById('epEdit-toYear').value;
  const openAt     = document.getElementById('epEdit-openAt').value;
  const closeAt    = document.getElementById('epEdit-closeAt').value;
  const minPass    = parseInt(document.getElementById('epEdit-minPass').value, 10);
  const reqNoFail  = document.getElementById('epEdit-requireNoFailures').checked;
  const reqAllGraded = document.getElementById('epEdit-requireAllGraded').checked;
  const reqCore    = document.getElementById('epEdit-requireCore').checked;
  const minPassedCourses = parseInt(document.getElementById('epEdit-minPassedCourses').value, 10) || 0;
  const autoPromote= document.getElementById('epEdit-autoPromote').checked;
  const msg        = document.getElementById('epEditMsg');

  if (!programId || !fromYear || !toYear || !openAt || !closeAt) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Please fill in all required fields.';
    return;
  }
  if (new Date(openAt) >= new Date(closeAt)) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Close date must be after open date.';
    return;
  }

  const payload = {
    program_id:           programId,
    from_year_id:         fromYear,
    to_year_id:           toYear,
    open_at:              openAt,
    close_at:             closeAt,
    min_pass_rate:        minPass / 100,
    require_no_failures:  reqNoFail,
    require_all_graded:   reqAllGraded,
    require_core:         reqCore,
    min_passed_courses:   minPassedCourses,
    auto_promote:         autoPromote
  };

  const btn = document.getElementById('epEditSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const { data, error } = await db.from('enrollment_periods').update(payload).eq('id', id).select().single();
    if (error) throw error;

    // Update local cache
    const idx = (window._enrollmentPeriods || []).findIndex(p => p.id === id);
    if (idx >= 0) window._enrollmentPeriods[idx] = data;

    closeModal('epEditModal');
    toast('Enrollment period updated.', '✅');
    renderEpTable();
    populateErPeriodSelect();
  } catch(e) {
    msg.style.cssText = 'display:block;color:var(--crimson);font-size:13px;margin-top:12px';
    msg.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// ══ END ENROLLMENT PERIODS & REQUESTS ══
