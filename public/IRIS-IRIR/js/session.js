// ── Auto-restore session on page load (3-minute TTL) ─────────
(function restoreSession() {
  const SESSION_TTL = 3 * 60 * 1000; // 3 minutes

  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem('iris_session'));
  } catch (e) {
    // Corrupted session data — clear it
    sessionStorage.removeItem('iris_session');
    return;
  }

  // ── Validate session object ──
  if (!saved || typeof saved !== 'object')                          return;
  if (!saved.savedAt || (Date.now() - saved.savedAt) > SESSION_TTL) return;
  if (!saved.studentData)                                           return;
  if (!saved.token || typeof saved.token !== 'string')              return;

  // ✅ SECURITY FIX: Original code checked for saved.password — passwords
  // must never be stored in sessionStorage. The check is removed here,
  // and auth.js no longer writes password into the session object.

  window._sessionToken = saved.token;

  try {
    window._announcements = saved.announcements || [];
    populate(
      saved.studentData,
      saved.grades        || [],
      saved.courses       || {},
      saved.program_meta  || null,
      saved.enrollments   || [],
      saved.academicYears || [],
      saved.markbook      || []
    );
  } catch (e) {
    console.error('Session restore populate() error:', e);
    // Clear broken session so user gets a clean login
    sessionStorage.removeItem('iris_session');
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  const dash = document.getElementById('dashboard');
  dash.style.display = '';
  setTimeout(() => { dash.classList.add('show'); _resolveInitialHash(); }, 100);

  // ── Init notification bell (delay so populate() sets _currentStudent first) ──
  if (typeof initNotifications === 'function') {
    setTimeout(() => {
      initNotifications('#notifMount').catch(e => console.warn('Notifications init failed:', e));
    }, 300);
  }
})();

// ── Helper: clear session on sign-out ────────────────────────
function clearSession() {
  try { sessionStorage.removeItem('iris_session'); } catch (e) {}
  window._sessionToken   = null;
  window._announcements  = [];
}