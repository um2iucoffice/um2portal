// ── Populate dashboard ────────────────────────────────────────
function populate(s, grades, courses, program_meta, enrollments, academicYears, markbook) {
  if (!s) throw new Error('Student data is null or undefined — the server may have returned an empty profile.');
  // ── Activate the right course catalog for this student's program ──
  // The server can send `courses` (course catalog) and `program_meta`
  // ({ label, yearOrder }) to fully describe any degree program.
  // If neither is provided, the built-in MBBS defaults are used.
  if (courses && Object.keys(courses).length > 0) {
    COURSES      = courses;          // replace active catalog
    window._COURSES = courses;       // legacy compat for renderGrades
  } else {
    COURSES      = COURSES_MBBS;
    window._COURSES = null;
  }
  if (program_meta && program_meta.label) {
    PROGRAM_META = {
      label:     program_meta.label,
      yearOrder: Array.isArray(program_meta.yearOrder) ? program_meta.yearOrder : []
    };
  } else {
    PROGRAM_META = PROGRAM_META_MBBS;
  }
  // ── Normalise raw SQL / Google Sheet column names → app field names ──
  s = normaliseStudent(s);
  grades = (grades || []).map(normaliseGradeRow);

  // normaliseStudent() already maps:
  //   year           → currentStatus
  //   status         → enrollmentStatus
  //   grad_status    → graduationStatus
  // No further overwriting needed here.
  const _rawGrad = s.graduationStatus || '';
  if (/^graduated$/i.test(_rawGrad.trim())) {
    s.graduationStatus = 'Graduated';
  } else if (/^active$/i.test((s.enrollmentStatus || '').trim())) {
    s.graduationStatus = 'In Progress';
  } else {
    s.graduationStatus = _rawGrad || '—';
  }
  s.graduationId     = s.graduation_id   || s.graduationId     || '';
  s.graduationDate   = s.graduation_date || s.graduationDate   || '';
  s.id               = s.id              || '';
  s.gpa              = s.gpa             || '';
  // ── End normalisation ──────────────────────────────────────

  const firstName = (s.fullName || '').split(' ')[0] || '—';
  const init = (s.fullName || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Home hero
  document.getElementById('welcomeName').textContent = s.fullName || firstName;
  document.getElementById('homeStudentId').textContent = s.id || '—';
  const _homeIdLbl = document.getElementById('homeIdLabel');
  // Will be correctly set below once _activeEnroll is resolved; placeholder for now
  if (_homeIdLbl) _homeIdLbl.textContent = 'Student ID';
  const homeAvatar = document.getElementById('homeAvatar');
  if (homeAvatar) { /* avatar removed */ }

  // Grades banner
  const gradesBanner = document.getElementById('gradesHeaderBanner');
  if (gradesBanner) {
    gradesBanner.style.display = 'flex';
    // gradesAvatar removed
    document.getElementById('gradesStudentName').textContent = s.fullName || '—';
    document.getElementById('gradesStudentId').textContent   = s.id || '—';
    // GPA is displayed only from the sheet/data source
  }

  document.getElementById('topbarEmail').textContent = s.id || '—';
  document.getElementById('profileName').textContent = s.fullName || '—';
  document.getElementById('profileNameMM').textContent = s.fullNameMM || '';
  document.getElementById('avatarInitials').textContent = init;

  // Populate sidebar user card
  const sbName = document.getElementById('sidebarName');
  const sbId   = document.getElementById('sidebarId');
  const sbAv   = document.getElementById('sidebarAvatar');
  if (sbName) sbName.textContent = s.fullName || '—';
  if (sbId)   sbId.textContent   = s.id || '—';
  if (sbAv)   sbAv.textContent   = init;
  // Populate mobile more menu
  const mobN = document.getElementById('mobMoreName'); if (mobN) mobN.textContent = s.fullName || '—';
  const mobI = document.getElementById('mobMoreId');   if (mobI) mobI.textContent = s.id || '—';

  // Activate dark dashboard background
  document.body.classList.add('dashboard-active');

  // Update print footer and @page attr with student ID
  const sid = s.id || '—';
  const sidSpan = document.getElementById('printFooterSID');
  if (sidSpan) sidSpan.textContent = sid;
  document.documentElement.setAttribute('data-sid', sid);
  document.documentElement.setAttribute('data-student-name', s.fullName || '');
  // ── Resolve active enrollment for profile/hero display ───────
  // Priority: first enrollment that is not graduated/completed (i.e. currently active).
  // If all are graduated (e.g. student finished both degrees), fall back to the last one.
  const _allEnrollments = enrollments || [];
  const _activeEnroll =
    _allEnrollments.find(e => !/graduated|completed/i.test(e.graduationStatus || '')) ||
    _allEnrollments[_allEnrollments.length - 1] ||
    null;

  // Derive display values from active enrollment where available, fall back to student row
  const _activeProgram      = (_activeEnroll && (_activeEnroll.programName || _activeEnroll.degreeProgramId)) || s.programName || s.program || '';
  const _activeStatus       = (_activeEnroll && _activeEnroll.currentYear)       || s.currentStatus    || '';
  const _activeEnrollStatus = (_activeEnroll && _activeEnroll.enrollmentStatus)  || s.enrollmentStatus || '';
  const _activeGradStatus   = (_activeEnroll && _activeEnroll.graduationStatus)  || s.graduationStatus || '';
  const _activeAdmission    = (_activeEnroll && _activeEnroll.admissionDate)     || s.admissionYear    || '';

  // isGraduated = true only if the active enrollment itself is graduated
  // (so a Bachelor-grad re-enrolled in Master is NOT treated as alumni)
  const isGraduated = /^graduated$/i.test((_activeGradStatus || '').trim());
  const idLabel     = isGraduated ? 'Alumni ID' : 'Student ID';
  // Update home hero ID label now that we know the correct value
  const _homeIdLblFinal = document.getElementById('homeIdLabel');
  if (_homeIdLblFinal) _homeIdLblFinal.textContent = idLabel;

  // Graduation fields — from active enrollment if graduated, else from student row
  const gradID   = (_activeEnroll && _activeEnroll.graduationId)   || s.graduationId   || s.graduation_id   || '';
  const gradDate = (_activeEnroll && _activeEnroll.graduationDate) || s.graduationDate || s.graduation_date || '';

  // ── Profile tags — reflect active enrollment ──────────────────
  const tags = document.getElementById('profileTags');
  tags.innerHTML = '';
  if (_activeStatus)       tags.innerHTML += `<span class="tag tag-r">${_activeStatus}</span>`;
  if (_activeEnrollStatus) tags.innerHTML += `<span class="tag tag-g">${_activeEnrollStatus}</span>`;
  if (_activeGradStatus)   tags.innerHTML += `<span class="tag tag-n">${_activeGradStatus}</span>`;
  // If multi-enrollment, also show a badge for the active degree level
  if (_allEnrollments.length > 1 && _activeEnroll) {
    const lvlMap = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD' };
    const lvlLabel = lvlMap[(_activeEnroll.degreeLevel || '').toLowerCase()] || '';
    if (lvlLabel) tags.innerHTML += `<span class="tag" style="background:rgba(139,26,46,0.1);color:var(--crimson);border:1px solid rgba(139,26,46,0.2)">${lvlLabel}</span>`;
  }

  // ── Profile card ─────────────────────────────────────────────
  const lblSID = document.getElementById('lblStudentID');
  if (lblSID) lblSID.textContent = idLabel;

  document.getElementById('infoID').textContent        = s.id               || '—';
  document.getElementById('infoBirth').textContent     = s.birthDate        || '—';
  document.getElementById('infoFather').textContent    = s.fatherName       || '—';
  document.getElementById('infoFatherMM').textContent  = s.fatherNameMM     || '—';
  document.getElementById('infoMother').textContent    = s.motherName       || '—';
  document.getElementById('infoMotherMM').textContent  = s.motherNameMM     || '—';
  document.getElementById('infoPhone').textContent     = s.phone            || '—';
  document.getElementById('infoEmail').textContent     = s.email            || '—';
  document.getElementById('infoAdmission').textContent = _activeAdmission   || '—';
  document.getElementById('infoStatus').textContent    = _activeStatus      || '—';
  document.getElementById('infoEnroll').textContent    = _activeEnrollStatus|| '—';
  document.getElementById('infoGrad').textContent      = _activeGradStatus  || '—';

  // Degree Program — show active enrollment's program
  const infoProgramEl = document.getElementById('infoProgram');
  if (infoProgramEl) infoProgramEl.textContent = _activeProgram || '—';
  const homeProgramEl = document.getElementById('homeProgramName');
  if (homeProgramEl) homeProgramEl.textContent = _activeProgram;

  // Show/hide graduation fields
  const cellGradID   = document.getElementById('cellGradID');
  const cellGradIDMY = document.getElementById('cellGradIDMY');
  const cellGradDate = document.getElementById('cellGradDate');
  const cellGradDateMY = document.getElementById('cellGradDateMY');
  if (cellGradID)     cellGradID.style.display     = isGraduated ? '' : 'none';
  if (cellGradIDMY)   cellGradIDMY.style.display   = isGraduated ? '' : 'none';
  if (cellGradDate)   cellGradDate.style.display   = isGraduated ? '' : 'none';
  if (cellGradDateMY) cellGradDateMY.style.display = isGraduated ? '' : 'none';
  const infoGradID   = document.getElementById('infoGradID');
  const infoGradIDMY = document.getElementById('infoGradIDMY');
  const infoGradDate = document.getElementById('infoGradDate');
  const infoGradDateMY = document.getElementById('infoGradDateMY');
  if (infoGradID)     infoGradID.textContent     = gradID   || '—';
  if (infoGradIDMY)   infoGradIDMY.textContent   = s.graduationIdMY || s.graduation_id_my || '—';
  if (infoGradDate)   infoGradDate.textContent   = gradDate || '—';
  if (infoGradDateMY) infoGradDateMY.textContent = s.graduationDateMY || s.graduation_date_my || '—';

  // ── ID Card tab label ─────────────────────────────────────────
  const navIdCard = document.getElementById('navIdCard');
  if (navIdCard) {
    const lbl = navIdCard.querySelector('.sbnav-label');
    if (lbl) lbl.textContent = isGraduated ? 'Alumni ID Card' : 'ID Card';
    else navIdCard.textContent = isGraduated ? 'Alumni ID Card' : 'ID Card';
  }
  const idCardTitle = document.getElementById('idCardPageTitle');
  const idCardSub   = document.getElementById('idCardPageSub');
  if (idCardTitle) idCardTitle.textContent = isGraduated ? 'Alumni ID Card' : 'Student ID Card';
  if (idCardSub)   idCardSub.textContent   = isGraduated
    ? 'Your official University of Medicine (2) alumni identification'
    : 'Your official University of Medicine (2) student identification';

  // ── Documents panel label ────────────────────────────────────
  const docConfirmTitle = document.getElementById('docConfirmTitle');
  const docConfirmDesc  = document.getElementById('docConfirmDesc');
  if (docConfirmTitle) docConfirmTitle.textContent = isGraduated ? 'Confirmation of Graduation' : 'Confirmation of Study';
  if (docConfirmDesc)  docConfirmDesc.textContent  = isGraduated
    ? 'Official letter confirming your graduation from the University of Medicine (2).'
    : 'Official letter confirming your current enrollment status at the University of Medicine (2).';

  // ── Grades header label ──────────────────────────────────────
  const gradesIdLbl = document.getElementById('gradesIdLabel');
  if (gradesIdLbl) gradesIdLbl.textContent = idLabel;

  // Store graduation data on window for use in print
  window._studentGraduated = isGraduated;
  window._studentGradID    = gradID;
  window._studentGradDate  = gradDate;
  window._studentIdLabel   = idLabel;
  window._studentProgram   = _activeProgram;


  // ── Store enrollments globally ───────────────────────────────
  window._enrollments    = (enrollments || []);
  window._academicYears  = (academicYears || []);
  window._markbook       = (markbook || []);
  // Store current student for Edit My Info
  window._currentStudent = s;
  window._currentStudentId = s.id || '';
  // If no enrollments returned from server, synthesise one from students row
  if (!window._enrollments.length) {
    window._enrollments = [{
      id: '',
      degreeProgramId: s.program || '',
      programName:     s.programName || s.program || '',
      degreeLevel:     s.degreeLevel || 'bachelor',
      currentYear:     s.currentStatus || '',
      enrollmentStatus: s.enrollmentStatus || '',
      gpa:             s.overallGPA || '',
      admissionDate:   '',
      graduationStatus: s.graduationStatus || '',
      graduationId:    s.graduationId || '',
      graduationDate:  s.graduationDate || '',
      thesisTitle:     '',
      supervisor:      '',
    }];
  }
  window._activeEnrollmentIndex = 0;

  // ── Academic Journey (home panel) ───────────────────────────
  renderJourney(window._enrollments);

  // ── Store grades/courses for tab switching ───────────────────
  window._allGrades  = grades;
  window._allCourses = courses;

  // ── Grades degree tabs ───────────────────────────────────────
  renderDegreeTabs(window._enrollments, grades, courses);

  // ── Document office cards ────────────────────────────────────
  renderDocCards(window._enrollments);
  renderCertCards(window._enrollments);

  // ── Render grades for the active (first) enrollment ─────────
  renderGrades(grades, s);
  window._student = s;
  checkEnrollmentEligibility(s);
  // ── Course Session Grid ──────────────────────────────────────
  renderCourseSession(s, grades, academicYears || []);
  // ── Markbook ─────────────────────────────────────────────────
  renderMarkbook(s, markbook || [], grades);
  renderNews(window._announcements || []);
  renderHomeNews(window._announcements || []);
  renderStudentOverview(s, grades, courses);
  if (s.photo) {
    updatePhotoInUI(s.photo);
    const preview = document.getElementById('profilePhotoPreview');
    if (preview) {
      const pImg = document.createElement('img');
      pImg.src = s.photo;
      pImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;pointer-events:none;user-select:none;-webkit-user-select:none';
      pImg.draggable = false;
      pImg.oncontextmenu = function(e){ e.preventDefault(); return false; };
      preview.innerHTML = '';
      preview.appendChild(pImg);
    }
    const removeBtn = document.getElementById('removePhotoBtn');
    if (removeBtn) removeBtn.style.display = 'inline-block';
  }
  populateIDCard(s, isGraduated, gradID, gradDate);

  // ── Generate secure QR code on ID card ──────────────────────
// Deferred so qr.js is guaranteed to be loaded regardless of script order
const _validThrough = isGraduated
  ? (gradDate ? gradDate.split('/').pop() || '—' : '—')
  : String(new Date().getFullYear() + 1);
const _qrStudent = s;

if (typeof generateIDCardQR === 'function') {
  generateIDCardQR(_qrStudent, _validThrough);
} else {
  window.addEventListener('load', function () {
    if (typeof generateIDCardQR === 'function') {
      generateIDCardQR(_qrStudent, _validThrough);
    }
  });
}