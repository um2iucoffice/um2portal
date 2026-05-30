// ══════════════════════════════════════
// Navigation, Filters, Toast, Modal, CSV Export, Drag-Drop
// ══════════════════════════════════════

// NAVIGATION & TABS
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// MOBILE SIDEBAR TOGGLE
// ══════════════════════════════════════════
function toggleMobSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('mob-open');
  if (isOpen) {
    sidebar.classList.remove('mob-open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('mob-open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function setMobNav(id) {
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('mbn-' + id);
  if (btn) btn.classList.add('active');
}

// ── History API: internal flag to prevent double-push on popstate ──
let _historyNavigating = false;

function showView(id, _fromHistory) {
  // Close mobile sidebar when navigating
  document.querySelector('.sidebar')?.classList.remove('mob-open');
  document.querySelector('.sidebar-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  showViewTitled(id);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const v = document.getElementById('view-' + id);
  if (v) v.classList.add('active');
  const ni = document.getElementById('nav-' + id);
  if (ni) ni.classList.add('active');
  // Sync bottom nav — map sub-views to their nearest bottom nav tab
  const mobNavMap = {
    dashboard: 'dashboard',
    students: 'students', profile: 'students',
    myProfile: 'myProfile',
    docOffice: 'docOffice',
    enroll: 'more', bulkEnroll: 'more', addStudent: 'more', bulkStudent: 'more',
    enrollPeriods: 'more', enrollRequests: 'more', grades: 'more', attendance: 'more',
    courses: 'more', bulkCourses: 'more', degrees: 'more', years: 'more',
    bulkYears: 'more', channels: 'more', lectureRooms: 'more', teachingSchedule: 'more',
    chronicles: 'more',
    userList: 'more', editRequests: 'more', notifications: 'more', setup: 'more',
  };
  setMobNav(mobNavMap[id] || 'more');
  if (id === 'setup') renderSchemaSQL();
  if (id === 'degrees') renderDegreeGrid();
  if (id === 'myProfile') loadStaffProfile();
  if (id === 'userList') loadUserList();
  if (id === 'chronicles') loadChronicles();
  if (id === 'teachingSchedule') { loadStaffProfile(); renderTimetableList(); renderBookedSchedule(); }
  if (id === 'enrollPeriods') initEnrollPeriodsView();
  if (id === 'enrollRequests') initEnrollRequestsView();
  window.scrollTo(0, 0);

  // ── History API: push state unless this call came from popstate ──
  if (!_fromHistory) {
    const url = '#' + id;
    if (window.location.hash !== url) {
      history.pushState({ view: id }, '', url);
    }
  }
}

// Handle browser Back / Forward
window.addEventListener('popstate', function(e) {
  const id = (e.state && e.state.view) || (window.location.hash.slice(1)) || 'dashboard';
  showView(id, true);
});

function switchTab(tabId, btn) {
  const panel = document.getElementById(tabId);
  if (!panel) return;
  panel.closest('.view').querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
  if (btn) {
    btn.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  }
}

// Dashboard Quick Access tabs
function switchDashTab(tab, btn) {
  if (btn) {
    btn.closest('.tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  }
  document.getElementById('dash-panel-actions').style.display  = tab === 'actions'  ? '' : 'none';
  document.getElementById('dash-panel-activity').style.display = tab === 'activity' ? '' : 'none';
}

// ══════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════
function filterStudents(q) {
  const yearFilter    = document.getElementById('studentYearFilter').value;
  const statusFilter  = document.getElementById('studentStatusFilter').value;
  const programFilter = (document.getElementById('studentProgramFilter') || {}).value || '';
  const query = (q !== undefined ? q : (document.getElementById('studentSearchInput')?.value || '')).toLowerCase();
  const filtered = students.filter(s => {
    const matchQ = !query        || (s.name_en + (s.name_my||'') + s.id + s.email).toLowerCase().includes(query);
    const matchY = !yearFilter   || s.year    === yearFilter;
    const matchS = !statusFilter || s.status  === statusFilter;
    const matchP = !programFilter|| (s.program || '') === programFilter;
    return matchQ && matchY && matchS && matchP;
  });
  renderStudentTable(filtered);
}

function filterCourses(q) {
  const yearFilter = document.getElementById('courseYearFilter').value;
  const query = (q !== undefined ? q : (document.getElementById('courseSearchInput')?.value || '')).toLowerCase();
  document.querySelectorAll('#coursesBody tr').forEach(r => {
    const matchQ = r.textContent.toLowerCase().includes(query);
    const matchY = !yearFilter || r.textContent.includes(yearFilter);
    r.style.display = (matchQ && matchY) ? '' : 'none';
  });
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function toast(msg, icon = '🔔') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'notif-toast';
  t.innerHTML = `<div class="notif-title">${icon} System</div><div class="notif-body">${msg}</div>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

// ══════════════════════════════════════════
// MODAL CLOSE
// ══════════════════════════════════════════
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ══════════════════════════════════════════
// CSV TEMPLATES & EXPORT
// ══════════════════════════════════════════
function downloadCSV(filename, content) {
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename; a.click();
}

function downloadGradeTemplate() {
  downloadCSV('grade_upload_template.csv', 'StudentID,CourseID,NumericScore,Year,Attempt\nSTU001,CRS015,81.38,2025,1st Attempt\nSTU001,CRS016,75.50,2025,2nd Attempt');
}

function downloadEnrollTemplate() {
  downloadCSV('bulk_enrollment_template.csv', 'student_id,year_id,enrollment_status,graduation_status,gender,notes\nSTU001,M-1,Active,In Progress,Male,Promoted from Foundation Year\nSTU002,Foundation Year,Active,In Progress,Female,New intake 2025');
}

function downloadStudentTemplate() {
  downloadCSV('bulk_student_import_template.csv', 'student_id,full_name_en,full_name_my,gender,father_name_en,father_name_my,mother_name_en,mother_name_my,birth_date,email,phone,address,admission_year,current_year,program_id,enrollment_status,graduation_status,graduation_id,graduation_date,master_password\nSTU001,New Student,,Male,U Father Name,,Daw Mother Name,,2001-01-01,new@email.com,,Yangon,1/2025,Foundation Year,MBBS,Active,In Progress,,,MySecurePass1\nSTU002,Second Student,,Female,U Father Two,,Daw Mother Two,,2001-06-15,second@email.com,,Mandalay,1/2025,M-1,MBBS,Active,In Progress,,,');
}

function exportStudentsCSV() {
  let csv = 'student_id,full_name_en,full_name_my,father_name_en,email,phone,birth_date,address,admission_year,current_year,program,status,gpa\n';
  students.forEach(s => { csv += `${s.id},${s.name_en},${s.name_my||''},${s.father||''},${s.email},${s.phone||''},${s.dob||''},${s.address||''},${s.admission||''},${s.year},${s.program},${s.status},${s.gpa}\n`; });
  downloadCSV('students_export.csv', csv);
  toast('Students exported to CSV.', '↓');
}

function exportCoursesCSV() {
  let csv = 'course_id,course_name,year,block_module,credits,assessment_type\n';
  courses.forEach(c => { csv += `${c[0]},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]}\n`; });
  downloadCSV('courses_export.csv', csv);
  toast('Courses exported to CSV.', '↓');
}

// ══════════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════════
function setupDropZone(zoneId, inputId, handler) {
  const dz = document.getElementById(zoneId);
  if (!dz) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag');
    if (e.dataTransfer.files.length) handler({ files: e.dataTransfer.files });
  });
}
// Defer drop zone wiring until all scripts are loaded so the handler
// functions (handleGradeCSV, handleBulkEnrollCSV, etc.) are defined.
document.addEventListener('DOMContentLoaded', function () {
  setupDropZone('dropZone',            'csvFile',             handleGradeCSV);
  setupDropZone('enrollDropZone',      'enrollCSVFile',       handleBulkEnrollCSV);
  setupDropZone('studentDropZone',     'studentCSVFile',      handleBulkStudentCSV);
  setupDropZone('yearDropZone',        'yearCSVFile',         handleBulkYearCSV);
  setupDropZone('attendanceDropZone',  'attendanceCSVFile',   handleAttendanceCSV);
  setupDropZone('courseDropZone',      'courseCSVFile',       handleBulkCourseCSV);
});