// ══════════════════════════════════════
// Load All Data from Supabase
// ══════════════════════════════════════

// LOAD ALL DATA FROM SUPABASE
// ══════════════════════════════════════════
async function populateTables() {
  // Paginated grade fetch — Supabase has a 1000-row default limit.
  // Fetch all pages (1000 rows each) until no more rows are returned.
  async function fetchAllGrades() {
    const PAGE = 1000;
    let allRows = [], from = 0, done = false;
    while (!done) {
      const { data, error } = await db.from('grades').select('*').range(from, from + PAGE - 1);
      if (error) return { data: null, error };
      allRows = allRows.concat(data || []);
      done = !data || data.length < PAGE;
      from += PAGE;
    }
    return { data: allRows, error: null };
  }

  const [
    { data: studentData,    error: sErr },
    { data: attData,        error: aErr },
    { data: courseData,     error: cErr },
    { data: gradeRows,      error: gErr },
    { data: enrollData,     error: eErr },
    { data: degreeData,     error: dErr },
    { data: cpData,         error: cpErr },
  ] = await Promise.all([
    db.from('students').select('id,name_en,name_my,father,father_my,mother,mother_my,dob,email,phone,address,admission,year,program,degree_level,supervisor,thesis_title,status,gpa,grad_status,graduation_id,graduation_id_my,graduation_date,graduation_date_my,photo,gender,updated_at').order('id'),
    db.from('attendance').select('*').order('session_date', { ascending: false }),
    db.from('courses').select('*').order('id'),
    fetchAllGrades(),
    db.from('enrollments').select('*').order('created_at'),
    db.from('degree_programs').select('*').order('id'),
    db.from('course_programs').select('course_id,program_id'),
  ]);

  if (sErr) {
    toast('⚠ Could not load students: ' + sErr.message, '⚠');
  } else {
    students = (studentData || []).map(s => ({
      ...s,
      name_my:   s.name_my   || '',
      father_my: s.father_my || '',
      father:    s.father    || '',
      mother:    s.mother    || '',
      mother_my: s.mother_my || '',
      phone:     s.phone     || '',
      address:   s.address   || '',
      admission: s.admission || '',
      dob:       s.dob       || '',
    }));
  }

  if (aErr) { toast('⚠ Could not load attendance: ' + aErr.message, '⚠'); }
  else { attendanceRecords = (attData || []).map(normalizeAttRecord); }

  if (cErr) { toast('⚠ Could not load courses: ' + cErr.message, '⚠'); }
  else { courses = (courseData || []).map(c => [c.id, c.name, c.year, c.block_module, c.credits, c.assessment_type]); }

  if (gErr) { toast('⚠ Could not load grades: ' + gErr.message, '⚠'); }
  else {
    gradeData = {};
    (gradeRows || []).forEach(g => {
      // Postgres lowercases all column names. Support all variants:
      // schema columns: student_id | legacy camelCase written as: StudentID → stored as studentid
      const key = g.student_id || g.StudentID || g.studentid;
      if (!key) return;
      if (!gradeData[key]) gradeData[key] = [];
      gradeData[key].push(g);
    });
    normalizeGradeData();
  }

  if (eErr) toast('Failed to load enrollments: ' + eErr.message, 'DB Error');
  else {
    enrollHistory = {};
    (enrollData || []).forEach(e => {
      if (!enrollHistory[e.student_id]) enrollHistory[e.student_id] = [];
      enrollHistory[e.student_id].push({
        program: e.program_id || '—', year: e.year_id, status: e.enrollment_status,
        gpa: '—', grad: e.graduation_status, notes: e.notes || ''
      });
    });
  }

  // Load degree programs from Supabase (merge with in-memory defaults)
  if (!dErr && degreeData && degreeData.length) {
    degreePrograms = degreeData;
  }

  // Build coursePrograms map from junction table
  coursePrograms = {};
  if (!cpErr && cpData) {
    cpData.forEach(r => {
      if (!coursePrograms[r.course_id]) coursePrograms[r.course_id] = [];
      coursePrograms[r.course_id].push(r.program_id);
    });
  }

  // Load email log
  const { data: emailData } = await db
    .from('email_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50);
  if (emailData && typeof renderEmailLog === 'function') renderEmailLog(emailData);

  renderStudentTable(students);
  renderAttendanceTable();
  populateAttendanceStudentFilters();
  renderCoursesTable();
  updateDashboardStats();
  await loadAcademicYears();
  await loadChannels();
  await loadLectureRooms();
  await loadChronicles();
}

function normalizeAttRecord(r) {
  return {
    student_id:   r.student_id,
    lecture_name: r.lecture_name,
    session_date: r.session_date,
    session_from: (r.session_from || '').slice(0, 5),
    session_till: r.session_till ? r.session_till.slice(0, 5) : null,
    status:       r.status,
    remarks:      r.remarks || '',
    _db_id:       r.id
  };
}

function updateDashboardStats() {
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const gradeCount = Object.values(gradeData).reduce((s, a) => s + a.length, 0);
  setText('dashStudentCount', students.length);
  setText('dashStudentDelta', students.length > 0 ? `↑ ${students.length} enrolled` : 'No students yet');
  setText('dashCourseCount', courses.length);
  setText('dashGradeCount', gradeCount);
  setText('studentCount', students.length);
  setText('mbbsStudentCount', students.length);
}
