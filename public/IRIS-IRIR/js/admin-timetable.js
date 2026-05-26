// ══════════════════════════════════════
// Academic Years, Booked Schedule, Staff Profile, Timetable
// ══════════════════════════════════════

// ══════════════════════════════════════════
// USER LIST — load from profiles + staff_profiles
// ══════════════════════════════════════════
async function loadUserList() {
  const tbody = document.getElementById('userListBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--ink3);padding:24px">Loading…</td></tr>';
  let profRes, spRes;
  try { profRes = await db.from('profiles').select('*').order('created_at'); } catch(e) { profRes = { data: [], error: e }; }
  try { spRes   = await db.from('staff_profiles').select('user_id,department,title,published'); } catch(e) { spRes = { data: [], error: e }; }
  const profiles   = profRes.data || [];
  const staffProfs = spRes.data   || [];
  if (!profiles.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--ink3);padding:24px">No users found or insufficient permissions.</td></tr>';
    return;
  }
  const spMap = {};
  staffProfs.forEach(s => { spMap[s.user_id] = s; });
  tbody.innerHTML = profiles.map(p => {
    const sp = spMap[p.id] || {};
    const roleBadge = p.role === 'registrar'
      ? `<span class="badge" style="background:var(--crimson-light);color:var(--crimson);border:1px solid rgba(139,26,46,.2)">Secretariat</span>`
      : `<span class="badge b-blue">Faculty</span>`;
    const published = sp.published
      ? `<span class="badge b-green">Published</span>`
      : `<span class="badge b-muted">Private</span>`;
    const created = p.created_at ? p.created_at.slice(0,10) : '—';
    const shortId = p.id ? p.id.slice(0,8) + '…' : '—';
    return `<tr>
      <td class="text-mono text-crimson">${p.staff_id || '—'}</td>
      <td><strong>${p.full_name || '—'}</strong></td>
      <td>${roleBadge}</td>
      <td class="text-mono" style="font-size:11px;color:var(--ink3)" title="${p.id}">${shortId}</td>
      <td>${sp.department || '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${sp.title      || '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${published}</td>
      <td style="color:var(--ink3);font-size:12px">${created}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// ACADEMIC YEARS — load into timetable modal
// ══════════════════════════════════════════
let _academicYears = [];
async function loadAcademicYearsForModal() {
  if (_academicYears.length) return; // cached
  let res;
  try { res = await db.from('academic_years').select('id,name').order('sort_order'); } catch(e) { res = { data: [] }; }
  _academicYears = res.data || [];
}

function populateAcademicYearDropdown() {
  const sel = document.getElementById('tt-academic-year');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select academic year…</option>' +
    _academicYears.map(y => `<option value="${y.id}">${y.name}</option>`).join('');
}

// ── Academic Year combo: toggle between select & free-type ──
let _ayTextMode = false;
function toggleAcYearMode() {
  _ayTextMode = !_ayTextMode;
  const sel  = document.getElementById('tt-academic-year');
  const txt  = document.getElementById('tt-academic-year-text');
  const btn  = document.getElementById('tt-ay-toggle-btn');
  if (_ayTextMode) {
    sel.style.display = 'none'; txt.style.display = 'block';
    btn.textContent = '⇄ Select';
    txt.value = sel.value;
  } else {
    sel.style.display = 'block'; txt.style.display = 'none';
    btn.textContent = '⇄ Type';
    const typed = txt.value.trim();
    const match = _academicYears.find(y => y.id === typed || y.name.toLowerCase() === typed.toLowerCase());
    sel.value = match ? match.id : '';
  }
}
function getAcademicYearValue() {
  if (_ayTextMode) {
    const v = document.getElementById('tt-academic-year-text').value.trim();
    return v || null;
  }
  return document.getElementById('tt-academic-year').value || null;
}
function setAcademicYearValue(v) {
  const sel = document.getElementById('tt-academic-year');
  if (sel) sel.value = v || '';
  if (v && sel && !sel.value) {
    if (!_ayTextMode) toggleAcYearMode();
    document.getElementById('tt-academic-year-text').value = v;
  } else if (!_ayTextMode) {
    if (sel) sel.value = v || '';
  }
}

// ── Course mode toggle (search DB vs. free-type) ──
let _courseMode = 'search'; // 'search' | 'custom'
function setCourseMode(mode) {
  _courseMode = mode;
  document.getElementById('tt-cmode-search').classList.toggle('active', mode === 'search');
  document.getElementById('tt-cmode-custom').classList.toggle('active', mode === 'custom');
  document.getElementById('tt-course-search-wrap').style.display = mode === 'search' ? '' : 'none';
  document.getElementById('tt-course-custom-wrap').style.display = mode === 'custom' ? '' : 'none';
  if (mode === 'search') {
    document.getElementById('tt-course-custom').value = '';
  } else {
    clearCourseSelection();
  }
}

// ── Course typeahead helpers ──
function filterCourseDropdown(q) {
  const dd = document.getElementById('tt-course-dropdown');
  const pool = _profileCourses; // ALL courses from DB
  if (!pool.length) { dd.style.display = 'none'; return; }
  const lower = q.toLowerCase().trim();
  const matches = lower
    ? pool.filter(c => (c.name||c.id).toLowerCase().includes(lower))
    : pool;
  if (!matches.length) {
    dd.innerHTML = '<div class="tt-course-opt" style="color:var(--ink3);font-style:italic">No matches — switch to "Type Custom" to enter a name manually.</div>';
    dd.style.display = 'block'; return;
  }
  dd.innerHTML = matches.slice(0,20).map(c => {
    const label = c.name || c.id;
    const hi    = lower ? label.replace(new RegExp('(' + lower.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi'),'<em>$1</em>') : label;
    return '<div class="tt-course-opt" onmousedown="selectCourse(\'' + c.id + '\',\'' + label.replace(/'/g,"\\'") + '\')">' + hi + (c.id ? ' <span style="font-size:10px;color:var(--ink3);margin-left:4px">' + c.id + '</span>' : '') + '</div>';
  }).join('');
  dd.style.display = 'block';
}
function showCourseDropdown() {
  filterCourseDropdown(document.getElementById('tt-course-search').value);
}
function hideCourseDropdown() {
  const dd = document.getElementById('tt-course-dropdown');
  if (dd) dd.style.display = 'none';
}
function selectCourse(id, name) {
  document.getElementById('tt-course').value        = id;
  document.getElementById('tt-course-search').value = name;
  const sel = document.getElementById('tt-course-selected');
  if (sel) { sel.textContent = '✓ ' + name + (id ? '  (' + id + ')' : ''); sel.style.display = 'block'; }
  hideCourseDropdown();
}
function clearCourseSelection() {
  document.getElementById('tt-course').value        = '';
  document.getElementById('tt-course-search').value = '';
  const sel = document.getElementById('tt-course-selected');
  if (sel) sel.style.display = 'none';
}

// ── Day pill selector ──
function selectDay(day) {
  document.getElementById('tt-day').value = day;
  document.querySelectorAll('.tt-day-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.day === day);
  });
}
function clearDaySelection() {
  document.getElementById('tt-day').value = '';
  document.querySelectorAll('.tt-day-pill').forEach(p => p.classList.remove('selected'));
}

// ── Session date → auto day ──
const _DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function onSessionDateChange(val) {
  const hint = document.getElementById('tt-date-day-hint');
  if (!val) { if (hint) hint.style.display = 'none'; return; }
  // Parse date in local time (avoid UTC offset issues)
  const [y,m,d] = val.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const dayName = _DAY_NAMES[dt.getDay()];
  selectDay(dayName);
  if (hint) {
    hint.textContent = '📅 ' + val + ' is a ' + dayName + ' — day auto-selected';
    hint.style.display = 'block';
  }
}

// ── Quick time buttons ──
function setQuickTime(which, val) {
  const input = document.getElementById('tt-' + (which === 'start' ? 'start' : 'end'));
  if (input) { input.value = val; onTimeInput(which, val); }
}
function onTimeInput(which, val) {
  const prefix = which === 'start' ? 'tt-quick-start' : 'tt-quick-end';
  document.querySelectorAll('#' + prefix + ' .tt-qtime').forEach(b => {
    b.classList.toggle('selected', b.textContent.replace(':','') === val.replace(':','') ||
      val === b.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1]);
  });
}

// ══════════════════════════════════════════
// BOOKED SCHEDULE — render overview panel
// ══════════════════════════════════════════
function renderBookedSchedule() {
  const grid = document.getElementById('bookedScheduleGrid');
  if (!grid) return;
  if (!_myTimetable.length) {
    grid.innerHTML = '<div style="color:var(--ink3);font-size:13px;padding:8px 0">No bookings yet.</div>';
    return;
  }

  // Group slots by day
  const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const byDay = {};
  _myTimetable.forEach(s => {
    const d = s.day || 'Other';
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  });

  // Build label for academic year + date if available
  const ayLabel = document.getElementById('bookedScheduleAcYear');
  const uniqueAYs = [...new Set(_myTimetable.map(s => s.academic_year_id).filter(Boolean))];
  const ayNames = uniqueAYs.map(id => {
    const y = _academicYears.find(a => a.id === id);
    return y ? y.name : id;
  });
  if (ayLabel) ayLabel.textContent = ayNames.length ? ayNames.join(', ') : 'All Sessions';

  const days = [...dayOrder.filter(d => byDay[d]), ...Object.keys(byDay).filter(d => !dayOrder.includes(d))];
  grid.innerHTML = days.map(day => {
    const slots = byDay[day].sort((a,b) => (a.time_start||'').localeCompare(b.time_start||''));
    return `<div style="background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden">
      <div style="background:var(--crimson);color:#fff;padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${day}</div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
        ${slots.map(s => {
          const room   = _profileRooms.find(r => r.id === s.room_id);
          const acYear = _academicYears.find(a => a.id === s.academic_year_id);
          const cName  = _resolveCourseName(s);
          const rName  = room   ? (room.subject || room.id) : s.room_id;
          const dateStr= s.session_date ? `<span style="color:var(--ink3);font-size:11px">${s.session_date}</span>` : '';
          const ayBadge= acYear ? `<span style="font-size:10px;background:var(--blue-light);color:var(--blue);border-radius:3px;padding:1px 6px;font-weight:600">${acYear.name}</span>` : '';
          return `<div style="background:var(--white);border:1px solid var(--line);border-radius:6px;padding:9px 12px">
            <div style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:3px">${cName}</div>
            ${s.sub_topic ? '<div style="font-size:12px;color:var(--ink2);font-style:italic;margin-bottom:2px">' + s.sub_topic + '</div>' : ''}
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              ${ayBadge}
              ${dateStr}
            </div>
            <div style="font-size:12px;color:var(--ink2)">📍 ${rName}</div>
            <div style="font-size:12px;color:var(--ink3);font-family:monospace;margin-top:2px">${s.time_start||''} – ${s.time_end||''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── STAFF PROFILE ──
let staffProfilePublished = false;
let _profileCourses = [];
let _profileRooms = [];
let _myTimetable = [];   // slots from lecture_timetable for current user
let _editingTimetableId = null;

// ── Load departments from DB into dropdown ──
async function loadDepartments() {
  const sel = document.getElementById('sp-department');
  if (!sel) return;
  sel.innerHTML = '<option value="">Loading departments…</option>';
  let deptData, deptError;
  try {
    const res = await db.from('departments').select('name').eq('is_active', true).order('name');
    deptData = res.data; deptError = res.error;
  } catch(e) { deptError = e; }
  if (deptError || !deptData) {
    sel.innerHTML = '<option value="">Could not load departments</option>';
    console.error('loadDepartments error:', deptError);
    toast('Could not load departments: ' + (deptError?.message || 'Unknown error'), '⚠');
    return;
  }
  const data = deptData;
  const cur = sel.dataset.current || '';
  sel.innerHTML = '<option value="">Select department…</option>' +
    data.map(d => `<option value="${d.name}" ${d.name === cur ? 'selected' : ''}>${d.name}</option>`).join('');
}

async function loadTitles() {
  const sel = document.getElementById('sp-title');
  if (!sel) return;
  sel.innerHTML = '<option value="">Loading titles…</option>';
  let titlesData, titlesError;
  try {
    const res = await db.from('staff_titles').select('title').eq('is_active', true).order('sort_order').order('title');
    titlesData = res.data; titlesError = res.error;
  } catch(e) { titlesError = e; }
  if (titlesError || !titlesData) {
    sel.innerHTML = '<option value="">Could not load titles</option>';
    console.error('loadTitles error:', titlesError);
    return;
  }
  const cur = sel.dataset.current || '';
  sel.innerHTML = '<option value="">Select title…</option>' +
    titlesData.map(t => `<option value="${t.title}" ${t.title === cur ? 'selected' : ''}>${t.title}</option>`).join('');
}

async function loadStaffProfile() {
  if (!currentUser) return;
  // Fetch profile first so we can set dataset.current BEFORE loadDepartments renders options
  let spRes;
  try { spRes = await db.from('staff_profiles').select('*').eq('user_id', currentUser.id).single(); } catch(e) { spRes = { data: null }; }
  const { data } = spRes || { data: null };
  if (data) {
    document.getElementById('sp-nickname').value       = data.nickname || '';
    document.getElementById('sp-realname').value       = data.real_name || '';
    document.getElementById('sp-title').value          = data.title || '';
    document.getElementById('sp-qualifications').value = data.qualifications || '';
    document.getElementById('sp-capacity').value       = data.capacity || '';
    document.getElementById('sp-bio').value            = data.bio || '';
    document.getElementById('sp-guestLecturer').checked = !!data.guest_lecturer;
    if (data.iuc_start_date) {
      document.getElementById('sp-startdate').value = data.iuc_start_date;
      const sdRo = document.getElementById('sp-startdate-readonly');
      if (sdRo) sdRo.textContent = new Date(data.iuc_start_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    }
    staffProfilePublished = !!data.published;
    updatePublishUI();
    if (data.photo_url) setStaffPhoto(data.photo_url);
    // Set dataset.current BEFORE loadDepartments/loadTitles() so they pre-select correctly
    const depSel = document.getElementById('sp-department');
    if (depSel && data.department) depSel.dataset.current = data.department;
    const titleSel = document.getElementById('sp-title');
    if (titleSel && data.title) titleSel.dataset.current = data.title;
    // Populate readonly fallback displays
    const deptRo = document.getElementById('sp-dept-readonly');
    if (deptRo) deptRo.textContent = data.department || '—';
    const titleRo = document.getElementById('sp-title-readonly');
    if (titleRo) titleRo.textContent = data.title || '—';
  }
  // Now load departments + titles — they read dataset.current and pre-select correctly
  await Promise.all([loadDepartments(), loadTitles()]);
  await loadAcademicYearsForModal();
  await loadMyTimetable();
  applyProfileFieldLocks();
}

async function saveStaffProfile() {
  if (!currentUser) return;
  const nickname = document.getElementById('sp-nickname').value.trim();
  if (!nickname) { toast('Nickname is required.', '!'); return; }

  // Fetch existing photo_url so upsert does not accidentally wipe it
  let existingPhotoUrl = null;
  try {
    const { data: epd } = await db.from('staff_profiles').select('photo_url').eq('user_id', currentUser.id).single();
    existingPhotoUrl = epd?.photo_url || null;
  } catch(e) { /* no row yet */ }

  const payload = {
    user_id:        currentUser.id,
    nickname,
    real_name:      document.getElementById('sp-realname').value.trim(),
    department:     document.getElementById('sp-department').value,
    title:          document.getElementById('sp-title').value,
    qualifications: document.getElementById('sp-qualifications').value.trim(),
    capacity:       document.getElementById('sp-capacity').value.trim(),
    bio:            document.getElementById('sp-bio').value.trim(),
    guest_lecturer: document.getElementById('sp-guestLecturer').checked,
    iuc_start_date: document.getElementById('sp-startdate').value || null,
    published:      staffProfilePublished,
    updated_at:     new Date().toISOString(),
  };
  if (existingPhotoUrl) payload.photo_url = existingPhotoUrl;

  const { error } = await db.from('staff_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) { toast('Save failed: ' + error.message, '✗'); return; }
  toast('Profile saved! ✓', '✓');
  // Reload to keep UI in sync with DB
  await loadStaffProfile();
}

// ── TIMETABLE ──
async function loadMyTimetable() {
  if (!currentUser) return;
  // Load ALL courses + rooms for dropdowns (not just profile courses)
  let cRes, rRes;
  try { cRes = await db.from('courses').select('id,name').order('name'); } catch(e) { cRes = { data: [], error: e }; }
  try { rRes = await db.from('lecture_rooms').select('id,subject').order('subject'); } catch(e) { rRes = { data: [], error: e }; }
  if (cRes.error) console.error('loadMyTimetable courses error:', cRes.error);
  if (rRes.error) console.error('loadMyTimetable rooms error:', rRes.error);
  _profileCourses = cRes.data || [];
  _profileRooms   = rRes.data || [];

  // Load this user's timetable slots
  let ttRes;
  try { ttRes = await db.from('lecture_timetable').select('*').eq('staff_id', currentUser.id).order('day').order('time_start'); } catch(e) { ttRes = { data: [], error: e }; }
  if (ttRes.error) console.error('loadMyTimetable timetable error:', ttRes.error);
  const { data } = ttRes;
  _myTimetable = data || [];
  renderMyTimetable();
}

// ── MY PROFILE TAB SWITCHER ──
function switchMyProfileTab(tab) {
  const tabs = ['profile'];
  tabs.forEach(t => {
    const panel = document.getElementById('myProfileTab-' + t);
    const btn   = document.getElementById('mpt-' + t);
    const acts  = document.getElementById('myProfileActions-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn)   { btn.classList.toggle('active', t === tab); }
    if (acts)  acts.style.display = t === tab ? '' : 'none';
  });
}

function switchTTTab(tab) {
  document.querySelectorAll('.tt-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tt-tab-panel').forEach(p => p.classList.remove('active'));
  const tabEl = document.getElementById('ttTab-' + tab);
  const panelEl = document.getElementById('ttPanel-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (panelEl) panelEl.classList.add('active');
  if (tab === 'schedule') renderBookedSchedule();
}

function _resolveCourseName(slot) {
  // Priority: course_name field (set by get-timetable or saved directly) > DB lookup > course_id fallback
  if (slot.course_name) return slot.course_name;
  const course = _profileCourses.find(c => c.id === slot.course_id);
  if (course) return course.name || course.id;
  return slot.course_id || '(No Course)';
}

function renderMyTimetable() {
  const list  = document.getElementById('myTimetableList');
  const empty = document.getElementById('myTimetableEmpty');
  if (!list) return;
  if (!_myTimetable.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    renderBookedSchedule();
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = _myTimetable.map(slot => {
    const room   = _profileRooms.find(r => r.id === slot.room_id);
    const acYear = _academicYears.find(a => a.id === slot.academic_year_id);
    const cName  = _resolveCourseName(slot);
    const rName  = room   ? (room.subject || room.id) : slot.room_id;
    const ayBadge= acYear
      ? `<span class="tt-slot-badge" style="background:var(--blue-light);color:var(--blue)">${acYear.name}</span>`
      : (slot.academic_year_id ? `<span class="tt-slot-badge" style="background:var(--blue-light);color:var(--blue)">${slot.academic_year_id}</span>` : '');
    const dateStr= slot.session_date ? `<span class="tt-slot-badge" style="background:var(--gold-light);color:var(--gold)">${slot.session_date}</span>` : '';
    const roomBadge = `<span class="tt-slot-badge" style="background:var(--surface);color:var(--ink2);border:1px solid var(--line)">📍 ${rName}</span>`;
    return `<div class="tt-slot-card">
      <div class="tt-slot-day-badge">${slot.day}</div>
      <div class="tt-slot-body">
        <div class="tt-slot-course">${cName}</div>
        ${slot.sub_topic ? `<div class="tt-slot-topic">${slot.sub_topic}</div>` : ''}
        <div class="tt-slot-meta">
          ${ayBadge}${dateStr}${roomBadge}
          <span class="tt-slot-time">${slot.time_start||''} – ${slot.time_end||''}</span>
        </div>
      </div>
      <div class="tt-slot-actions">
        <button class="btn btn-outline btn-sm" onclick="openTimetableModal('${slot.id}')" title="Edit slot"
          style="display:flex;align-items:center;gap:4px;padding:7px 12px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button onclick="deleteTimetableSlot('${slot.id}')" title="Delete slot"
          style="background:none;border:1px solid rgba(139,26,46,.25);border-radius:var(--r);color:var(--crimson);cursor:pointer;padding:7px 10px;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;transition:all .15s"
          onmouseover="this.style.background='var(--crimson-light)'" onmouseout="this.style.background='none'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
  renderBookedSchedule();
}

async function openTimetableModal(slotId) {
  _editingTimetableId = slotId || null;

  // Load ALL courses from DB (not just profile courses)
  if (!_profileCourses.length || !_profileRooms.length) {
    let cR, rR;
    try { cR = await db.from('courses').select('id,name').order('name'); } catch(e) { cR = { data: [] }; }
    try { rR = await db.from('lecture_rooms').select('id,subject').order('subject'); } catch(e) { rR = { data: [] }; }
    _profileCourses = cR.data || [];
    _profileRooms   = rR.data || [];
  }

  // Load academic years
  await loadAcademicYearsForModal();
  populateAcademicYearDropdown();

  // Populate room dropdown
  const rSel = document.getElementById('tt-room');
  rSel.innerHTML = '<option value="">Select room…</option>' +
    _profileRooms.map(r => `<option value="${r.id}">${r.subject || r.id}</option>`).join('');

  // Reset state
  clearCourseSelection();
  clearDaySelection();
  setCourseMode('search');
  document.getElementById('tt-conflict-msg').style.display = 'none';
  document.getElementById('tt-date-day-hint').style.display = 'none';
  // Clear quick-time highlights
  document.querySelectorAll('.tt-qtime').forEach(b => b.classList.remove('selected'));

  if (slotId) {
    const slot = _myTimetable.find(s => s.id === slotId);
    if (slot) {
      // Restore course: check if it's a known DB course or a custom name
      const course = _profileCourses.find(c => c.id === slot.course_id);
      if (course) {
        selectCourse(course.id, course.name || course.id);
      } else if (slot.course_name && !slot.course_id) {
        // custom name slot
        setCourseMode('custom');
        document.getElementById('tt-course-custom').value = slot.course_name;
      } else if (slot.course_id) {
        // unknown course_id — prefill search but mark selected
        document.getElementById('tt-course').value = slot.course_id;
        document.getElementById('tt-course-search').value = slot.course_name || slot.course_id;
        const sel = document.getElementById('tt-course-selected');
        if (sel) { sel.textContent = '✓ ' + (slot.course_name || slot.course_id); sel.style.display = 'block'; }
      }
      rSel.value = slot.room_id;
      // Day pill
      if (slot.day) selectDay(slot.day);
      // Times
      document.getElementById('tt-start').value = slot.time_start || '';
      document.getElementById('tt-end').value   = slot.time_end   || '';
      if (slot.time_start) onTimeInput('start', slot.time_start);
      if (slot.time_end)   onTimeInput('end',   slot.time_end);
      document.getElementById('tt-sub-topic').value    = slot.sub_topic    || '';
      document.getElementById('tt-session-date').value = slot.session_date || '';
      if (slot.session_date) onSessionDateChange(slot.session_date);
      setAcademicYearValue(slot.academic_year_id || '');
    }
    document.getElementById('timetableModalTitle').textContent = 'Edit Timetable Slot';
  } else {
    rSel.value = '';
    document.getElementById('tt-start').value     = '';
    document.getElementById('tt-end').value       = '';
    document.getElementById('tt-sub-topic').value = '';
    document.getElementById('tt-session-date').value = '';
    setAcademicYearValue('');
    document.getElementById('timetableModalTitle').textContent = 'Add Timetable Slot';
  }
  document.getElementById('timetableModal').classList.add('open');
}

async function saveTimetableSlot() {
  // ── Gather course info ──
  let course_id   = null;
  let course_name = null;
  if (_courseMode === 'custom') {
    course_name = document.getElementById('tt-course-custom').value.trim();
    if (!course_name) { toast('Please enter a course name.', '⚠'); return; }
  } else {
    course_id   = document.getElementById('tt-course').value;
    course_name = document.getElementById('tt-course-search').value.trim() || null;
    if (!course_id) { toast('Please select a course.', '⚠'); return; }
  }

  const room_id     = document.getElementById('tt-room').value;
  const day         = document.getElementById('tt-day').value;
  const time_start  = document.getElementById('tt-start').value;
  const time_end    = document.getElementById('tt-end').value;
  const sub_topic        = document.getElementById('tt-sub-topic').value.trim() || null;
  const academic_year_id = getAcademicYearValue();
  const session_date     = document.getElementById('tt-session-date').value || null;
  const conflictEl  = document.getElementById('tt-conflict-msg');

  if (!room_id || !day || !time_start || !time_end) {
    toast('Please fill in room, day, start time, and end time.', '⚠'); return;
  }
  if (time_end <= time_start) {
    toast('End time must be after start time.', '⚠'); return;
  }

  // ── Overlap check: query all slots for same room + day ──
  conflictEl.style.display = 'none';
  let existingRes;
  try {
    existingRes = await db.from('lecture_timetable').select('id,time_start,time_end,staff_id').eq('room_id', room_id).eq('day', day);
  } catch(e) { existingRes = { data: [] }; }
  const existing = existingRes.data || [];

  const conflicts = existing.filter(s => {
    if (_editingTimetableId && s.id === _editingTimetableId) return false;
    return time_start < s.time_end && time_end > s.time_start;
  });

  if (conflicts.length) {
    conflictEl.textContent = '⚠ This room is already booked during that time by another staff member. Please choose a different room, day, or time.';
    conflictEl.style.display = 'block';
    return;
  }

  const payload = {
    staff_id: currentUser.id,
    course_id:   course_id   || null,
    course_name: course_name || null,
    room_id, day, time_start, time_end,
    sub_topic, academic_year_id, session_date,
    updated_at: new Date().toISOString(),
  };

  if (_editingTimetableId) {
    const { error } = await db.from('lecture_timetable').update(payload).eq('id', _editingTimetableId);
    if (error) { toast('Update failed: ' + error.message, '✗'); return; }
    const idx = _myTimetable.findIndex(s => s.id === _editingTimetableId);
    if (idx >= 0) _myTimetable[idx] = Object.assign({}, _myTimetable[idx], payload);
    toast('Slot updated.', '✓');
  } else {
    const { data, error } = await db.from('lecture_timetable').insert(payload).select().single();
    if (error) { toast('Save failed: ' + error.message, '✗'); return; }
    _myTimetable.push(data);
    toast('Slot added.', '✓');
  }
  closeModal('timetableModal');
  renderMyTimetable();
}

async function deleteTimetableSlot(slotId) {
  const slot = _myTimetable.find(s => s.id === slotId);
  const label = slot ? _resolveCourseName(slot) : 'this slot';
  if (!confirm('Delete "' + label + '" (' + (slot && slot.day || '') + ')? This cannot be undone.')) return;
  const { error } = await db.from('lecture_timetable').delete().eq('id', slotId);
  if (error) { toast('Delete failed: ' + error.message, '✗'); return; }
  _myTimetable = _myTimetable.filter(s => s.id !== slotId);
  renderMyTimetable();
  toast('Slot deleted.', '🗑');
}

function toggleProfilePublish() {
  staffProfilePublished = !staffProfilePublished;
  updatePublishUI();
}

function updatePublishUI() {
  const btn = document.getElementById('profilePublishBtn');
  const lbl = document.getElementById('profilePublishLabel');
  const banner = document.getElementById('profileStatusBanner');
  const badge = document.getElementById('staffPublicBadge');
  const dot = document.getElementById('staffPublicDot');
  const badgeLbl = document.getElementById('staffPublicBadgeLabel');
  if (staffProfilePublished) {
    if (btn) { btn.style.background = 'var(--crimson)'; }
    if (lbl) lbl.textContent = 'Unpublish Profile';
    if (banner) { banner.style.display = 'flex'; banner.style.background = 'var(--green-light)'; banner.style.border = '1px solid rgba(26,92,58,.2)'; banner.style.color = 'var(--green)'; banner.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Profile is <strong style="margin:0 3px">Public</strong> — students can see your full profile.'; }
    if (badge) { badge.style.background = 'var(--green-light)'; badge.style.borderColor = 'rgba(26,92,58,.2)'; badge.style.color = 'var(--green)'; }
    if (dot) dot.style.background = 'var(--green)';
    if (badgeLbl) badgeLbl.textContent = 'Published';
  } else {
    if (btn) { btn.style.background = 'var(--green)'; }
    if (lbl) lbl.textContent = 'Publish Profile';
    if (banner) { banner.style.display = 'flex'; banner.style.background = 'var(--surface)'; banner.style.border = '1px solid var(--line)'; banner.style.color = 'var(--ink3)'; banner.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Profile is <strong style="margin:0 3px">Private</strong> — only nickname and department are visible to students.'; }
    if (badge) { badge.style.background = 'var(--surface)'; badge.style.borderColor = 'var(--line)'; badge.style.color = 'var(--ink3)'; }
    if (dot) dot.style.background = 'var(--ink3)';
    if (badgeLbl) badgeLbl.textContent = 'Private';
  }
}

function handleStaffPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Photo must be under 3MB.', '!'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    setStaffPhoto(dataUrl);
    // Upload to Supabase storage if available
    try {
      const ext = file.name.split('.').pop();
      const path = 'staff-photos/' + currentUser.id + '.' + ext;
      const { error } = await db.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (!error) {
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
        await db.from('staff_profiles').upsert({ user_id: currentUser.id, photo_url: urlData.publicUrl }, { onConflict: 'user_id' });
      }
    } catch(e) { /* storage not configured, preview only */ }
  };
  reader.readAsDataURL(file);
}

function setStaffPhoto(src) {
  const img = document.getElementById('staffPhotoImg');
  const initials = document.getElementById('staffPhotoInitials');
  if (img) { img.src = src; img.style.display = 'block'; }
  if (initials) initials.style.display = 'none';
  const av = document.getElementById('sidebarAvatar');
  if (av) { av.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; }
}


restoreSession();

// Realtime: refresh edit requests when a student submits a new one
db.channel('edit-requests-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'student_edit_requests'
  }, () => {
    loadEditRequests();
  })
  .subscribe();

async function retryLoadData() {
  const banner = document.getElementById('loadErrBanner');
  if (banner) banner.innerHTML = '<span style="color:var(--ink2);padding:4px 0">⏳ Retrying…</span>';
  await populateTables();
  if (students.length > 0) {
    if (banner) banner.remove();
    toast('✅ Data loaded successfully — ' + students.length + ' students.', '✓');
  } else {
    if (banner) banner.innerHTML = `
      <strong style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Still no data.</strong>
      <span style="color:var(--ink2);flex:1">Check your Supabase project is active and RLS policies allow reads.</span>
      <button class="btn btn-primary btn-sm" onclick="retryLoadData()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retry Again</button>
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('loadErrBanner').remove()">Dismiss</button>`;
  }
}

async function refreshAllData() {
  const btn = document.getElementById('refreshDataBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg class="ui-icon spin"><use href="#i-sync"></use></svg> Refreshing…'; btn.style.minWidth = btn.offsetWidth+'px'; }
  await populateTables();
  await loadEditRequests();
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="ui-icon"><use href="#i-sync"></use></svg> Refresh Data'; btn.style.minWidth=''; }
  toast('Data reloaded from Supabase.', '✓');
}

function applyRoleUI() {
  document.querySelectorAll('.registrar-only').forEach(el => {
    el.style.display = currentRole === 'registrar' ? '' : 'none';
  });
  document.querySelectorAll('.staff-visible').forEach(el => { el.style.display = ''; });
  const regSection = document.querySelector('.registrar-section');
  if (regSection) regSection.textContent = currentRole === 'staff' ? 'Student Records' : 'Secretariat';
}

// ══════════════════════════════════════════
