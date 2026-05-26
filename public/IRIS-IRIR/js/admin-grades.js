// ══════════════════════════════════════
// Upload Overlay, Grade Helpers, Burmese Date, Grade CSV, Edit/Delete
// ══════════════════════════════════════

// ══════════════════════════════════════════
// UPLOAD OVERLAY HELPERS
// ══════════════════════════════════════════
function showUploadOverlay(title, sub) {
  const ov = document.getElementById('uploadOverlay');
  const bar = document.getElementById('uploadOverlayBar');
  document.getElementById('uploadOverlayTitle').textContent = title || 'Uploading…';
  document.getElementById('uploadOverlaySub').textContent   = sub   || 'Please wait — do not close this page';
  if (bar) bar.style.width = '0';
  ov.classList.add('active');
}

function updateUploadOverlay(pct, sub) {
  const bar = document.getElementById('uploadOverlayBar');
  if (bar) bar.style.width = pct + '%';
  if (sub) document.getElementById('uploadOverlaySub').textContent = sub;
}

function hideUploadOverlay() {
  document.getElementById('uploadOverlay').classList.remove('active');
}

// ══════════════════════════════════════════
// GRADE HELPERS
// ══════════════════════════════════════════
function computeGradePoint(score) {
  if (score >= 75) return { gp: 4.0, letter: 'A+' };
  if (score >= 70) return { gp: 3.7, letter: 'A' };
  if (score >= 65) return { gp: 3.7, letter: 'A-' };
  if (score >= 60) return { gp: 3.3, letter: 'B+' };
  if (score >= 55) return { gp: 3.0, letter: 'B' };
  if (score >= 50) return { gp: 2.7, letter: 'B-' };
  return { gp: 0.0, letter: 'F' };
}

// ══════════════════════════════════════════
// BURMESE DATE HELPER
// ══════════════════════════════════════════
const MY_MONTHS = [
  'ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်',
  'ဇူလိုင်','သြဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ'
];
const MY_DIGITS = ['၀','၁','၂','၃','၄','၅','၆','၇','၈','၉'];

function toMyDigits(n) {
  return String(n).replace(/[0-9]/g, d => MY_DIGITS[+d]);
}

// Convert ISO date string "YYYY-MM-DD" → Burmese formatted date e.g. "၂၀၂၆ ခုနှစ် မေလ ၁၀ ရက်"
function toBurmeseDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${toMyDigits(y)} ခုနှစ် ${MY_MONTHS[m-1]}လ ${toMyDigits(d)} ရက်`;
}

// Auto-fill Burmese date field when the date input changes
// ── SMART DATE INPUT (DD/MM/YYYY → YYYY-MM-DD) ──
// Converts user-typed DD/MM/YYYY into the YYYY-MM-DD value stored in dataset
// so all existing code that reads .value still gets YYYY-MM-DD format
function smartDate(el) {
  let v = el.value.replace(/[^\d]/g, ''); // strip non-digits
  // Auto-insert slashes
  if (v.length > 2)  v = v.slice(0,2) + '/' + v.slice(2);
  if (v.length > 5)  v = v.slice(0,5) + '/' + v.slice(5,9);
  el.value = v;
  // Parse and store ISO value in dataset for reading by other functions
  const parts = v.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const [d, m, y] = parts;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const date = new Date(iso);
    if (!isNaN(date.getTime())) {
      el.dataset.isoValue = iso;
      el.style.borderColor = 'var(--green)';
    } else {
      el.dataset.isoValue = '';
      el.style.borderColor = 'var(--crimson)';
    }
  } else {
    el.dataset.isoValue = '';
    el.style.borderColor = '';
  }
}

// Helper: get ISO date value from a smart date field
function getDateValue(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  // If it has a dataset.isoValue (from smartDate), use that
  if (el.dataset.isoValue) return el.dataset.isoValue;
  // Fallback: if value looks like YYYY-MM-DD already (loaded from DB), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return el.value;
  return el.value || null;
}

// Helper: set a smart date field from a YYYY-MM-DD string (e.g. loading from DB)
function setDateValue(id, isoVal) {
  const el = document.getElementById(id);
  if (!el || !isoVal) return;
  const parts = isoVal.split('-'); // YYYY-MM-DD
  if (parts.length === 3) {
    el.value = `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
    el.dataset.isoValue = isoVal;
  } else {
    el.value = isoVal;
  }
}

function autoFillBurmeseDate(dateInputId, burmeseDateInputId) {
  const iso = getDateValue(dateInputId);
  const el  = document.getElementById(burmeseDateInputId);
  if (el && iso) el.value = toBurmeseDate(iso);
}

function formatGradeLetter(letter) {
  return String(letter || '').replace(/\+/g, '<sup>+</sup>').replace(/-/g, '<sup>−</sup>');
}

function gradeBadgeClass(letter) {
  if (['A+','A','A-'].includes(letter)) return 'b-green';
  if (['B+','B','B-'].includes(letter)) return 'b-blue';
  return 'b-red';
}

// Grade ID: 8 chars, letters and digits randomly mixed, e.g. "A3F1B9K2"
function autoGradeId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// Stable grade ID: deterministic key from student+course+attempt.
// Format: {studentId}-{courseId}-{attemptNumber}
// e.g. IUC125044-CRS002-A1  (A1=1st, A2=2nd, A3=3rd attempt)
// Guaranteed unique per student+course+attempt — no hashing, no collisions.
function stableGradeId(sid, cid, attempt, year) {
  const attemptNum = { '1st Attempt':'A1','2nd Attempt':'A2','3rd Attempt':'A3',
                       '4th Attempt':'A4','5th Attempt':'A5' };
  const aN  = attemptNum[attempt] || attempt.replace(/[^0-9]/g,'') || 'A1';
  const yr  = (year || 'NOYEAR').toString().trim().toUpperCase();
  const sNum = sid.replace(/^[a-zA-Z]+/, '');
  const cNum = cid.replace(/^[a-zA-Z]+/, '');
  return (sNum + '-' + (cNum || 'UNK') + '-' + aN + '-' + yr).toUpperCase();
}

function normalizeGradeData() {
  Object.keys(gradeData).forEach(sid => {
    (gradeData[sid] || []).forEach(g => {
      // Normalize all column name variants regardless of what DB returned
      // student_id (schema) vs StudentID (old camelCase) vs studentid (pg-lowercased camelCase)
      if (!g.student_id) g.student_id = g.StudentID || g.studentid || sid;
      // course_id (schema) vs CourseID / courseid
      if (!g.course_id) g.course_id = g.CourseID || g.courseid || '';
      // score (new schema) vs NumericScore (old) vs numericscore (pg-lowercased)
      if (g.score == null) g.score = g.NumericScore ?? g.numericscore ?? null;
      // ensure id is always a string
      if (g.id) g.id = String(g.id);

      const rawScore = g.score ?? g.NumericScore ?? g.numericscore ?? 0;
      const c = computeGradePoint(Number(rawScore));
      g.letter = c.letter;
      g.gp     = c.gp;
    });
  });
}

function recalcStudentGpa(sid) {
  const grades = gradeData[sid] || [];
  if (!grades.length) return;

  // Credit-weighted GPA if course credits exist, otherwise simple average
  const totalCredits = grades.reduce((sum, g) => {
    const cid = g.course_id || g.CourseID || g.courseid;
    const course = courses.find(c => c[0] === cid);
    return sum + (course ? Number(course[4]) || 0 : 0);
  }, 0);

  let avg;
  if (totalCredits > 0) {
    const weighted = grades.reduce((sum, g) => {
      const cid = g.course_id || g.CourseID || g.courseid;
      const course = courses.find(c => c[0] === cid);
      const credits = course ? Number(course[4]) || 0 : 0;
      return sum + (Number(g.gp) * credits);
    }, 0);
    avg = weighted / totalCredits;
  } else {
    avg = grades.reduce((s, g) => s + Number(g.gp), 0) / grades.length;
  }

  // GPA is managed in the students table directly — recalc disabled
  renderStudentTable(students);
}

// ══════════════════════════════════════════
// GRADE CSV UPLOAD
// ══════════════════════════════════════════
function handleGradeCSV(input) {
  const file = input.files ? input.files[0] : input[0];
  if (!file) return;
  if (students.length === 0) {
    toast('⚠ Student data not loaded yet. Please wait for the page to finish loading, or click Refresh Data, then try again.', '⚠');
    return;
  }
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (results) => {
      gradeCSVRows = results.data;
      const preview = document.getElementById('csvPreviewTable');
      const fallbackAttempt = document.getElementById('grade-attempt').value;
      const fallbackYear    = (document.getElementById('grade-year').value || '').trim();

      // Validate every row up-front
      let validCount = 0, errorCount = 0;
      let body = '<tbody>';
      gradeCSVRows.forEach((row, idx) => {
        const score = parseFloat(row.NumericScore || row.numericscore || row.numeric_score || 0);
        const { gp, letter } = computeGradePoint(score);
        const sid         = (row.StudentID || row.studentid || row.student_id || '').trim();
        const cid         = (row.CourseID  || row.courseid  || row.course_id  || '').trim();
        // Per-row Year/Attempt from CSV override the UI fields (migration support)
        const rowAttempt  = (row.Attempt || row.attempt || '').trim() || fallbackAttempt;
        const rowYear     = (row.Year    || row.year    || '').trim() || fallbackYear || '—';
        const gid = stableGradeId(sid, cid, rowAttempt, rowYear);
        const studentMatch = students.find(s => s.id.toLowerCase() === sid.toLowerCase());
        const courseMatch  = courses.find(c => c[0].toLowerCase() === cid.toLowerCase());
        const stuStatus = studentMatch
          ? '<span class="badge b-green">✓ Valid</span>'
          : '<span class="badge b-red">✗ Student not found</span>';
        const crsWarn = cid && !courseMatch
          ? ' <span class="badge b-gold" title="Course not in catalogue — grade will still save">⚠ Course unknown</span>'
          : '';
        if (studentMatch) validCount++; else errorCount++;
        body += `<tr class="${studentMatch ? '' : 'bulk-row-err'}">
          <td style="color:var(--ink3);font-size:11px">${idx+1}</td>
          <td class="text-mono">${sid||'<span class=\"text-crimson\">(blank)</span>'}</td>
          <td class="text-mono">${cid||'—'}</td>
          <td>${score}</td>
          <td><span class="badge b-blue">${rowAttempt}</span></td>
          <td class="text-mono" style="font-size:11px;color:var(--ink3)">${rowYear}</td>
          <td class="text-mono text-crimson" style="font-size:11px">${gid}</td>
          <td><span class="badge ${gradeBadgeClass(letter)}">${formatGradeLetter(letter)}</span></td>
          <td><strong class="text-green">${gp.toFixed(1)}</strong></td>
          <td>${stuStatus}${crsWarn}</td>
        </tr>`;
      });

      document.getElementById('gradePreviewCount').textContent = gradeCSVRows.length;
      // Update preview header badges
      const okBadge  = document.getElementById('gradePreviewOk');
      const errBadge = document.getElementById('gradePreviewErr');
      if (okBadge)  okBadge.textContent  = validCount + ' ready';
      if (errBadge) errBadge.textContent = errorCount + ' errors';

      preview.innerHTML = `<thead><tr>
        <th>#</th><th>Student ID</th><th>Course ID</th><th>Score</th>
        <th>Attempt</th><th>Year</th><th>Grade ID (auto)</th><th>Letter</th><th>GP</th><th>Status</th>
      </tr></thead>`;
      preview.innerHTML += body + '</tbody>';
      document.getElementById('csvPreviewArea').style.display = 'block';
    }
  });
}

async function submitGrades() {
  if (students.length === 0) {
    toast('⚠ Student data not loaded. Please refresh data before submitting grades.', '⚠');
    return;
  }
  const gradeYear = (document.getElementById('grade-year').value || '').trim();
  if (!gradeYear) {
    toast('⚠ Please enter an Academic Year before uploading grades.', '⚠');
    document.getElementById('grade-year').focus();
    return;
  }
  document.getElementById('csvPreviewArea').style.display = 'none';

  // ── Show blocking overlay ──
  showUploadOverlay(
    `Uploading ${gradeCSVRows.length} Grade${gradeCSVRows.length !== 1 ? 's' : ''}…`,
    'Processing row 0 of ' + gradeCSVRows.length
  );

  const rc = document.getElementById('gradeResultCard');
  const rt = document.getElementById('gradeResultTable');
  rt.innerHTML = `<thead><tr><th>Row</th><th>Student</th><th>Course</th><th>Score</th><th>Attempt</th><th>Year</th><th>GradeID</th><th>Letter</th><th>GradePoint</th><th>DB</th></tr></thead>`;
  let body = '<tbody>';
  let okCount = 0, errCount = 0;
  const notifiedStudents = new Set();
  const uploadedBy = currentUser?.staff_id || '—';
  const uploadAttempt = document.getElementById('grade-attempt').value;

  // ── Detect available columns once per session, then cache in sessionStorage ──
  // This avoids 7 sequential network round-trips on every upload.
  if (_gradesColumns === null) {
    const cached = sessionStorage.getItem('_gradesColumns');
    if (cached) {
      const parsed = JSON.parse(cached);
      _gradesColumns = { ...parsed, extras: new Set(parsed.extras) };
    } else {
      _gradesColumns = { scoreCol: null, sidCol: null, cidCol: null, extras: new Set() };
      const [scoreRes, sidRes, cidRes, ...extraRes] = await Promise.all([
        db.from('grades').select('id,score').limit(0),
        db.from('grades').select('id,student_id').limit(0),
        db.from('grades').select('id,course_id').limit(0),
        ...['course','attempt','year','uploaded_by','updated_at'].map(col =>
          db.from('grades').select('id,' + col).limit(0).then(r => ({ col, error: r.error }))
        )
      ]);
      _gradesColumns.scoreCol = scoreRes.error ? 'NumericScore' : 'score';
      _gradesColumns.sidCol   = sidRes.error   ? 'StudentID'    : 'student_id';
      _gradesColumns.cidCol   = cidRes.error   ? 'CourseID'     : 'course_id';
      for (const { col, error } of extraRes) { if (!error) _gradesColumns.extras.add(col); }
      // Persist for the rest of this browser session
      sessionStorage.setItem('_gradesColumns', JSON.stringify({
        ..._gradesColumns, extras: [..._gradesColumns.extras]
      }));
    }
    const warn = document.getElementById('gradeSchemaWarning');
    if (warn) warn.style.display = (_gradesColumns.cidCol === 'CourseID' || !_gradesColumns.extras.has('attempt')) ? '' : 'none';
  }
  
  const validRecords = [];

  for (const [i, row] of gradeCSVRows.entries()) {
    const sid      = (row.StudentID || row.studentid || row.student_id || '').trim();
    const courseId = (row.CourseID  || row.courseid  || row.course_id  || '').trim();
    const score    = parseFloat(row.NumericScore || row.numericscore || row.score || 0);
    const { gp, letter } = computeGradePoint(score);

    // Per-row Year/Attempt from CSV override the UI form values (migration support)
    const rowAttempt = (row.Attempt || row.attempt || '').trim() || uploadAttempt;
    const rowYear    = (row.Year    || row.year    || '').trim() || gradeYear;

    // Deterministic ID: same student+course+attempt always maps to the same grade row.
    // Re-uploading the same CSV updates existing grades rather than creating duplicates.
    const gid = 'GRD-' + stableGradeId(sid, courseId, rowAttempt, rowYear);

    const courseMatch = courses.find(c => c[0].toLowerCase() === courseId.toLowerCase());
    const courseName  = courseMatch ? courseMatch[1] : courseId;

    // Use snake_case column names that match the actual Supabase schema.
    const record = {
      id:          gid,
      student_id:  sid,
      course_id:   courseId,
      score:       score,
      letter,
      gp,
      course:      courseName,
      attempt:     rowAttempt,
      year:        rowYear,
      uploaded_by: uploadedBy,
      created_at:  new Date().toISOString(),
    };

    const gradeRecord = {
      id: gid, student_id: sid, course_id: courseId,
      score, letter, gp, course: courseName,
      attempt: rowAttempt, year: rowYear, uploaded_by: uploadedBy,
    };
    validRecords.push({ record, gradeRecord, gid, score, gp, letter, sid, courseId, rowAttempt, rowYear, i });
  }


  
  // ── Batch upsert in chunks of 100 ──
  // upsert with onConflict:'id' does a true INSERT … ON CONFLICT DO UPDATE — no cascade deletes.
  const CHUNK = 100;
  const totalChunks = Math.ceil(validRecords.length / CHUNK);
  const batchErrors = new Map(); // gid → error message

  for (let c = 0; c < totalChunks; c++) {
    const chunk = validRecords.slice(c * CHUNK, (c + 1) * CHUNK);
    const pct = Math.round(((c + 1) / totalChunks) * 90);
    updateUploadOverlay(pct, `Uploading batch ${c + 1} of ${totalChunks}… (${Math.min((c + 1) * CHUNK, validRecords.length)} / ${validRecords.length} rows)`);

    const { error: batchErr } = await db.from('grades')
      .upsert(chunk.map(x => x.record), { onConflict: 'id', ignoreDuplicates: false, defaultToNull: false });

    if (batchErr) {
      // If the whole batch fails, fall back to row-by-row for this chunk so partial success is preserved
      for (const item of chunk) {
        let { error: rowErr } = await db.from('grades').insert(item.record);
        if (rowErr && (rowErr.message.includes('duplicate') || rowErr.message.includes('unique') || rowErr.message.includes('already exists'))) {
          // Fallback update always uses snake_case columns to match the actual schema
          const upd = {
            score:       item.score,
            letter:      item.letter,
            gp:          item.gp,
            course_id:   item.courseId,
            course:      item.record.course,
            attempt:     item.record.attempt,
            year:        item.record.year,
            uploaded_by: item.record.uploaded_by,
            updated_at:  new Date().toISOString(),
          };
          const { error: updErr } = await db.from('grades').update(upd).eq('id', item.gid);
          rowErr = updErr;
        }
        if (rowErr) batchErrors.set(item.gid, rowErr.message || 'Unknown error');
      }
    }
  }

  // ── Build result rows + update in-memory gradeData ──
  for (const item of validRecords) {
    const errMsg = batchErrors.get(item.gid);
    if (errMsg) {
      errCount++;
      body += `<tr class="bulk-row-err"><td>${item.i+1}</td><td class="text-mono">${item.sid}</td><td>${item.courseId}</td><td>${item.score}</td><td>${item.rowAttempt}</td><td>${item.rowYear||'—'}</td><td class="text-mono">${item.gid}</td><td>—</td><td>—</td><td><span class="badge b-red" title="${errMsg.replace(/"/g,"'")}">✗ ${errMsg.length > 40 ? errMsg.slice(0,40)+'…' : errMsg}</span></td></tr>`;
    } else {
      okCount++;
      notifiedStudents.add(item.sid);
      if (!gradeData[item.sid]) gradeData[item.sid] = [];
      const existingIdx = gradeData[item.sid].findIndex(g =>
        (g.course_id || g.CourseID || g.courseid || '') === item.courseId &&
        (g.attempt || '1st Attempt') === item.rowAttempt
      );
      if (existingIdx >= 0) gradeData[item.sid][existingIdx] = item.gradeRecord || item.record;
      else gradeData[item.sid].push(item.gradeRecord || item.record);
      recalcStudentGpa(item.sid);
      body += `<tr class="bulk-row-ok"><td>${item.i+1}</td><td class="text-mono">${item.sid}</td><td>${item.courseId}</td><td>${item.score}</td><td><span class="badge b-blue">${item.rowAttempt}</span></td><td style="font-size:11px;color:var(--ink3)">${item.rowYear||'—'}</td><td class="text-mono text-crimson">${item.gid}</td><td><span class="badge ${gradeBadgeClass(item.letter)}">${formatGradeLetter(item.letter)}</span></td><td><strong class="text-green">${item.gp.toFixed(1)}</strong></td><td><span class="badge b-green">✓ Saved</span></td></tr>`;
    }
  }

  updateUploadOverlay(100, 'Finalizing…');
  setTimeout(() => hideUploadOverlay(), 400);

  rt.innerHTML += body + '</tbody>';
  rc.style.display = 'block';
 const okEl = document.getElementById('gradeOkCount');
if (okEl) okEl.textContent = okCount + ' processed';

const emailEl = document.getElementById('gradeEmailCount');
if (emailEl) emailEl.textContent =
  notifiedStudents.size + ' emails queued';

const errEl = document.getElementById('gradeErrCount');
if (errEl) errEl.textContent = errCount + ' errors';

const bar = document.getElementById('gradeProgressBar');

if (bar) {
  bar.style.width = '0';

  setTimeout(() => {
    bar.style.width =
      (
        gradeCSVRows.length
          ? (okCount / gradeCSVRows.length) * 100
          : 0
      ) + '%';
  }, 100);
}

hideUploadOverlay();
  // ── Upload status banner ──
  const existingBanner = document.getElementById('gradeUploadStatusBanner');
  if (existingBanner) existingBanner.remove();
  const statusBanner = document.createElement('div');
  statusBanner.id = 'gradeUploadStatusBanner';
  const allFailed  = okCount === 0 && errCount > 0;
  const allSuccess = okCount > 0 && errCount === 0;
  const partial    = okCount > 0 && errCount > 0;
  statusBanner.style.cssText = `
    display:flex; align-items:center; gap:12px; padding:14px 18px; border-radius:8px; margin-top:14px; font-size:13px;
    background:${allFailed ? 'var(--crimson-light)' : allSuccess ? 'var(--green-light)' : 'var(--gold-light)'};
    border:1px solid ${allFailed ? 'var(--crimson)' : allSuccess ? 'var(--green)' : 'var(--gold)'};
    color:${allFailed ? 'var(--crimson)' : allSuccess ? 'var(--green)' : 'var(--gold)'};
  `;
  const icon = allFailed ? '❌' : allSuccess ? '✅' : '⚠️';
  const msg  = allFailed
    ? `Upload failed — ${errCount} error${errCount !== 1 ? 's' : ''}. No grades were saved. Check the red rows below for details.`
    : allSuccess
    ? `Upload successful — ${okCount} grade${okCount !== 1 ? 's' : ''} saved successfully.`
    : `Partial upload — ${okCount} saved, ${errCount} failed. Check the red rows below for details.`;
  statusBanner.innerHTML = `<span style="font-size:18px">${icon}</span><span><strong>${allFailed ? 'Upload Failed' : allSuccess ? 'Upload Successful' : 'Partial Upload'}</strong> — ${msg}</span>`;
  rc.insertAdjacentElement('afterbegin', statusBanner);
  // ── End status banner ──

  updateDashboardStats();

  // Fire all grade notification emails in parallel — no need to await each one serially.
  await Promise.all([...notifiedStudents].map(sid => {
    const s = students.find(x => x.id === sid);
    return s ? logEmail(s.email, sid, '[UM2] Your grades have been updated', 'Grade CSV upload') : Promise.resolve();
  }));
  const errNote = errCount > 0 ? ` — hover the red badges for error details.` : '';
  toast(`✅ ${okCount} grades saved. ${errCount} errors.${errNote}`, 'Notice');
}

// ══════════════════════════════════════════
// GRADE: EDIT & DELETE
// ══════════════════════════════════════════
function openEditGradeModal(sid, gid) {
  const g = (gradeData[sid] || []).find(x => x.id === gid);
  if (!g) return;
  _editGradeSid = sid;
  _editGradeId  = gid;
  const displayCourseId = g.course_id || g.CourseID || g.courseid || '';
  document.getElementById('editGradeModalId').textContent = gid.toUpperCase();
  document.getElementById('egm-id').value     = gid;
  document.getElementById('egm-course').value = (g.course || '') + ' (' + displayCourseId + ')';
  document.getElementById('egm-score').value  = g.score ?? g.NumericScore ?? g.numericscore ?? '';
  document.getElementById('egm-year').value   = g.year || '';
  document.getElementById('egm-attempt').value = g.attempt || '1st Attempt';
  document.getElementById('editGradeModal').classList.add('open');
}

async function saveEditGrade() {
  const score = parseFloat(document.getElementById('egm-score').value);
  if (isNaN(score) || score < 0 || score > 100) { toast('Score must be between 0 and 100.', 'Notice'); return; }
  const yr = document.getElementById('egm-year').value.trim() || new Date().getFullYear().toString();
  const attempt = document.getElementById('egm-attempt').value;
  const { gp, letter } = computeGradePoint(score);

  const { error } = await db.from('grades')
    .update({ score, gp, letter, year: yr, attempt, updated_at: new Date().toISOString() })
    .eq('id', _editGradeId);
  if (error) { toast('Update failed: ' + error.message, 'DB Error'); return; }

  const g = (gradeData[_editGradeSid] || []).find(x => x.id === _editGradeId);
  if (g) { g.score = score; g.NumericScore = score; g.gp = gp; g.letter = letter; g.year = yr; g.attempt = attempt; }
  recalcStudentGpa(_editGradeSid);
  if (currentProfileId === _editGradeSid) showProfile(_editGradeSid);
  closeModal('editGradeModal');
  toast(`Grade ${_editGradeId.toUpperCase()} updated.`, 'Notice');
}

function confirmDeleteGrade(sid, gid, courseName) {
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Grade';
  document.getElementById('confirmDeleteMsg').innerHTML =
    `Are you sure you want to delete the grade for <strong>${courseName}</strong>?<br>
    <span class="text-mono text-crimson">${gid.toUpperCase()}</span><br><br>This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('grades').delete().eq('id', gid);
    if (error) { toast('Delete failed: ' + error.message, 'DB Error'); return; }
    if (gradeData[sid]) gradeData[sid] = gradeData[sid].filter(g => g.id !== gid);
    recalcStudentGpa(sid);
    if (currentProfileId === sid) showProfile(sid);
    toast(`Grade ${gid.toUpperCase()} deleted.`, 'Notice');
    closeModal('confirmDeleteModal');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

// Grade ID search
function searchByGradeId(query) {
  const q = query.trim().toLowerCase();
  const resultDiv = document.getElementById('gradeIdSearchResult');
  const tbody     = document.getElementById('gradeIdSearchBody');
  if (!q) { resultDiv.style.display = 'none'; return; }
  const results = [];
  Object.keys(gradeData).forEach(sid => {
    (gradeData[sid] || []).forEach(g => {
      if ((g.id || '').toLowerCase().includes(q)) {
        const s = students.find(x => x.id === sid);
        results.push({ sid, studentName: s ? s.name_en : '—', grade: g });
      }
    });
  });
  if (!results.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--ink3)">No grade found matching "<strong>${query}</strong>".</td></tr>`;
  } else {
    tbody.innerHTML = '';
    results.forEach(({ sid, studentName, grade: g }) => {
      const gpColor = g.gp >= 3.5 ? 'text-green' : g.gp >= 2.0 ? 'text-gold' : 'text-crimson';
      tbody.innerHTML += `<tr>
        <td class="text-mono text-crimson">${(g.id||'').toUpperCase()}</td>
        <td class="text-mono">${sid}</td>
        <td><strong>${studentName}</strong></td>
        <td>${g.course}<br><span class="text-muted">${g.course_id || g.CourseID || g.courseid || ''}</span></td>
        <td>${g.score ?? g.NumericScore ?? g.numericscore ?? '—'}</td>
        <td><span class="badge ${gradeBadgeClass(g.letter)}">${formatGradeLetter(g.letter)}</span></td>
        <td><strong class="${gpColor}">${Number(g.gp).toFixed(1)}</strong></td>
        <td>${g.year}</td>
        <td class="flex gap-2">
          ${currentRole === 'registrar' ? `<button class="btn btn-outline btn-sm" onclick="openEditGradeModal('${sid}','${g.id}')">Edit</button>` : ''}
          ${currentRole === 'registrar' ? `<button class="btn btn-danger btn-sm" onclick="confirmDeleteGrade('${sid}','${g.id}','${(g.course||'').replace(/'/g,"\\'")}')"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="showProfile('${sid}')">View Student</button>
        </td>
      </tr>`;
    });
  }
  resultDiv.style.display = 'block';
}

function clearGradeIdSearch() {
  document.getElementById('gradeIdSearchInput').value = '';
  document.getElementById('gradeIdSearchResult').style.display = 'none';
}

