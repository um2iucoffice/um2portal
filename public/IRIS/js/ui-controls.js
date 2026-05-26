function mobGoApps(btn) {
  // Go to home, then scroll to apps section
  mobSwitchTab('home', document.querySelector('.mob-tab[data-section="home"]'));
  setTimeout(function() {
    var el = document.getElementById('appsGridTop');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

// ── Mobile Tab Bar ────────────────────────────────────────────────
function mobSwitchTab(section, btn) {
  // Sync desktop sidebar
  switchSection(section, document.querySelector('.sbnav-item[data-section="'+section+'"]'));
  // Update mobile tab active states
  document.querySelectorAll('.mob-tab[data-section]').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const t = document.querySelector('.mob-tab[data-section="'+section+'"]');
    if (t) t.classList.add('active');
  }
  // Scroll to top
  const _dm2 = document.querySelector('.dash-main');
  if (_dm2) _dm2.scrollTop = 0;
}

function toggleMobMore(btn) {
  const menu = document.getElementById('mobMoreMenu');
  const overlay = document.getElementById('mobMoreOverlay');
  menu.classList.toggle('open');
  overlay.classList.toggle('open');
}
function closeMobMore() {
  document.getElementById('mobMoreMenu').classList.remove('open');
  document.getElementById('mobMoreOverlay').classList.remove('open');
}

// ── Theme Toggle ──────────────────────────────────────────────────
const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_SVG  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
  // Update dashboard toggle icon
  const isLight = theme === 'light';
  document.querySelectorAll('#themeIconLogin, #themeIconDash').forEach(el => {
    el.outerHTML = (isLight ? MOON_SVG : SUN_SVG).replace('width="16"','id="' + el.id + '" width="16"').replace('width="18"','id="' + el.id + '" width="18"');
  });
  // Update login pill active state
  const darkBtn  = document.getElementById('loginThemeDark');
  const lightBtn = document.getElementById('loginThemeLight');
  if (darkBtn)  darkBtn.classList.toggle('active',  !isLight);
  if (lightBtn) lightBtn.classList.toggle('active',  isLight);
  try { localStorage.setItem('iris_theme', theme); } catch(e) {}
}

function toggleTheme() {
  const isLight = document.body.classList.contains('theme-light');
  applyTheme(isLight ? 'dark' : 'light');
}

// Restore theme on load
(function() {
  let saved = 'dark';
  try { saved = localStorage.getItem('iris_theme') || 'dark'; } catch(e) {}
  applyTheme(saved);
})();

// ── Sign out ──────────────────────────────────────────────────
// ── Edit My Info (student personal data change requests) ─────
// Requires Netlify function: netlify/functions/edit-request.js
// Table: student_edit_requests (see Setup Guide in registrar portal)

async function loadEditInfoSection() {
  const sid = (document.getElementById('loginStudentId').value || '').trim().toLowerCase();
 const pwd = window._sessionToken || ''
  if (!sid) return;

  try {
    const res = await fetch('/.netlify/functions/get-edit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: sid, password: pwd })
    });
    if (!res.ok) return;
    const data = await res.json();
    const rows = data.requests || [];

    // Pre-fill form with current values
    const saved = window._currentStudent;
    if (saved) {
      document.getElementById('editFatherEN').value = saved.fatherName   || '';
      document.getElementById('editFatherMY').value = saved.fatherNameMM || '';
      document.getElementById('editMotherEN').value = saved.motherName   || '';
      document.getElementById('editMotherMY').value = saved.motherNameMM || '';
    }

    // Check pending
    const pending = rows.find(r => r.status === 'pending');
    const lastApproved = rows.find(r => r.status === 'approved');
    const pendingNotice  = document.getElementById('editInfoPendingNotice');
    const approvedNotice = document.getElementById('editInfoApprovedNotice');

    if (pending) {
      pendingNotice.style.display = '';
      document.getElementById('editInfoPendingText').textContent =
        'Your request submitted on ' + (pending.submitted_at ? pending.submitted_at.slice(0,10) : '') + ' is awaiting Registrar review.';
      document.getElementById('submitEditInfoBtn').disabled = true;
      document.getElementById('submitEditInfoBtn').style.opacity = '0.5';
      document.getElementById('editInfoBadge').style.display = '';
    } else {
      pendingNotice.style.display = 'none';
      document.getElementById('submitEditInfoBtn').disabled = false;
      document.getElementById('submitEditInfoBtn').style.opacity = '';
      document.getElementById('editInfoBadge').style.display = 'none';
    }

    if (lastApproved && !pending) {
      approvedNotice.style.display = '';
      document.getElementById('editInfoApprovedText').textContent =
        'Your request from ' + (lastApproved.submitted_at ? lastApproved.submitted_at.slice(0,10) : '') +
        ' was approved on ' + (lastApproved.reviewed_at ? lastApproved.reviewed_at.slice(0,10) : '—') + '.';
    } else {
      approvedNotice.style.display = 'none';
    }

    // Render history (element removed — no-op)
    if (!rows || !rows.length) return;

  } catch(e) {
    console.warn('loadEditInfoSection error:', e);
  }
}

async function submitInfoEditRequest() {
  const sid = (document.getElementById('loginStudentId').value || '').trim().toLowerCase();
  const pwd = window._sessionToken || '';
  if (!sid) { alert('Session expired. Please log in again.'); return; }

  const saved = window._currentStudent || {};
  const newFatherEN = document.getElementById('editFatherEN').value.trim();
  const newFatherMY = document.getElementById('editFatherMY').value.trim();
  const newMotherEN = document.getElementById('editMotherEN').value.trim();
  const newMotherMY = document.getElementById('editMotherMY').value.trim();
  const reason      = document.getElementById('editInfoReason').value.trim();

  const changes = [];
  if (newFatherEN !== (saved.fatherName   || '')) changes.push({ field: 'father',    old: saved.fatherName   || '', new: newFatherEN });
  if (newFatherMY !== (saved.fatherNameMM || '')) changes.push({ field: 'father_my', old: saved.fatherNameMM || '', new: newFatherMY });
  if (newMotherEN !== (saved.motherName   || '')) changes.push({ field: 'mother',    old: saved.motherName   || '', new: newMotherEN });
  if (newMotherMY !== (saved.motherNameMM || '')) changes.push({ field: 'mother_my', old: saved.motherNameMM || '', new: newMotherMY });

  if (!changes.length) {
    document.getElementById('editInfoStatus').textContent = 'No changes detected. Update the fields you want to change.';
    return;
  }
  if (!reason) {
    document.getElementById('editInfoStatus').textContent = 'Please enter a reason for this request.';
    return;
  }

  const btn = document.getElementById('submitEditInfoBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';
  document.getElementById('editInfoStatus').textContent = '';

  try {
    const res = await fetch('/.netlify/functions/edit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: sid, password: pwd, changes, reason })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message || 'Submission failed.');

    document.getElementById('editInfoStatus').textContent = '✓ Request submitted successfully! Awaiting Registrar approval.';
    document.getElementById('editInfoBadge').style.display = '';
    document.getElementById('editInfoReason').value = '';
    await loadEditInfoSection();
  } catch(e) {
    document.getElementById('editInfoStatus').textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Request';
  }
}

// Hook into switchSection to load edit info data on demand
function onSwitchToEditInfo() {
  loadEditInfoSection();
}

