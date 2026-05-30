// ══════════════════════════════════════
// Academic Years, Dynamic Selects, Bulk Import, Setup
// ══════════════════════════════════════

// ══════════════════════════════════════════
// ACADEMIC YEARS
// ══════════════════════════════════════════
const DEFAULT_YEARS = [
  { id: 'AY001', name: 'Foundation Year', sort_order: 1 },
  { id: 'AY002', name: 'M-1',             sort_order: 2 },
  { id: 'AY003', name: 'M-2',             sort_order: 3 },
  { id: 'AY004', name: 'M-3',             sort_order: 4 },
  { id: 'AY005', name: 'M-4',             sort_order: 5 },
  { id: 'AY006', name: 'M-5',             sort_order: 6 },
];

let academicYears = [...DEFAULT_YEARS];
let _editingYearId = null;

async function loadAcademicYears() {
  // Try loading from Supabase academic_years table; fall back to defaults if not present
  try {
    const { data, error } = await db.from('academic_years').select('*').order('sort_order');
    if (!error && data && data.length) { academicYears = data; }
  } catch(e) { /* table may not exist yet — use defaults */ }
  renderYearsTable();
  populateAllSelects();
}

// ══════════════════════════════════════════
// POPULATE ALL DYNAMIC SELECTS
// Rebuilds every hardcoded year/program <select> from live academicYears + degreePrograms data.
// Call this whenever academicYears or degreePrograms changes.
// ══════════════════════════════════════════
function populateAllSelects() {
  const yearNames    = academicYears.map(y => y.name);
  const programIds   = degreePrograms.filter(p => p.status === 'Active').map(p => p.id);

  // Helper: populate a <select> with active degree programs
  function setProgramSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';
    degreePrograms.filter(p => p.status === 'Active').forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.id + ' — ' + p.name;
      sel.appendChild(opt);
    });
    if (Array.from(sel.options).some(o => o.value === current)) sel.value = current;
  }

  // Helper: rebuild a <select> with an optional blank "All" option
  function setYearSelect(id, includeAll, currentValue) {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = currentValue !== undefined ? currentValue : el.value;
    el.innerHTML = (includeAll ? '<option value="">All Years</option>' : '') +
      yearNames.map(n => `<option value="${n}">${n}</option>`).join('');
    if (saved && yearNames.includes(saved)) el.value = saved;
  }

  function setProgramSelect(id, includeAll, currentValue) {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = currentValue !== undefined ? currentValue : el.value;
    el.innerHTML = (includeAll ? '<option value="">All Programs</option>' : '') +
      programIds.map(n => `<option value="${n}">${n}</option>`).join('');
    if (saved && programIds.includes(saved)) el.value = saved;
  }

  // Helper: populate a year <select> filtered to a specific program's year_sequence
  function setYearSelectForProgram(yearSelectId, programId) {
    const el = document.getElementById(yearSelectId);
    if (!el) return;
    const saved = el.value;
    const prog = degreePrograms.find(p => p.id === programId);
    const progYears = prog
      ? (prog.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean)
      : yearNames;
    el.innerHTML = progYears.map(n => `<option value="${n}">${n}</option>`).join('');
    if (saved && progYears.includes(saved)) el.value = saved;
  }

  // Enrollment form
  setProgramSelect('en-program');
  setYearSelectForProgram('en-year', document.getElementById('en-program')?.value || (degreePrograms[0]?.id || ''));

  // Add Student form
  setProgramSelect('ns-program');
  setYearSelectForProgram('ns-year', document.getElementById('ns-program')?.value || (degreePrograms[0]?.id || ''));

  // Edit Student modal
  setYearSelectForProgram('em-year', document.getElementById('em-program-hidden')?.value || document.getElementById('em-year')?.dataset?.program || (degreePrograms[0]?.id || ''));

  // Course modal — populate datalists so existing years/programs are suggested but any value can be typed
  const cmYearList = document.getElementById('cm-year-list');
  if (cmYearList) {
    const allYears = [...new Set([
      ...degreePrograms.flatMap(p => (p.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean)),
      ...yearNames,
      ...courses.map(c => c[2]).filter(Boolean)
    ])];
    cmYearList.innerHTML = allYears.map(n => `<option value="${n}">`).join('');
  }
  const cmProgList = document.getElementById('cm-program-list');
  if (cmProgList) {
    const allProgs = [...new Set([
      ...degreePrograms.map(p => p.id),
      ...courses.map(c => c[6]).filter(Boolean)
    ])];
    cmProgList.innerHTML = allProgs.map(n => `<option value="${n}">`).join('');
  }

  // Student list program filter
  const spf = document.getElementById('studentProgramFilter');
  if (spf) {
    const savedProg = spf.value;
    spf.innerHTML = '<option value="">All Programs</option>' +
      degreePrograms.filter(p => p.status === 'Active').map(p => `<option value="${p.id}">${p.id} — ${p.name}</option>`).join('');
    if (savedProg && Array.from(spf.options).some(o => o.value === savedProg)) spf.value = savedProg;
  }

  // Student list year filter (has "All Years" blank option) — include all years across all programs
  const allProgYears = [...new Set(degreePrograms.flatMap(p =>
    (p.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean)
  ).concat(yearNames))];
  const syf = document.getElementById('studentYearFilter');
  if (syf) {
    const savedYear = syf.value;
    syf.innerHTML = '<option value="">All Years</option>' +
      allProgYears.map(n => `<option value="${n}">${n}</option>`).join('');
    if (savedYear && Array.from(syf.options).some(o => o.value === savedYear)) syf.value = savedYear;
  }

  // Year modal program dropdown (rebuild when degrees change)
  const ymProgSel = document.getElementById('ym-program');
  if (ymProgSel) {
    const savedYmProg = ymProgSel.value;
    ymProgSel.innerHTML = '<option value="">— None / All Programs —</option>' +
      degreePrograms.filter(p => p.status === 'Active').map(p =>
        `<option value="${p.id}">${p.id} — ${p.name}</option>`
      ).join('');
    if (savedYmProg && Array.from(ymProgSel.options).some(o => o.value === savedYmProg)) ymProgSel.value = savedYmProg;
  }

  // Refresh lecture room program dropdowns
  if (typeof populateLectureRoomPrograms === 'function') populateLectureRoomPrograms();

  // Course list year filter (has "All Years" blank option)
  // Build from ALL unique year values across every program's year_sequence + every course's year
  // so it works for any program, not just the default one.
  const courseFilterYears = [...new Set([
    ...degreePrograms.flatMap(p => (p.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean)),
    ...yearNames,
    ...courses.map(c => c[2]).filter(Boolean)
  ])];
  const cyf = document.getElementById('courseYearFilter');
  if (cyf) {
    const savedCyf = cyf.value;
    cyf.innerHTML = '<option value="">All Years</option>' +
      courseFilterYears.map(n => `<option value="${n}">${n}</option>`).join('');
    if (savedCyf && Array.from(cyf.options).some(o => o.value === savedCyf)) cyf.value = savedCyf;
  }
}

function updateYearsForProgram(yearSelectId, programId) {
  const el = document.getElementById(yearSelectId);
  if (!el) return;
  const saved = el.value;
  const prog = degreePrograms.find(p => p.id === programId);
  const progYears = prog
    ? (prog.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean)
    : academicYears.map(y => y.name);
  el.innerHTML = progYears.map(n => `<option value="${n}">${n}</option>`).join('');
  if (saved && progYears.includes(saved)) el.value = saved;
}

function renderYearsTable() {
  const tb = document.getElementById('yearsTableBody');
  if (!tb) return;

  // Populate program filter dropdown
  const pf = document.getElementById('yearProgramFilter');
  if (pf) {
    const savedPf = pf.value;
    pf.innerHTML = '<option value="">All Programs</option>' +
      degreePrograms.filter(p => p.status === 'Active').map(p =>
        `<option value="${p.id}">${p.id} — ${p.name}</option>`
      ).join('');
    if (savedPf && Array.from(pf.options).some(o => o.value === savedPf)) pf.value = savedPf;
  }

  const filterProgId = pf ? pf.value : '';
  const filteredYears = filterProgId
    ? academicYears.filter(y => y.program_id === filterProgId)
    : academicYears;

  tb.innerHTML = '';
  if (!filteredYears.length) {
    tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink3)">No academic years found${filterProgId ? ' for this program' : ''}.</td></tr>`;
    return;
  }
  filteredYears.forEach(y => {
    const enrolled = students.filter(s => s.year === y.name).length;
    const coursesInYear = courses.filter(c => c[2] === y.name).length;
    const linkedProg = y.program_id
      ? (degreePrograms.find(p => p.id === y.program_id)?.name || y.program_id)
      : '<span style="color:var(--ink3);font-style:italic">—</span>';
    const dur = y.duration_months;
    const durLabel = !dur ? '—'
      : dur % 12 === 0 ? `${dur/12} yr${dur/12!==1?'s':''}`
      : `${Math.floor(dur/12)}½ yrs`;
    tb.innerHTML += `<tr>
      <td class="text-mono text-crimson">${y.id}</td>
      <td><strong>${y.name}</strong></td>
      <td>${durLabel}</td>
      <td>${y.sort_order}</td>
      <td>${linkedProg}</td>
      <td>${enrolled}</td>
      <td>${coursesInYear || '—'}</td>
      <td class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="openYearModal('${y.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteYear('${y.id}','${y.name.replace(/'/g,"\\'")}')"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>
      </td>
    </tr>`;
  });
}

function openYearModal(yid) {
  _editingYearId = yid || null;
  // Populate program dropdown
  const ymProg = document.getElementById('ym-program');
  if (ymProg) {
    ymProg.innerHTML = '<option value="">— None / All Programs —</option>' +
      degreePrograms.filter(p => p.status === 'Active').map(p =>
        `<option value="${p.id}">${p.id} — ${p.name}</option>`
      ).join('');
  }
  if (yid) {
    const y = academicYears.find(x => x.id === yid);
    if (!y) return;
    document.getElementById('yearModalTitle').textContent = 'Edit Academic Year — ' + yid;
    document.getElementById('ym-id').value    = y.id;
    document.getElementById('ym-id').readOnly = true;
    document.getElementById('ym-name').value  = y.name;
    document.getElementById('ym-order').value = y.sort_order;
    document.getElementById('ym-duration').value = y.duration_months || 12;
    if (ymProg) ymProg.value = y.program_id || '';
  } else {
    document.getElementById('yearModalTitle').textContent = 'Add Academic Year';
    document.getElementById('ym-id').value    = '';
    document.getElementById('ym-id').readOnly = false;
    document.getElementById('ym-name').value  = '';
    document.getElementById('ym-order').value = '';
    document.getElementById('ym-duration').value = 12;
    if (ymProg) ymProg.value = '';
  }
  document.getElementById('yearModal').classList.add('open');
}

async function saveYear() {
  const id       = document.getElementById('ym-id').value.trim().toUpperCase();
  const name     = document.getElementById('ym-name').value.trim();
  const order    = parseInt(document.getElementById('ym-order').value) || academicYears.length + 1;
  const programId = (document.getElementById('ym-program')?.value || '').trim() || null;
  const durationMonths = parseInt(document.getElementById('ym-duration').value) || 12;
  if (!id || !name) { toast('Year ID and Year Name are required.', 'Notice'); return; }

  const record = { id, name, sort_order: order, program_id: programId, duration_months: durationMonths };

  // Try saving to Supabase; gracefully degrade if table doesn't exist
  try {
    const { error } = await db.from('academic_years')
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
  } catch(e) {
    // Table may not exist — just update in memory
  }

  const idx = academicYears.findIndex(x => x.id === id);
  if (idx >= 0) { academicYears[idx] = record; }
  else { academicYears.push(record); }
  academicYears.sort((a,b) => a.sort_order - b.sort_order);

  closeModal('yearModal');
  renderYearsTable();
  populateAllSelects();
  toast(`Academic year "${name}" saved.`, '📅');
}

function confirmDeleteYear(yid, yname) {
  const enrolled = students.filter(s => s.year === yname).length;
  if (enrolled > 0) {
    toast(`Cannot delete "${yname}" — ${enrolled} student(s) currently enrolled.`, '⚠️');
    return;
  }
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Academic Year';
  document.getElementById('confirmDeleteMsg').textContent   =
    `Are you sure you want to delete "${yname}" (${yid})? This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteYear(yid, yname);
  document.getElementById('confirmDeleteModal').classList.add('open');
}

async function deleteYear(yid, yname) {
  try {
    await db.from('academic_years').delete().eq('id', yid);
  } catch(e) { /* table may not exist */ }
  academicYears = academicYears.filter(x => x.id !== yid);
  closeModal('confirmDeleteModal');
  renderYearsTable();
  populateAllSelects();
  toast(`Academic year "${yname}" deleted.`, '🗑');
}

// ══════════════════════════════════════════
// ACADEMIC YEARS — BULK IMPORT
// ══════════════════════════════════════════
let bulkYearRows = [];

function downloadYearTemplate() {
  downloadCSV('academic_years_template.csv',
    'year_id,year_name,sort_order,program_id,duration_months\nAY001,Foundation Year,1,MBBS,12\nAY002,M-1,2,MBBS,18\nAY003,M-2,3,MBBS,12\nAY004,M-3,4,MBBS,12\nAY005,M-4,5,MBBS,12\nAY006,M-5,6,MBBS,12');
}

function handleBulkYearCSV(input) {
  const file = input.files ? input.files[0] : input[0];
  if (!file) return;
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (results) => {
      bulkYearRows = results.data;
      let errors = 0;
      document.getElementById('yearPreviewCount').textContent = bulkYearRows.length;
      const pt = document.getElementById('yearPreviewTable');
      pt.innerHTML = `<thead><tr><th>Year ID</th><th>Year Name</th><th>Duration</th><th>Sort Order</th><th>Program</th><th>Action</th><th>Validation</th></tr></thead>`;
      let body = '<tbody>';
      bulkYearRows.forEach(row => {
        const yid      = (row.year_id || '').trim().toUpperCase();
        const name     = (row.year_name || '').trim();
        const order    = row.sort_order || '';
        const progId   = (row.program_id || '').trim() || '—';
        const dur      = parseInt(row.duration_months) || 12;
        const durLabel = dur % 12 === 0 ? `${dur/12} yr${dur/12!==1?'s':''}` : `${Math.floor(dur/12)}½ yrs`;
        const hasRequired = yid && name;
        if (!hasRequired) errors++;
        const existing = academicYears.find(x => x.id === yid);
        const action = existing ? 'UPDATE' : 'INSERT';
        const actionBadge = existing ? 'b-blue' : 'b-green';
        body += `<tr class="${hasRequired ? '' : 'bulk-row-err'}">
          <td class="text-mono">${yid || '<span class="text-crimson">Missing</span>'}</td>
          <td>${name || '<span class="text-crimson">Missing</span>'}</td>
          <td>${durLabel}</td>
          <td>${order}</td>
          <td>${progId}</td>
          <td><span class="badge ${actionBadge}">${action}</span></td>
          <td>${hasRequired ? '<span class="badge b-green">✓ OK</span>' : '<span class="badge b-red">✗ Missing required field</span>'}</td>
        </tr>`;
      });
      pt.innerHTML += body + '</tbody>';
      document.getElementById('yearPreviewErrors').textContent = errors + ' errors';
      document.getElementById('yearPreviewArea').style.display = 'block';
    }
  });
}

async function submitBulkYears() {
  document.getElementById('yearPreviewArea').style.display = 'none';
  const rc = document.getElementById('yearResultCard');
  const rt = document.getElementById('yearResultTable');
  let inserted = 0, updated = 0, errs = 0;
  rt.innerHTML = `<thead><tr><th>Year ID</th><th>Year Name</th><th>Duration</th><th>Sort Order</th><th>Program</th><th>Action</th><th>DB</th></tr></thead>`;
  let body = '<tbody>';

  for (const row of bulkYearRows) {
    const yid    = (row.year_id || '').trim().toUpperCase();
    const name   = (row.year_name || '').trim();
    const order  = parseInt(row.sort_order) || academicYears.length + 1;
    const progId = (row.program_id || '').trim() || null;
    const dur    = parseInt(row.duration_months) || 12;
    const durLabel = dur % 12 === 0 ? `${dur/12} yr${dur/12!==1?'s':''}` : `${Math.floor(dur/12)}½ yrs`;

    if (!yid || !name) {
      errs++;
      body += `<tr class="bulk-row-err"><td class="text-mono">${yid||'?'}</td><td>${name||'—'}</td><td>—</td><td>—</td><td>—</td><td><span class="badge b-red">✗ Skipped</span></td><td>—</td></tr>`;
      continue;
    }

    const record = { id: yid, name, sort_order: order, program_id: progId, duration_months: dur };
    const existing = academicYears.find(x => x.id === yid);

    try {
      const { error } = await db.from('academic_years').upsert(record, { onConflict: 'id' });
      if (error) throw error;
    } catch(e) { /* graceful degrade */ }

    if (existing) {
      updated++;
      Object.assign(existing, record);
      body += `<tr class="bulk-row-ok"><td class="text-mono text-crimson">${yid}</td><td>${name}</td><td>${durLabel}</td><td>${order}</td><td>${progId||'—'}</td><td><span class="badge b-blue">↑ Updated</span></td><td><span class="badge b-green">✓</span></td></tr>`;
    } else {
      inserted++;
      academicYears.push(record);
      body += `<tr class="bulk-row-ok"><td class="text-mono text-crimson">${yid}</td><td>${name}</td><td>${durLabel}</td><td>${order}</td><td>${progId||'—'}</td><td><span class="badge b-green">✓ Inserted</span></td><td><span class="badge b-green">✓</span></td></tr>`;
    }
  }

  academicYears.sort((a, b) => a.sort_order - b.sort_order);
  rt.innerHTML += body + '</tbody>';
  rc.style.display = 'block';
  document.getElementById('yearProgressBar').style.width = '0';
  setTimeout(() => document.getElementById('yearProgressBar').style.width = '100%', 100);
  document.getElementById('yearInsertCount').textContent = inserted + ' inserted';
  document.getElementById('yearUpdateCount').textContent = updated + ' updated';
  document.getElementById('yearErrorCount').textContent  = errs + ' errors';
  renderYearsTable();
  populateAllSelects();
  toast(`✅ ${inserted} inserted, ${updated} updated, ${errs} errors.`, '📅');
}

// ══════════════════════════════════════════
// SETUP — render SQL schema in the page
// ══════════════════════════════════════════
function renderSchemaSQL() {
  const el = document.getElementById('schemaSQLBlock');
  if (el) el.textContent = SCHEMA_SQL;
}

function copySchema() {
  navigator.clipboard.writeText(SCHEMA_SQL).then(() => toast('SQL schema copied to clipboard.', '📋'));
}

// ══════════════════════════════════════════
