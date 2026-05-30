// ══════════════════════════════════════
// Auth, Session Restore, Profile Field Locks, User List
// ══════════════════════════════════════

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
function selectLoginRole(role) {
  selectedLoginRole = role;
  document.querySelectorAll('.login-role-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('lrb-' + role).classList.add('sel');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showLoginErr('Please enter email and password.'); return; }

  showLoginErr('Signing in…');
  const _lbtn = document.querySelector('.login-btn');
  if (_lbtn) { _lbtn.disabled = true; _lbtn.textContent = 'Signing in…'; }
  _dbg('doLogin: signing in as ' + email);

  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });

  if (error) {
    _dbg('signIn FAILED: ' + error.message);
    showLoginErr(error.message || 'Invalid credentials.');
    const _lbtnR = document.querySelector('.login-btn');
    if (_lbtnR) { _lbtnR.disabled = false; _lbtnR.textContent = 'Sign In →'; }
    return;
  }

  _dbg('signIn OK, session=' + (data.session ? 'yes' : 'null'));
  _sessionHandled = true;
  const _lbtnS = document.querySelector('.login-btn');
  if (_lbtnS) { _lbtnS.disabled = false; _lbtnS.textContent = 'Sign In →'; }
  await _bootApp(data.session);
}

function showLoginErr(msg) {
  const e = document.getElementById('loginErr');
  e.textContent = msg;
  e.style.display = 'block';
  if (!msg.includes('…')) setTimeout(() => e.style.display = 'none', 4000);
}

async function doLogout() {
  _sessionHandled = false;
  await db.auth.signOut();
  currentUser = null;
  currentRole = null;
  students = []; gradeData = {}; enrollHistory = {}; courses = []; attendanceRecords = [];
  _gradesColumns = null;
  document.getElementById('appShell').classList.remove('visible');
  const loginEl = document.getElementById('loginScreen');
  loginEl.innerHTML = `
  <div class="login-left">
    <div class="login-crest">
      <div class="crest-ring"><span class="crest-abbr">UM2</span></div>
      <div class="login-institution">University of Medicine (2)</div>
      <div class="login-tagline">IRIR <em>Admin</em><br>Portal</div>
    </div>
    <div class="login-footer-txt">Academic Year 2026–2027<br>© 2026 UM2IUC. All rights reserved.</div>
  </div>
  <div class="login-right">
    <div class="login-form-wrap">
      <h2>Welcome back</h2>
      <p>Sign in to the IRIR University Council portal.</p>
      <div style="margin-bottom:18px">
        <div class="login-label">Login As</div>
        <div class="login-role-row">
          <div class="login-role-btn sel" id="lrb-registrar" onclick="selectLoginRole('registrar')">Secretariat</div>
          <div class="login-role-btn" id="lrb-staff" onclick="selectLoginRole('staff')">Faculty</div>
        </div>
      </div>
      <label class="login-label" for="loginEmail">Staff Email</label>
      <input class="login-input" type="email" id="loginEmail" placeholder="e.g. registrar@um2.edu.mm" autocomplete="username">
      <label class="login-label" for="loginPass">Password</label>
      <input class="login-input" type="password" id="loginPass" placeholder="••••••••" autocomplete="current-password">
      <button class="login-btn" onclick="doLogin()">Sign In</button>
      <div class="login-err" id="loginErr" style="display:none"></div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--ink3);text-align:center">
        Sign in with your Supabase Auth credentials.<br>Roles are assigned in the <code>profiles</code> table.
      </div>
    </div>
  </div>`;
  loginEl.style.display = 'flex';
}

// ══════════════════════════════════════════
// SESSION RESTORE — runs once on page load
// Uses getSession() which is synchronous with localStorage and always has
// the auth token ready before any DB queries are made.
// ══════════════════════════════════════════
let _sessionHandled = false;

async function restoreSession() {
  _dbg('restoreSession: calling getSession...');
  let session = null;
  try {
    const { data, error } = await db.auth.getSession();
    if (error) { _dbg('getSession error: ' + error.message); return; }
    session = data?.session || null;
  } catch(e) { _dbg('getSession threw: ' + e.message); return; }

  if (!session) { _dbg('No session in localStorage — showing login'); return; }
  _dbg('Session found for: ' + session.user.email);
  _sessionHandled = true;
  await _bootApp(session);
}

// Debug logger (no-op in production)
function _dbg(msg) { /* debug removed */ }

// Shared boot logic used by both restoreSession() and doLogin()
async function _bootApp(session) {
  _dbg('_bootApp: starting for ' + session.user.email);
  const loginEl = document.getElementById('loginScreen');

  // Show loading spinner
  loginEl.style.display = 'flex';
  loginEl.innerHTML = `
  <div class="login-left">
    <div class="login-crest">
      <div class="crest-ring"><span class="crest-abbr">UM2</span></div>
      <div class="login-institution">University of Medicine (2)</div>
      <div class="login-tagline">IRIR <em>Admin</em><br>Portal</div>
    </div>
    <div class="login-footer-txt">Academic Year 2026–2027<br>© 2026 UM2IUC. All rights reserved.</div>
  </div>
  <div class="login-right">
    <div class="login-form-wrap" style="text-align:center">
      <div style="font-size:32px;margin-bottom:14px">⏳</div>
      <div style="font-family:'Libre Baskerville',serif;font-size:18px;color:var(--ink);margin-bottom:6px">Loading…</div>
      <div style="font-size:13px;color:var(--ink3)">Fetching records from Supabase</div>
    </div>
  </div>`;

  // Fetch profile (single attempt — token is already valid at this point)
  const { data: profile, error: pErr } = await db.from('profiles')
    .select('role,staff_id,full_name')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    _dbg('profile fetch FAILED: ' + (pErr?.message || 'unknown'));
    await db.auth.signOut();
    loginEl.innerHTML = `<div class="login-box">
      <div class="login-logo">UM2 <span>MBBS</span> · Secretariat</div>
      <div style="background:#FFF8E1;border:1px solid #F9A825;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px;color:#6d4c00">
        <span style="display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Profile not found or session expired. Please sign in again.</span>
      </div>
      <label class="login-label" for="loginEmail">Staff ID / Email</label>
      <input class="login-input" type="email" id="loginEmail" placeholder="e.g. registrar@um2.edu.mm">
      <label class="login-label" for="loginPass">Password</label>
      <input class="login-input" type="password" id="loginPass" placeholder="••••••••">
      <button class="login-btn" onclick="doLogin()">Sign In</button>
      <div class="login-err" id="loginErr" style="display:none"></div>
    </div>`;
    return;
  }

  _dbg('profile OK: role=' + profile.role + ' staff_id=' + profile.staff_id);
  currentUser = {
    id:       session.user.id,
    email:    session.user.email,
    role:     profile.role,
    staff_id: profile.staff_id || '—',
    name:     profile.full_name || session.user.email,
    initials: (profile.full_name || session.user.email).slice(0,2).toUpperCase()
  };
  currentRole = profile.role;

  // Show the app shell immediately — don't wait for data
  loginEl.style.display = 'none';
  const app = document.getElementById('appShell');
  app.classList.add('visible');
  document.getElementById('roleLabel').textContent =
    currentRole === 'registrar'
      ? `Secretariat · ID: ${currentUser.staff_id}`
      : `Faculty · ID: ${currentUser.staff_id}`;
  document.getElementById('topbarAvatar').textContent = currentUser.initials;
  const uploaderEl = document.getElementById('grade-uploader');
  if (uploaderEl) uploaderEl.value = currentUser.staff_id;
  applyRoleUI();
  // Populate sidebar user card
  populateSidebarUser();

  // ── History API: seed initial state, restore from hash if present ──
  const hashView = window.location.hash.slice(1);
  const startView = hashView && document.getElementById('view-' + hashView) ? hashView : 'dashboard';
  history.replaceState({ view: startView }, '', '#' + startView);
  showView(startView, true); // true = already pushed to history
  showViewTitled(startView);

  // Load data in the background — show banner if it fails
  await populateTables();
  await loadEditRequests();
  await loadStaffProfile();
  if (students.length === 0) {
    showLoadErrBanner();
  }
}

function showLoadErrBanner() {
  const existing = document.getElementById('loadErrBanner');
  if (existing) existing.remove();
  const errBanner = document.createElement('div');
  errBanner.id = 'loadErrBanner';
  errBanner.style.cssText = 'position:fixed;top:56px;left:0;right:0;z-index:900;background:#fff3f3;border-bottom:2px solid var(--crimson);padding:12px 24px;display:flex;align-items:center;gap:12px;font-size:13px;color:var(--crimson)';
  errBanner.innerHTML = `
    <strong style="display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Could not load student data.</strong>
    <span style="color:var(--ink2);flex:1">Database returned no records — check your Supabase connection and RLS policies.</span>
    <button class="btn btn-primary btn-sm" onclick="retryLoadData()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retry</button>
    <button class="btn btn-outline btn-sm" onclick="document.getElementById('loadErrBanner').remove()">Dismiss</button>`;
  document.getElementById('appShell').appendChild(errBanner);
}


// ── THEME TOGGLE ──
function toggleTheme() {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('irir_theme', isLight ? 'light' : 'dark');
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.innerHTML = isLight
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  }
}
(function() {
  if (localStorage.getItem('irir_theme') === 'light') {
    document.body.classList.add('theme-light');
  }
})();

// ── SIDEBAR USER CARD ──
function populateSidebarUser() {
  if (!currentUser) return;
  const av = document.getElementById('sidebarAvatar');
  const nm = document.getElementById('sidebarName');
  const rl = document.getElementById('sidebarRole');
  if (av) av.textContent = currentUser.initials || '—';
  if (nm) nm.textContent = currentUser.name || '—';
  if (rl) rl.textContent = currentRole === 'registrar' ? 'Secretariat' : 'Faculty';
}

// ── TOPBAR TITLE UPDATE ──
const _origShowView = typeof showView === 'function' ? showView : null;
function showViewTitled(viewId) {
  const titles = {
    dashboard:'Quick Access', students:'Students', enroll:'Enrollment',
    bulkEnroll:'Bulk Enrollment', addStudent:'Add Student', bulkStudent:'Bulk Import Students',
    grades:'Grade Upload', attendance:'Live Attendance', courses:'Courses',
    bulkCourses:'Bulk Import Courses', degrees:'Degree Programs', years:'Academic Years',
    bulkYears:'Bulk Import Years', channels:'Channels', lectureRooms:'Lecture Rooms',
    editRequests:'Edit Requests', notifications:'Email Log', setup:'Setup Guide',
    myProfile:'My Profile', profile:'Student Profile', userList:'System Users',
    docOffice:'Document Office', chronicles:'Our Chronicles',
  };
  const tb = document.getElementById('topbarTitle');
  if (tb && titles[viewId]) tb.textContent = titles[viewId];
}

// ══════════════════════════════════════════
// DEPARTMENT & TITLE — Registrar-only lock
// ══════════════════════════════════════════
function applyProfileFieldLocks() {
  const isRegistrar = currentRole === 'registrar';
  const deptSel = document.getElementById('sp-department');
  const deptRo  = document.getElementById('sp-dept-readonly');
  const deptLock= document.getElementById('sp-dept-lock');
  const titleSel= document.getElementById('sp-title');
  const titleRo = document.getElementById('sp-title-readonly');
  const titleLock=document.getElementById('sp-title-lock');
  const sdInput = document.getElementById('sp-startdate');
  const sdRo    = document.getElementById('sp-startdate-readonly');
  const sdLock  = document.getElementById('sp-startdate-lock');

  if (isRegistrar) {
    if (deptSel)  deptSel.style.display  = '';
    if (deptRo)   deptRo.style.display   = 'none';
    if (deptLock) deptLock.style.display = 'none';
    if (titleSel) titleSel.style.display = '';
    if (titleRo)  titleRo.style.display  = 'none';
    if (titleLock)titleLock.style.display= 'none';
    if (sdInput)  sdInput.style.display  = '';
    if (sdRo)     sdRo.style.display     = 'none';
    if (sdLock)   sdLock.style.display   = 'none';
  } else {
    if (deptSel)  deptSel.style.display  = 'none';
    if (deptRo)   deptRo.style.display   = '';
    if (deptLock) deptLock.style.display = 'inline-flex';
    if (titleSel) titleSel.style.display = 'none';
    if (titleRo)  titleRo.style.display  = '';
    if (titleLock)titleLock.style.display= 'inline-flex';
    if (sdInput)  sdInput.style.display  = 'none';
    if (sdRo)     sdRo.style.display     = '';
    if (sdLock)   sdLock.style.display   = 'inline-flex';
  }
}

