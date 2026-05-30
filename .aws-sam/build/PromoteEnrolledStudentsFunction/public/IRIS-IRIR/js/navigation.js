// ── Section / sidebar switching ───────────────────────────────
const SECTION_TITLES = {
  home:          'Home',
  profile:       'My Personal Page',
  grades:        'Academic Record',
  coursesession: 'Academic Session',
  timetable:     'Lecture & Discussion Timetable',
  markbook:      'Mark Book',
  news:          'Our Chronicles in Spring',
  share:         'Contribute to Chronicles',
  docs:          'Document Office',
  idcard:        'ID Card',
  photo:         'Profile Photo',
  editinfo:      'Edit My Information',
  lecturerooms:  'Lecture Rooms',
  comms:         'Communication'
};

// ── Hash routing helpers ──────────────────────────────────────
// All valid section ids — used to validate incoming hashes
const VALID_SECTIONS = new Set(Object.keys(SECTION_TITLES));

// Internal flag: prevents hashchange loop when we set the hash ourselves
let _suppressHashChange = false;

function _setHash(id) {
  _suppressHashChange = true;
  history.replaceState(null, '', '#' + id);
  // Release the flag after the hashchange event (if any) fires
  setTimeout(function() { _suppressHashChange = false; }, 0);
}

function _pushHash(id) {
  _suppressHashChange = true;
  history.pushState(null, '', '#' + id);
  setTimeout(function() { _suppressHashChange = false; }, 0);
}

function switchSection(id, btn, _fromHash) {
  // Validate section
  if (!VALID_SECTIONS.has(id)) id = 'home';

  // Update section panels
  document.querySelectorAll('.section').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  // Update sidebar nav items
  document.querySelectorAll('.sbnav-item').forEach(b => b.classList.remove('active'));
  if (btn && btn.classList.contains('sbnav-item')) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.sbnav-item[data-section]').forEach(b => {
      if (b.dataset.section === id) b.classList.add('active');
    });
  }

  // Sync mobile tab bar
  document.querySelectorAll('.mob-tab[data-section]').forEach(t => t.classList.remove('active'));
  const mobTab = document.querySelector('.mob-tab[data-section="'+id+'"]');
  if (mobTab) mobTab.classList.add('active');

  // Update topbar title
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = SECTION_TITLES[id] || id;

  // Load section-specific data
  if (id === 'editinfo') { try { onSwitchToEditInfo(); } catch(e) {} }
  if (id === 'comms') { try { loadCommsSection(); } catch(e) {} }
  if (id === 'lecturerooms') { try { loadLectureRooms(); } catch(e) {} }
  if (id === 'timetable') { try { loadTimetableIfNeeded(); } catch(e) {} }
  if (id === 'docs') { try { loadOfficeDocsIfNeeded(); } catch(e) {} }

  // Scroll to top
  const _dm = document.querySelector('.dash-main');
  if (_dm) _dm.scrollTop = 0;

  // Close sidebar on mobile
  closeSidebar();

  // ── Hash routing: update URL (skip if navigation came from hashchange) ──
  if (!_fromHash) {
    _pushHash(id);
  }
}

// Listen for browser Back / Forward
window.addEventListener('hashchange', function() {
  if (_suppressHashChange) return;
  const hash = (location.hash || '').replace('#', '');
  const id   = VALID_SECTIONS.has(hash) ? hash : 'home';
  // Navigate without pushing another history entry
  switchSection(id, null, true /* _fromHash */);
});

// On page load: open the panel matching the current hash (default #home)
// Called after login so the dashboard is visible first
function _resolveInitialHash() {
  const hash = (location.hash || '').replace('#', '');
  const id   = VALID_SECTIONS.has(hash) ? hash : 'home';
  // Replace (not push) so Back from initial view exits the app
  _setHash(id);
  switchSection(id, null, true /* _fromHash */);
}

// Legacy alias so existing switchTab() calls in renderDocCards etc. still work
function switchTab(id, btn) { switchSection(id, btn); }

// ── Apps grid toggle ──────────────────────────────────────────────
let _appsExpanded = false;
function toggleAppsGrid() {
  _appsExpanded = !_appsExpanded;
  const more = document.getElementById('appsGridMore');
  const icon = document.getElementById('appsToggleIcon');
  const txt  = document.getElementById('appsToggleTxt');
  if (!more) return;
  if (_appsExpanded) {
    more.style.display = '';
    if (icon) icon.style.transform = 'rotate(180deg)';
    if (txt)  txt.textContent = 'Less applications';
  } else {
    more.style.display = 'none';
    if (icon) icon.style.transform = '';
    if (txt)  txt.textContent = 'More applications';
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sbOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('show');
}



// ── Print helpers ─────────────────────────────────────────────
// Page numbers are injected into each page via CSS counters in @page,
// but the footer and watermark are real DOM elements fixed to viewport —
// they repeat on every page automatically in print mode.
// The right-side label just shows "Official Transcript" since browsers
// handle page X/Y natively only in @page margin boxes (not supported by all).
window.addEventListener('beforeprint', function() {
  const footer = document.querySelector('.print-footer');
  const wm     = document.querySelector('.print-watermark');
  const hdr    = document.getElementById('printPageHeader');
  if (footer) footer.style.display = 'flex';
  if (wm)     wm.style.display     = 'block';
  if (hdr)    hdr.style.display    = 'flex';
  // Populate Student ID from active panel
  const sidEl = document.getElementById('infoID');
  const sidSpan = document.getElementById('printFooterSID');
  const sidVal = sidEl ? sidEl.textContent : '—';
  if (sidSpan) sidSpan.textContent = sidVal;
  // Refresh @page margin box data attributes
  document.documentElement.setAttribute('data-sid', sidVal);
  const nameEl = document.getElementById('profileName');
  const nameVal = nameEl ? nameEl.textContent : '';
  document.documentElement.setAttribute('data-student-name', nameVal);
  // Page header: student name + Student ID
  const phName = document.getElementById('printPageHeaderName');
  const phSid  = document.getElementById('printPageHeaderSID');
  if (phName) phName.textContent = 'University of Medicine (2) — ' + (nameVal || 'Official Document');
  const _lbl = (window._studentIdLabel || 'Student ID');
  if (phSid)  phSid.textContent  = _lbl + ': ' + sidVal;
  const ftLeft = document.getElementById('printFooterLeft');
  if (ftLeft) ftLeft.innerHTML = 'University of Medicine (2) &nbsp;&middot;&nbsp; ' + _lbl + ': <span class="print-footer-sid">' + sidVal + '</span>';
  // Right label on fixed footer — note: page number via @page is more reliable
  const right = document.getElementById('printFooterRight');
  if (right) right.textContent = ''; // page number rendered via CSS counter ::before
  const center = document.getElementById('printFooterCenter');
  if (center) center.textContent = nameVal;
});
window.addEventListener('afterprint', function() {
  const footer = document.querySelector('.print-footer');
  const wm     = document.querySelector('.print-watermark');
  const hdr    = document.getElementById('printPageHeader');
  if (footer) footer.style.display = 'none';
  if (wm)     wm.style.display     = 'none';
  if (hdr)    hdr.style.display    = 'none';
});



