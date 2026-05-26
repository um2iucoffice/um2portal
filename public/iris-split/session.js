// ── Auto-restore session on page load (3-minute TTL) ─────────
(function restoreSession() {
  const SESSION_TTL = 3 * 60 * 1000; // 3 minutes
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem('iris_session')); } catch(e) {}
  if (!saved || !saved.savedAt || (Date.now() - saved.savedAt) > SESSION_TTL) return;
  if (!saved.studentData || !saved.password) return;

  window._sessionToken = saved.token;
  try {
    window._announcements = saved.announcements || [];
    populate(saved.studentData, saved.grades || [], saved.courses || {}, saved.program_meta || null, saved.enrollments || [], saved.academicYears || [], saved.markbook || []);
  } catch(e) { console.error('Session restore populate() error:', e); return; }

  document.getElementById('loginScreen').classList.add('hidden');
  const dash = document.getElementById('dashboard');
  dash.style.display = '';
  setTimeout(() => { dash.classList.add('show'); _resolveInitialHash(); }, 100);
})();

