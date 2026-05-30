// ══════════════════════════════════════
// Enrollment
// ══════════════════════════════════════

// ══════════════════════════════════════════
// ENROLLMENT
// ══════════════════════════════════════════
function lookupStudentForEnroll(sid) {
  const s = students.find(x => x.id === sid.trim());
  document.getElementById('en-name').value = s ? s.name_en : '';
}

async function saveEnrollment() {
  const sid = document.getElementById('en-sid').value.trim();
  const s = students.find(x => x.id === sid);
  if (!sid) { toast('Please enter a Student ID.', 'Notice'); return; }
  if (!s) { toast('Student ID not found.', '❌'); return; }

  const yearId = document.getElementById('en-year').value;
  const enrollStatus = document.getElementById('en-status').value;
  const gradStatus = document.getElementById('en-grad').value;
  const effDate = getDateValue('en-date') || null;
  const notes = document.getElementById('en-notes').value.trim();
  const programId  = (document.getElementById('en-program') || {}).value || (s.program || 'MBBS');
  const gradId     = (document.getElementById('en-gradId')    || {}).value?.trim() || null;
  const gradIdMy   = (document.getElementById('en-gradIdMy')  || {}).value?.trim() || null;
  const gradDate   = getDateValue('en-gradDate') || null;
  const gradDateMy = (document.getElementById('en-gradDateMy')|| {}).value?.trim() || null;

  const { error: enrollErr } = await db.from('enrollments').insert({
    student_id: sid, year_id: yearId, enrollment_status: enrollStatus,
    graduation_status: gradStatus, effective_date: effDate, notes,
    program_id: programId
  });
  if (enrollErr) { toast('Enrollment save failed: ' + enrollErr.message, 'DB Error'); return; }

  // Build student update — always sync year/status/program; also sync graduation fields if graduating
  const stuUpdates = { year: yearId, status: enrollStatus, program: programId };
  if (gradStatus === 'Graduated') {
    stuUpdates.grad_status    = 'Graduated';
    if (gradId)     stuUpdates.graduation_id     = gradId;
    if (gradIdMy)   stuUpdates.graduation_id_my  = gradIdMy;
    if (gradDate)   stuUpdates.graduation_date   = gradDate;
    if (gradDateMy) stuUpdates.graduation_date_my = gradDateMy;
  }
  const { error: stuErr } = await db.from('students').update(stuUpdates).eq('id', sid);
  if (!stuErr) {
    Object.assign(s, stuUpdates);
    renderStudentTable(students);
    // Refresh profile if currently viewing this student
    if (typeof currentProfileId !== 'undefined' && currentProfileId === sid) showProfile(sid);
  }

  if (!enrollHistory[sid]) enrollHistory[sid] = [];
  enrollHistory[sid].push({ program: programId, year: yearId, status: enrollStatus, gpa: (Number(s.gpa) || 0).toFixed(1), grad: gradStatus, notes });

  await logEmail(s.email, sid, '[UM2] Your enrollment has been updated', 'Enrollment update');
  toast(`Enrollment updated for ${s.name_en}. Email notification queued.`, '✓');
  clearEnrollForm();
}

function clearEnrollForm() {
  ['en-sid','en-name','en-notes','en-gradId','en-gradIdMy','en-gradDate','en-gradDateMy'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const d = document.getElementById('en-date'); if (d) d.value = '';
  const g = document.getElementById('en-grad'); if (g) g.value = 'In Progress';
  const gig  = document.getElementById('en-gradIdGroup');    if (gig)  gig.style.display  = 'none';
  const gimy = document.getElementById('en-gradIdMyGroup');  if (gimy) gimy.style.display = 'none';
  const gdg  = document.getElementById('en-gradDateGroup');  if (gdg)  gdg.style.display  = 'none';
  const gdmy = document.getElementById('en-gradDateMyGroup'); if (gdmy) gdmy.style.display = 'none';
}

// BULK ENROLLMENT
function handleBulkEnrollCSV(input) {
  const file = input.files ? input.files[0] : input[0];
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (results) => {
      bulkEnrollRows = results.data;
      document.getElementById('enrollPreviewCount').textContent = bulkEnrollRows.length;
      const pt = document.getElementById('enrollPreviewTable');
      pt.innerHTML = `<thead><tr><th>Student ID</th><th>Student Name</th><th>Year</th><th>Enrollment Status</th><th>Graduation Status</th><th>Gender</th><th>Notes</th><th>Validation</th></tr></thead>`;
      let body = '<tbody>';
      bulkEnrollRows.forEach(row => {
        const sid = row.student_id || '';
        const s = students.find(x => x.id === sid);
        const valid = !!s;
        const genderVal = (row.gender || '').trim();
        const genderDisplay = genderVal === 'Male' ? '<span class="badge b-blue">Male</span>'
          : genderVal === 'Female' ? '<span class="badge b-gold">Female</span>'
          : '<span style="color:var(--ink3);font-size:11px">—</span>';
        body += `<tr class="${valid ? 'bulk-row-ok' : 'bulk-row-err'}">
          <td class="text-mono">${sid}</td><td>${s ? s.name_en : '—'}</td>
          <td><span class="badge b-blue">${row.year_id||''}</span></td>
          <td>${row.enrollment_status||'Active'}</td><td>${row.graduation_status||'In Progress'}</td>
          <td>${genderDisplay}</td>
          <td class="text-muted">${row.notes||''}</td>
          <td>${valid ? '<span class="badge b-green">✓ Valid</span>' : '<span class="badge b-red">✗ Not found</span>'}</td>
        </tr>`;
      });
      pt.innerHTML += body + '</tbody>';
      document.getElementById('enrollPreviewArea').style.display = 'block';
    }
  });
}

async function submitBulkEnroll() {
  document.getElementById('enrollPreviewArea').style.display = 'none';
  const rc = document.getElementById('enrollResultCard');
  const rt = document.getElementById('enrollResultTable');
  let ok = 0, err = 0;
  rt.innerHTML = `<thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Status</th><th>Email</th></tr></thead>`;
  let body = '<tbody>';

  for (const row of bulkEnrollRows) {
    const sid = row.student_id || '';
    const s = students.find(x => x.id === sid);
    if (!s) {
      err++;
      body += `<tr class="bulk-row-err"><td class="text-mono">${sid}</td><td>—</td><td>—</td><td>—</td><td><span class="badge b-red">✗ Not found</span></td></tr>`;
      continue;
    }
    const { error } = await db.from('enrollments').insert({
      student_id: sid, year_id: row.year_id||s.year,
      enrollment_status: row.enrollment_status||'Active',
      graduation_status: row.graduation_status||'In Progress',
      notes: row.notes||''
    });
    if (error) {
      err++;
      body += `<tr class="bulk-row-err"><td class="text-mono">${sid}</td><td>${s.name_en}</td><td>—</td><td>—</td><td><span class="badge b-red">✗ DB Error</span></td></tr>`;
    } else {
      ok++;
      s.year = row.year_id || s.year;
      s.status = row.enrollment_status || s.status;
      const enrollUpdate = { year: s.year, status: s.status };
      const rowGender = (row.gender || '').trim();
      if (rowGender) { s.gender = rowGender; enrollUpdate.gender = rowGender; }
      await db.from('students').update(enrollUpdate).eq('id', sid);
      await logEmail(s.email, sid, '[UM2] Your enrollment has been updated', 'Bulk enrollment');
      body += `<tr class="bulk-row-ok"><td class="text-mono text-crimson">${sid}</td><td>${s.name_en}</td><td><span class="badge b-blue">${row.year_id}</span></td><td><span class="badge b-green">${row.enrollment_status||'Active'}</span></td><td><span class="badge b-green">✓ Queued</span></td></tr>`;
    }
  }
  rt.innerHTML += body + '</tbody>';
  rc.style.display = 'block';
  const bar = document.getElementById('enrollProgressBar');
  bar.style.width = '0';
  setTimeout(() => bar.style.width = (bulkEnrollRows.length ? ok/bulkEnrollRows.length*100 : 0) + '%', 100);
  renderStudentTable(students);
  toast(`✅ ${ok} enrollments updated. ${err} errors.`, '📋');
}

// ══════════════════════════════════════════
