// ══════════════════════════════════════
// Attendance
// ══════════════════════════════════════

// ATTENDANCE
// ══════════════════════════════════════════
function attendanceKey(r) {
  return [r.student_id, r.lecture_name, r.session_date, r.session_from].join('|').toLowerCase();
}

function getStudentNameById(sid) {
  const s = students.find(x => x.id.toLowerCase() === String(sid||'').toLowerCase());
  return s ? s.name_en : '—';
}

function attendanceBadgeClass(status) {
  return status === 'Present' ? 'b-green' : status === 'Late' ? 'b-gold' : status === 'Excused' ? 'b-blue' : 'b-red';
}

function renderAttendanceTable() {
  const tb = document.getElementById('attendanceTableBody');
  if (!tb) return;
  const q = (document.getElementById('attendanceSearchInput')?.value || '').trim().toLowerCase();
  const dateFilter    = getDateValue('attendanceDateFilter') || document.getElementById('attendanceDateFilter')?.value || '';
  const statusFilter  = document.getElementById('attendanceStatusFilter')?.value || '';
  const acadYearId    = document.getElementById('attendanceAcadYearFilter')?.value || '';

  // Resolve date bounds for the selected academic year (if any)
  let acadStart = '', acadEnd = '';
  if (acadYearId && typeof academicYears !== 'undefined' && Array.isArray(academicYears)) {
    const yo = academicYears.find(y => y.id === acadYearId);
    if (yo && yo.start_date && yo.end_date) {
      acadStart = yo.start_date.slice(0, 10);
      acadEnd   = yo.end_date.slice(0, 10);
    }
  }

  let rows = attendanceRecords.filter(r => {
    const hay = `${r.student_id} ${getStudentNameById(r.student_id)} ${r.lecture_name} ${r.session_date} ${r.session_from} ${r.session_till||''} ${r.status} ${r.remarks||''}`.toLowerCase();
    const d   = (r.session_date || '').slice(0, 10);
    const matchAcadYear = !acadYearId || (
      acadStart && acadEnd
        ? (d >= acadStart && d <= acadEnd)
        : (r.academic_year || resolveAcadYearForDate(r.session_date)) === acadYearId
    );
    return (!q || hay.includes(q)) && (!dateFilter || r.session_date === dateFilter) && (!statusFilter || r.status === statusFilter) && matchAcadYear;
  });
  rows.sort((a,b) => (`${b.session_date} ${b.session_from}`).localeCompare(`${a.session_date} ${a.session_from}`));
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--ink3)">No attendance records found.</td></tr>`;
    updateAttendanceStats();
    return;
  }
  tb.innerHTML = rows.map(r => {
    const key = attendanceKey(r).replace(/'/g, "\\'");
    return `<tr>
      <td class="text-mono text-crimson">${r.student_id}</td>
      <td><strong>${getStudentNameById(r.student_id)}</strong></td>
      <td>${r.lecture_name}</td>
      <td class="text-mono">${r.session_date}</td>
      <td class="text-mono"><span style="font-size:11px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:2px 7px;white-space:nowrap">From: ${r.session_from} &nbsp;/&nbsp; Till: ${r.session_till||'—'}</span></td>
      <td><span class="badge ${attendanceBadgeClass(r.status)}">${r.status}</span></td>
      <td>${r.remarks||'—'}</td>
      <td class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="openAttendanceModal('${key}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteAttendance('${key}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
  updateAttendanceStats();
}

function updateAttendanceStats() {
  const sessions = new Set(attendanceRecords.map(r => `${r.lecture_name}|${r.session_date}|${r.session_from}`));
  const present  = attendanceRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const absent   = attendanceRecords.filter(r => r.status === 'Absent').length;
  const rate     = attendanceRecords.length ? Math.round((present / attendanceRecords.length) * 100) : 0;
  const setText  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('attSessionCount', sessions.size);
  setText('attRecordCount',  attendanceRecords.length);
  setText('attPresentRate',  rate + '%');
  setText('attAbsentCount',  absent);
}

function clearAttendanceFilters() {
  ['attendanceSearchInput','attendanceDateFilter','attendanceStatusFilter','attendanceAcadYearFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderAttendanceTable();
}

// ── ATTENDANCE STUDENT FILTER ──
function populateAttendanceStudentFilters() {
  const progSel = document.getElementById('attProgramFilter');
  const yearSel = document.getElementById('attYearFilter');
  if (!progSel || !yearSel) return;
  const progs = [...new Set(students.map(s => s.program).filter(Boolean))].sort();
  const years = [...new Set(students.map(s => s.year).filter(Boolean))].sort();
  progSel.innerHTML = '<option value="">All Programs</option>' + progs.map(p => `<option value="${p}">${p}</option>`).join('');
  yearSel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function filterAttendanceByStudent() {
  const prog = (document.getElementById('attProgramFilter')?.value || '').toLowerCase();
  const year = (document.getElementById('attYearFilter')?.value || '').toLowerCase();
  const sid  = (document.getElementById('attStudentIdFilter')?.value || '').toLowerCase().trim();
  const name = (document.getElementById('attStudentNameFilter')?.value || '').toLowerCase().trim();

  if (!prog && !year && !sid && !name) {
    const matchList = document.getElementById('attStudentMatchList');
    if (matchList) matchList.style.display = 'none';
    const detail = document.getElementById('attStudentDetail');
    if (detail) detail.style.display = 'none';
    return;
  }

  const matched = students.filter(s => {
    const matchP = !prog || (s.program||'').toLowerCase() === prog;
    const matchY = !year || (s.year||'').toLowerCase() === year;
    const matchI = !sid  || s.id.toLowerCase().includes(sid);
    const matchN = !name || (s.name_en||'').toLowerCase().includes(name) || (s.name_my||'').toLowerCase().includes(name);
    return matchP && matchY && matchI && matchN;
  });

  const chips = document.getElementById('attStudentChips');
  const matchList = document.getElementById('attStudentMatchList');
  if (!chips || !matchList) return;

  if (!matched.length) {
    matchList.style.display = '';
    chips.innerHTML = '<div style="font-size:13px;color:var(--ink3);padding:6px 0">No students match these filters.</div>';
    const detail = document.getElementById('attStudentDetail');
    if (detail) detail.style.display = 'none';
    return;
  }

  matchList.style.display = '';
  chips.innerHTML = matched.slice(0, 50).map(s => `
    <button onclick="showAttendanceStudentDetail('${s.id}')" style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--surface);border:1.5px solid var(--line);border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;color:var(--ink2);transition:all .15s" onmouseover="this.style.borderColor='var(--crimson)';this.style.background='var(--crimson-light)'" onmouseout="this.style.borderColor='var(--line)';this.style.background='var(--surface)'">
      <span style="font-family:monospace;color:var(--crimson);font-size:11px">${s.id}</span>
      <strong style="color:var(--ink)">${s.name_en}</strong>
      <span style="color:var(--ink3);font-size:11px">${s.program||''} · ${s.year||''}</span>
    </button>`).join('');
}

function showAttendanceStudentDetail(studentId) {
  const s = students.find(x => x.id === studentId);
  if (!s) return;
  const records = attendanceRecords.filter(r => r.student_id === studentId);

  // Update header
  const av = document.getElementById('attDetailAvatar');
  const nm = document.getElementById('attDetailName');
  const id = document.getElementById('attDetailId');
  const py = document.getElementById('attDetailProgYear');
  const pr = document.getElementById('attDetailPresent');
  const ab = document.getElementById('attDetailAbsent');
  const rt = document.getElementById('attDetailRate');

  if (av) av.textContent = (s.name_en||'?').slice(0,2).toUpperCase();
  if (nm) nm.textContent = s.name_en || '—';
  if (id) id.textContent = s.id;
  if (py) py.textContent = [s.program, s.year].filter(Boolean).join(' · ');

  const presentN = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const absentN  = records.filter(r => r.status === 'Absent').length;
  const rate     = records.length ? Math.round((presentN / records.length) * 100) : 0;
  if (pr) pr.textContent = 'Present: ' + presentN;
  if (ab) ab.textContent = 'Absent: '  + absentN;
  if (rt) rt.textContent = rate + '%';

  const tbody = document.getElementById('attStudentSessionBody');
  if (tbody) {
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink3)">No attendance records for this student.</td></tr>';
    } else {
      const sorted = [...records].sort((a,b) => (b.session_date||'').localeCompare(a.session_date||''));
      tbody.innerHTML = sorted.map(r => {
        const statusBadge = {
          'Present':'b-green','Late':'b-gold','Excused':'b-blue','Absent':'b-red'
        }[r.status] || '';
        const key = attendanceKey(r);
        return `<tr>
          <td><strong>${r.lecture_name||'—'}</strong></td>
          <td>${r.session_date ? r.session_date.split('-').reverse().join('/') : '—'}</td>
          <td style="font-family:monospace;font-size:12px">${r.session_from||''} – ${r.session_till||''}</td>
          <td><span class="badge ${statusBadge}">${r.status}</span></td>
          <td style="color:var(--ink3);font-size:12px">${r.remarks||'—'}</td>
          <td>
            <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px" onclick="openAttendanceModal('${key}')">Edit</button>
          </td>
        </tr>`;
      }).join('');
    }
  }

  const detail = document.getElementById('attStudentDetail');
  if (detail) detail.style.display = '';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAttendanceStudentFilters() {
  ['attProgramFilter','attYearFilter','attStudentIdFilter','attStudentNameFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const matchList = document.getElementById('attStudentMatchList');
  const detail = document.getElementById('attStudentDetail');
  if (matchList) matchList.style.display = 'none';
  if (detail) detail.style.display = 'none';
}

function lookupStudentForAttendance(sid) {
  const el = document.getElementById('am-studentName');
  if (el) el.value = getStudentNameById(sid);
}

function openAttendanceModal(key) {
  editingAttendanceKey = key || null;
  document.getElementById('attendanceModalTitle').textContent = key ? 'Edit Attendance' : 'Add Attendance';
  const record = key ? attendanceRecords.find(r => attendanceKey(r) === key.toLowerCase()) : null;
  document.getElementById('am-student').value    = record ? record.student_id : '';
  document.getElementById('am-studentName').value= record ? getStudentNameById(record.student_id) : '';
  document.getElementById('am-lecture').value    = record ? record.lecture_name : '';
  setDateValue('am-date', record ? record.session_date : new Date().toISOString().slice(0,10));
  document.getElementById('am-from').value       = record ? record.session_from : '';
  document.getElementById('am-till').value       = record ? (record.session_till||'') : '';
  document.getElementById('am-status').value     = record ? record.status : 'Present';
  document.getElementById('am-remarks').value    = record ? (record.remarks||'') : '';
  document.getElementById('attendanceModal').classList.add('open');
}

async function saveAttendanceRecord() {
  const r = {
    student_id:   document.getElementById('am-student').value.trim(),
    lecture_name: document.getElementById('am-lecture').value.trim(),
    session_date: getDateValue('am-date'),
    session_from: document.getElementById('am-from').value,
    session_till: document.getElementById('am-till').value || null,
    status:       document.getElementById('am-status').value,
    remarks:      document.getElementById('am-remarks').value.trim() || null
  };
  if (!r.student_id || !r.lecture_name || !r.session_date || !r.session_from) {
    toast('Student ID, lecture name, date, and start time are required.', 'Notice'); return;
  }
  if (!students.some(s => s.id.toLowerCase() === r.student_id.toLowerCase())) {
    toast('Student ID not found in records.', 'Notice'); return;
  }

  const { data, error } = await db.from('attendance')
    .upsert({ ...r }, { onConflict: 'student_id,lecture_name,session_date,session_from' })
    .select().single();

  if (error) { toast('Save failed: ' + error.message, 'DB Error'); return; }

  const normalized = normalizeAttRecord(data || r);
  const newKey = attendanceKey(normalized);
  const existingIdx = attendanceRecords.findIndex(x => attendanceKey(x) === (editingAttendanceKey || newKey).toLowerCase());
  if (existingIdx >= 0) attendanceRecords[existingIdx] = normalized; else attendanceRecords.push(normalized);

  closeModal('attendanceModal');
  renderAttendanceTable();
  toast(existingIdx >= 0 ? 'Attendance record updated.' : 'Attendance record added.', 'Saved');
}

function confirmDeleteAttendance(key) {
  const r = attendanceRecords.find(x => attendanceKey(x) === key.toLowerCase());
  if (!r) return;
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Attendance Record';
  document.getElementById('confirmDeleteMsg').innerHTML =
    `Delete attendance for <strong>${getStudentNameById(r.student_id)}</strong>?<br>
    <span class="text-mono text-crimson">${r.student_id}</span><br>
    ${r.lecture_name} · ${r.session_date} · From: ${r.session_from}${r.session_till ? ' / Till: ' + r.session_till : ''}<br><br>This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('attendance')
      .delete()
      .eq('student_id',   r.student_id)
      .eq('lecture_name', r.lecture_name)
      .eq('session_date', r.session_date)
      .eq('session_from', r.session_from);
    if (error) { toast('Delete failed: ' + error.message, 'DB Error'); return; }
    const idx = attendanceRecords.findIndex(x => attendanceKey(x) === key.toLowerCase());
    if (idx >= 0) attendanceRecords.splice(idx, 1);
    closeModal('confirmDeleteModal');
    renderAttendanceTable();
    toast('Attendance record deleted.', 'Deleted');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

// Attendance bulk CSV
function handleAttendanceCSV(input) {
  const file = input.files ? input.files[0] : (input[0] || null);
  if (!file) return;
  Papa.parse(file, { header:true, skipEmptyLines:true, complete: function(res) {
    attendanceCSVRows = res.data.map(r => ({
      student_id:   (r.student_id||r.StudentID||'').trim(),
      lecture_name: (r.lecture_name||r.LectureName||r.lecture||'').trim(),
      session_date: normDateToISO((r.session_date||r.Date||'').trim()),
      session_from: (r.session_from||r.From||r.session_time||r.Time||'').trim(),
      session_till: (r.session_till||r.Till||'').trim(),
      status:       (r.status||r.Status||'Present').trim(),
      remarks:      (r.remarks||r.Remarks||'').trim()
    }));
    previewAttendanceCSV();
  }});
}

function previewAttendanceCSV() {
  const area  = document.getElementById('attendancePreviewArea');
  const table = document.getElementById('attendancePreviewTable');
  let errors = 0;
  const rows = attendanceCSVRows.map((r, i) => {
    const VALID_STATUSES_P = ['Present','Late','Excused','Absent'];
    const normStatusP = r.status ? (VALID_STATUSES_P.find(s => s.toLowerCase() === r.status.toLowerCase()) || '') : '';
    const validStatus  = VALID_STATUSES_P.includes(normStatusP);
    const knownStudent = students.some(s => s.id.toLowerCase() === (r.student_id||'').toLowerCase());
    const rowErrors = [];
    if (!r.student_id)  rowErrors.push('Missing Student ID');
    if (!knownStudent)  rowErrors.push('Unknown Student');
    if (!r.lecture_name) rowErrors.push('Missing Lecture');
    if (!r.session_date) rowErrors.push('Missing Date');
    if (!r.session_from) rowErrors.push('Missing Start Time');
    if (!validStatus)   rowErrors.push('Invalid Status');
    if (rowErrors.length) errors++;
    return `<tr class="${rowErrors.length ? 'bulk-row-err' : 'bulk-row-ok'}"><td>${i+1}</td><td class="text-mono">${r.student_id}</td><td>${getStudentNameById(r.student_id)}</td><td>${r.lecture_name}</td><td>${r.session_date}</td><td class="text-mono">From: ${r.session_from} / Till: ${r.session_till||'—'}</td><td>${r.status}</td><td>${rowErrors.join(', ')||'Ready'}</td></tr>`;
  }).join('');
  table.innerHTML = `<thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Lecture</th><th>Date</th><th>Time Range</th><th>Status</th><th>Validation</th></tr></thead><tbody>${rows}</tbody>`;
  document.getElementById('attendancePreviewCount').textContent  = attendanceCSVRows.length;
  document.getElementById('attendancePreviewErrors').textContent = errors + ' errors';
  area.style.display = 'block';
}

// Normalise date to YYYY-MM-DD regardless of input format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
function normDateToISO(raw) {
  if (!raw) return '';
  const s = raw.trim();
  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY  (day ≤ 31, month ≤ 12, year 4-digit at end)
  const dmY = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    // Heuristic: if first part > 12 it must be day; otherwise assume DD/MM/YYYY
    if (parseInt(d) > 12) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // MM/DD/YYYY fallback
  const mdY = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (mdY) {
    const [, m, d, y] = mdY;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return s; // return as-is and let Supabase complain
}

async function submitBulkAttendance() {
  let inserted = 0, updated = 0, skipped = 0;
  const VALID_STATUSES = ['Present','Late','Excused','Absent'];
  let lastError = '';

  for (const r of attendanceCSVRows) {
    // Normalise status capitalisation (e.g. 'present' → 'Present')
    const normStatus = r.status
      ? VALID_STATUSES.find(s => s.toLowerCase() === r.status.toLowerCase()) || r.status
      : '';

    // Resolve canonical student ID (case-insensitive lookup)
    const studentMatch = students.find(s => s.id.toLowerCase() === (r.student_id||'').toLowerCase());

    if (!r.student_id || !r.lecture_name || !r.session_date || !r.session_from ||
        !VALID_STATUSES.includes(normStatus) || !studentMatch) {
      skipped++;
      continue;
    }

    // Normalise time to HH:MM (Supabase time columns accept HH:MM:SS but HH:MM also works)
    const normTime = t => t ? (t.length === 5 ? t : t.slice(0,5)) : null;

    const record = {
      student_id:   studentMatch.id,          // canonical casing from DB
      lecture_name: r.lecture_name.trim(),
      session_date: normDateToISO(r.session_date),
      session_from: normTime(r.session_from),
      session_till: normTime(r.session_till) || null,
      status:       normStatus,
      remarks:      r.remarks || null
    };

    const { data, error } = await db.from('attendance')
      .upsert(record, { onConflict: 'student_id,lecture_name,session_date,session_from' })
      .select().single();

    if (!error) {
      const normalized = normalizeAttRecord(data || record);
      const idx = attendanceRecords.findIndex(x => attendanceKey(x) === attendanceKey(normalized));
      if (idx >= 0) { attendanceRecords[idx] = normalized; updated++; }
      else { attendanceRecords.push(normalized); inserted++; }
    } else {
      skipped++;
      lastError = error.message;
    }
  }

  document.getElementById('attendancePreviewArea').style.display = 'none';
  renderAttendanceTable();
  const errNote = lastError ? ` (last error: ${lastError})` : '';
  toast(`Attendance import: ${inserted} inserted, ${updated} updated, ${skipped} skipped.${errNote}`, 'Imported');
}

function downloadAttendanceTemplate() {
  downloadCSV('attendance_template.csv', 'student_id,lecture_name,session_date,session_from,session_till,status,remarks\niuc125065,Anatomy Live Session,2026-05-19,09:00,10:30,Present,Joined on time\niuc125066,Anatomy Live Session,2026-05-19,09:00,10:30,Absent,No show\n');
}

// ── ACADEMIC YEAR FILTER ──────────────────────────────────────────────────────

/**
 * Populate the Academic Year dropdown in the All Attendance Records panel.
 * Reads from the global `academicYears` array (defined in admin-state.js /
 * loaded by admin-data.js).  Falls back gracefully if the array is missing.
 */
function populateAttendanceAcadYearFilter() {
  const sel = document.getElementById('attendanceAcadYearFilter');
  if (!sel) return;
  const years = (typeof academicYears !== 'undefined' && Array.isArray(academicYears))
    ? [...academicYears].sort((a, b) => (a.label || a.id || '').localeCompare(b.label || b.id || ''))
    : [];
  sel.innerHTML = '<option value="">All Academic Years</option>' +
    years.map(y => {
      const val   = y.id   || '';
      const label = y.label || y.name || y.id || '';
      return `<option value="${val}">${label}</option>`;
    }).join('');
}

/**
 * Resolve which academic year a session_date belongs to.
 * An academic year record is expected to have `start_date` and `end_date`
 * (ISO YYYY-MM-DD) or at least `id` that we can match against enrollments.
 * Returns the year id string, or '' if not resolved.
 */
function resolveAcadYearForDate(sessionDate) {
  if (!sessionDate) return '';
  if (typeof academicYears === 'undefined' || !Array.isArray(academicYears)) return '';
  const d = sessionDate.slice(0, 10);
  const matched = academicYears.find(y => {
    const s = (y.start_date || '').slice(0, 10);
    const e = (y.end_date   || '').slice(0, 10);
    return s && e && d >= s && d <= e;
  });
  return matched ? matched.id : '';
}

/**
 * Extract (and optionally export as CSV) all attendance records that fall
 * within the selected Academic Year.
 *
 * @param {boolean} exportCSV  – pass true to also trigger a CSV download.
 * @returns {Array}            – filtered attendance record objects.
 */
function extractAttendanceByAcadYear(exportCSV = false) {
  const sel     = document.getElementById('attendanceAcadYearFilter');
  const yearId  = sel ? sel.value : '';
  if (!yearId) {
    toast('Please select an Academic Year first.', 'Notice');
    return [];
  }

  // Find the selected year object to get date bounds + label
  const yearObj = (typeof academicYears !== 'undefined' && Array.isArray(academicYears))
    ? academicYears.find(y => y.id === yearId)
    : null;

  let filtered;

  if (yearObj && yearObj.start_date && yearObj.end_date) {
    // Filter by date range
    const s = yearObj.start_date.slice(0, 10);
    const e = yearObj.end_date.slice(0, 10);
    filtered = attendanceRecords.filter(r => {
      const d = (r.session_date || '').slice(0, 10);
      return d >= s && d <= e;
    });
  } else {
    // Fallback: filter by academic_year field on the record (if stored)
    filtered = attendanceRecords.filter(r =>
      (r.academic_year || resolveAcadYearForDate(r.session_date)) === yearId
    );
  }

  if (!filtered.length) {
    toast('No records found for the selected Academic Year.', 'Notice');
    return [];
  }

  if (exportCSV) {
    const yearLabel = (yearObj && (yearObj.label || yearObj.name)) || yearId;
    const safeLabel = yearLabel.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const header = 'student_id,student_name,lecture_name,session_date,session_from,session_till,status,remarks';
    const rows = filtered
      .slice()
      .sort((a, b) => (`${a.session_date} ${a.session_from}`).localeCompare(`${b.session_date} ${b.session_from}`))
      .map(r =>
        [
          r.student_id,
          `"${getStudentNameById(r.student_id).replace(/"/g, '""')}"`,
          `"${(r.lecture_name || '').replace(/"/g, '""')}"`,
          r.session_date || '',
          r.session_from || '',
          r.session_till || '',
          r.status || '',
          `"${(r.remarks || '').replace(/"/g, '""')}"`
        ].join(',')
      );
    downloadCSV(`attendance_${safeLabel}.csv`, header + '\n' + rows.join('\n') + '\n');
    toast(`Exported ${filtered.length} records for "${yearLabel}".`, 'Exported');
  }

  return filtered;
}

/**
 * Triggered by the Export button next to the Academic Year dropdown.
 * Calls extractAttendanceByAcadYear with exportCSV = true.
 */
function exportAttendanceByAcadYear() {
  extractAttendanceByAcadYear(true);
}

// ══════════════════════════════════════════