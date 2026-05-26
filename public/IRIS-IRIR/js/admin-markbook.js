/* ═══════════════════════════════════════════════════════════════════
   admin-markbook.js  —  Mark Book feature
   Handles: load, display, add, edit, delete, CSV upload/export
   Table: public.markbook
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── Module state ─────────────────────────────────────────────── */
let _mbEntries   = [];   // all entries for current student
let _mbFiltered  = [];   // after filter applied
let _mbStudentId = null; // currently loaded student

/* ═══════════════════════════════════════════════════════════════
   LOAD & RENDER
═══════════════════════════════════════════════════════════════ */

/**
 * Called when the "Mark Book" tab is clicked.
 * Fetches all markbook rows for the given student and renders them.
 */
async function loadMarkbook(studentId) {
  if (!studentId) return;
  _mbStudentId = studentId;

  const tbody = document.getElementById('mbTableBody');
  tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--ink3);font-size:13px">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" class="spin" style="vertical-align:middle;margin-right:6px">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>Loading mark book…</td></tr>`;
  document.getElementById('mbSummaryLine').textContent = 'Loading…';
  document.getElementById('mbStatChips').innerHTML = '';

  try {
    const { data, error } = await window._supabase
      .from('markbook')
      .select('*')
      .eq('student_id', studentId)
      .order('year', { ascending: true })
      .order('block', { ascending: true })
      .order('assessment_name', { ascending: true });

    if (error) throw error;

    _mbEntries = data || [];
    _mbPopulateFilters();
    filterMarkbook();
  } catch (err) {
    console.error('loadMarkbook error:', err);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--crimson);font-size:13px">
      Failed to load: ${err.message || err}</td></tr>`;
    document.getElementById('mbSummaryLine').textContent = 'Error loading mark book.';
  }
}

/** Populate year and block filter dropdowns from loaded data */
function _mbPopulateFilters() {
  const years  = [...new Set(_mbEntries.map(e => e.year).filter(Boolean))].sort();
  const blocks = [...new Set(_mbEntries.map(e => e.block).filter(Boolean))].sort();

  const yf = document.getElementById('mbYearFilter');
  const bf = document.getElementById('mbBlockFilter');
  const yVal = yf.value;
  const bVal = bf.value;

  yf.innerHTML = '<option value="">All Years</option>' +
    years.map(y => `<option value="${_esc(y)}">${_esc(y)}</option>`).join('');
  bf.innerHTML = '<option value="">All Blocks</option>' +
    blocks.map(b => `<option value="${_esc(b)}">${_esc(b)}</option>`).join('');

  // Restore previous selection if still valid
  if (years.includes(yVal))  yf.value = yVal;
  if (blocks.includes(bVal)) bf.value = bVal;
}

/** Apply year/block filters and re-render */
function filterMarkbook() {
  const year  = document.getElementById('mbYearFilter').value;
  const block = document.getElementById('mbBlockFilter').value;

  _mbFiltered = _mbEntries.filter(e =>
    (!year  || e.year  === year)  &&
    (!block || e.block === block)
  );

  _mbRenderTable();
  _mbRenderStats();
}

/** Render the main table rows */
function _mbRenderTable() {
  const tbody = document.getElementById('mbTableBody');
  const isRegistrar = document.body.dataset.role === 'registrar' ||
    document.getElementById('roleLabel')?.textContent?.toLowerCase().includes('secretariat') ||
    (typeof currentUserRole !== 'undefined' && currentUserRole === 'registrar');

  if (!_mbFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--ink3);font-size:13px">
      No entries found. ${isRegistrar ? '<button class="btn btn-primary btn-sm" onclick="openMarkbookEntryModal()" style="margin-left:10px">+ Add Entry</button>' : ''}</td></tr>`;
    return;
  }

  tbody.innerHTML = _mbFiltered.map(e => {
    const pct = e.percentage != null
      ? parseFloat(e.percentage).toFixed(1)
      : (e.score != null && e.max_score ? ((e.score / e.max_score) * 100).toFixed(1) : '—');
    const pctNum = parseFloat(pct);

    const pctColor = isNaN(pctNum) ? 'var(--ink3)'
      : pctNum >= 80 ? 'var(--green)'
      : pctNum >= 60 ? 'var(--gold)'
      : pctNum >= 50 ? 'var(--ink2)'
      : 'var(--crimson)';

    const letter = _esc(e.letter || '—');
    const letterBadge = e.letter
      ? `<span class="badge ${_mbLetterBadgeClass(e.letter)}">${letter}</span>`
      : '<span style="color:var(--ink3)">—</span>';

    const pctBar = !isNaN(pctNum)
      ? `<div style="display:flex;align-items:center;gap:6px">
           <div style="width:42px;height:4px;background:var(--line);border-radius:99px;overflow:hidden;flex-shrink:0">
             <div style="height:100%;width:${Math.min(pctNum,100)}%;background:${pctColor};border-radius:99px"></div>
           </div>
           <span style="font-size:12px;color:${pctColor};font-weight:600;min-width:36px">${pct}%</span>
         </div>`
      : '<span style="color:var(--ink3)">—</span>';

    return `<tr>
      <td>
        <div style="width:6px;height:6px;border-radius:50%;background:${pctColor};margin:0 auto"></div>
      </td>
      <td style="font-weight:500;color:var(--ink)">${_esc(e.assessment_name || '—')}</td>
      <td style="color:var(--ink2);font-size:12px">${_esc(e.course_id || '—')}</td>
      <td><span style="font-size:11px;color:var(--ink3)">${_esc(e.block || '—')}</span></td>
      <td><span style="font-size:11px;color:var(--ink3)">${_esc(e.year || '—')}</span></td>
      <td style="text-align:right;font-family:monospace;font-size:13px;font-weight:600;color:var(--ink)">
        ${e.score != null ? parseFloat(e.score).toFixed(2) : '—'}
      </td>
      <td style="text-align:right;font-family:monospace;font-size:12px;color:var(--ink3)">
        ${e.max_score != null ? parseFloat(e.max_score).toFixed(0) : '—'}
      </td>
      <td style="min-width:100px">${pctBar}</td>
      <td>${letterBadge}</td>
      <td style="font-size:11px;color:var(--ink3);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
          title="${_esc(e.notes || '')}">${_esc(e.notes || '')}</td>
      ${isRegistrar
        ? `<td class="registrar-only">
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" title="Edit" onclick="openMarkbookEntryModal(${e.id})">
                <svg class="ui-icon"><use href="#i-edit"></use></svg>
              </button>
            </div>
           </td>`
        : `<td class="registrar-only"></td>`}
    </tr>`;
  }).join('');
}

/** Render summary stat chips above the table */
function _mbRenderStats() {
  const chips = document.getElementById('mbStatChips');
  const summary = document.getElementById('mbSummaryLine');

  if (!_mbFiltered.length) {
    summary.textContent = 'No entries for the selected filter.';
    chips.innerHTML = '';
    return;
  }

  const withPct = _mbFiltered.filter(e => e.percentage != null || (e.score != null && e.max_score));
  const pcValues = withPct.map(e => e.percentage != null
    ? parseFloat(e.percentage)
    : (parseFloat(e.score) / parseFloat(e.max_score)) * 100
  );
  const avg = pcValues.length ? (pcValues.reduce((a,b)=>a+b,0)/pcValues.length).toFixed(1) : null;
  const highest = pcValues.length ? Math.max(...pcValues).toFixed(1) : null;
  const lowest  = pcValues.length ? Math.min(...pcValues).toFixed(1) : null;
  const passed  = pcValues.filter(p=>p>=50).length;

  summary.textContent = `${_mbFiltered.length} entr${_mbFiltered.length===1?'y':'ies'}${avg ? ` · Avg ${avg}%` : ''}`;

  const stat = (label, val, color='var(--ink2)') =>
    `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--surface);border:1px solid var(--line);
            border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;color:${color}">
       <span style="color:var(--ink3);font-weight:400">${label}</span> ${val}
     </span>`;

  chips.innerHTML = [
    stat('Entries', _mbFiltered.length),
    avg    ? stat('Average', avg + '%', avg>=80?'var(--green)':avg>=60?'var(--gold)':'var(--crimson)') : '',
    highest ? stat('Highest', highest + '%', 'var(--green)') : '',
    lowest  ? stat('Lowest',  lowest  + '%', parseFloat(lowest)<50?'var(--crimson)':'var(--ink2)') : '',
    withPct.length ? stat('Passed', `${passed}/${withPct.length}`, passed===withPct.length?'var(--green)':'var(--ink2)') : '',
  ].filter(Boolean).join('');
}

/* ═══════════════════════════════════════════════════════════════
   ADD / EDIT ENTRY MODAL
═══════════════════════════════════════════════════════════════ */

/** Open modal for a new entry (no id) or editing an existing one (id = markbook row id) */
function openMarkbookEntryModal(entryId) {
  const modal = document.getElementById('markbookEntryModal');
  const title = document.getElementById('mbModalTitle');
  const delBtn = document.getElementById('mbDeleteBtn');

  // Reset form
  ['mb-id','mb-student-id','mb-assessment','mb-course','mb-year',
   'mb-block','mb-score','mb-max','mb-pct','mb-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('mb-letter').value = '';
  document.getElementById('mb-student-id').value = _mbStudentId || '';
  document.getElementById('mbAutoHint').style.display = 'none';

  if (entryId) {
    // Edit mode — find entry
    const entry = _mbEntries.find(e => e.id === entryId);
    if (!entry) { showToast('Entry not found','error'); return; }

    title.textContent = 'Edit Mark Book Entry';
    delBtn.style.display = 'inline-flex';

    document.getElementById('mb-id').value           = entry.id;
    document.getElementById('mb-assessment').value   = entry.assessment_name || '';
    document.getElementById('mb-course').value       = entry.course_id       || '';
    document.getElementById('mb-year').value         = entry.year            || '';
    document.getElementById('mb-block').value        = entry.block           || '';
    document.getElementById('mb-score').value        = entry.score != null   ? entry.score : '';
    document.getElementById('mb-max').value          = entry.max_score != null ? entry.max_score : '';
    document.getElementById('mb-pct').value          = entry.percentage != null ? entry.percentage : '';
    document.getElementById('mb-letter').value       = entry.letter          || '';
    document.getElementById('mb-notes').value        = entry.notes           || '';
  } else {
    title.textContent = 'Add Mark Book Entry';
    delBtn.style.display = 'none';
  }

  modal.classList.add('open');
}

/** Auto-calculate percentage when score/max change */
function mbAutoPercent() {
  const score = parseFloat(document.getElementById('mb-score').value);
  const max   = parseFloat(document.getElementById('mb-max').value);
  if (!isNaN(score) && !isNaN(max) && max > 0) {
    const pct = ((score / max) * 100).toFixed(2);
    document.getElementById('mb-pct').value = pct;
    mbAutoLetter();
    document.getElementById('mbAutoHint').style.display = 'block';
  }
}

/** Auto-assign letter grade from percentage */
function mbAutoLetter() {
  const pct = parseFloat(document.getElementById('mb-pct').value);
  if (isNaN(pct)) return;
  const sel = document.getElementById('mb-letter');
  // Only auto-fill if still on "auto" or empty
  if (sel.value && sel.value !== '') return;
  sel.value = _mbPctToLetter(pct);
}

/** Map percentage to letter grade */
function _mbPctToLetter(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 85) return 'A';
  if (pct >= 80) return 'A-';
  if (pct >= 75) return 'B+';
  if (pct >= 70) return 'B';
  if (pct >= 65) return 'B-';
  if (pct >= 60) return 'C+';
  if (pct >= 55) return 'C';
  if (pct >= 50) return 'C-';
  if (pct >= 45) return 'D+';
  if (pct >= 40) return 'D';
  return 'F';
}

/** Badge class for a letter grade */
function _mbLetterBadgeClass(letter) {
  if (!letter) return 'b-muted';
  const l = letter.toUpperCase();
  if (l.startsWith('A'))    return 'b-green';
  if (l.startsWith('B'))    return 'b-blue';
  if (l.startsWith('C'))    return 'b-gold';
  if (l === 'PASS')         return 'b-green';
  if (l === 'FAIL' || l === 'F') return 'b-red';
  if (l === 'ABSENT')       return 'b-red';
  return 'b-muted';
}

/** Save a markbook entry (insert or update) */
async function saveMarkbookEntry() {
  const assessment = document.getElementById('mb-assessment').value.trim();
  if (!assessment) { showToast('Assessment name is required', 'error'); return; }

  const id         = document.getElementById('mb-id').value;
  const studentId  = document.getElementById('mb-student-id').value || _mbStudentId;
  const score      = document.getElementById('mb-score').value;
  const max        = document.getElementById('mb-max').value;
  const pct        = document.getElementById('mb-pct').value;
  const letter     = document.getElementById('mb-letter').value;

  const payload = {
    student_id:      studentId,
    assessment_name: assessment,
    course_id:       document.getElementById('mb-course').value.trim() || null,
    year:            document.getElementById('mb-year').value.trim()   || null,
    block:           document.getElementById('mb-block').value.trim()  || null,
    score:           score !== '' ? parseFloat(score) : null,
    max_score:       max   !== '' ? parseFloat(max)   : null,
    percentage:      pct   !== '' ? parseFloat(pct)   : null,
    letter:          letter || null,
    notes:           document.getElementById('mb-notes').value.trim() || null,
    updated_at:      new Date().toISOString(),
  };

  // Auto-compute pct if missing
  if (payload.percentage == null && payload.score != null && payload.max_score) {
    payload.percentage = parseFloat(((payload.score / payload.max_score) * 100).toFixed(4));
  }
  // Auto-compute letter if missing
  if (!payload.letter && payload.percentage != null) {
    payload.letter = _mbPctToLetter(payload.percentage);
  }

  const btn = document.getElementById('mbSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    let error;
    if (id) {
      // Update
      ({ error } = await window._supabase
        .from('markbook')
        .update(payload)
        .eq('id', parseInt(id)));
    } else {
      // Insert
      ({ error } = await window._supabase
        .from('markbook')
        .insert(payload));
    }

    if (error) throw error;

    closeModal('markbookEntryModal');
    showToast(id ? 'Entry updated' : 'Entry added', 'success');
    await loadMarkbook(studentId);
  } catch (err) {
    console.error('saveMarkbookEntry error:', err);
    showToast('Save failed: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg class="ui-icon"><use href="#i-edit"></use></svg> Save Entry';
  }
}

/** Delete a markbook entry */
async function deleteMarkbookEntry() {
  const id = document.getElementById('mb-id').value;
  if (!id) return;
  if (!confirm('Delete this mark book entry? This cannot be undone.')) return;

  try {
    const { error } = await window._supabase
      .from('markbook')
      .delete()
      .eq('id', parseInt(id));
    if (error) throw error;

    closeModal('markbookEntryModal');
    showToast('Entry deleted', 'success');
    await loadMarkbook(_mbStudentId);
  } catch (err) {
    showToast('Delete failed: ' + (err.message || err), 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   CSV UPLOAD
═══════════════════════════════════════════════════════════════ */

let _mbParsedCSV = [];   // parsed rows ready for upload

function openMarkbookCSVUpload() {
  // Reset state
  _mbParsedCSV = [];
  document.getElementById('mbDropLabel').textContent   = 'No file selected';
  document.getElementById('mbPreviewWrap').style.display  = 'none';
  document.getElementById('mbUploadProgress').style.display = 'none';
  document.getElementById('mbErrorWrap').style.display  = 'none';
  document.getElementById('mbUploadBtn').disabled       = true;
  const fi = document.getElementById('mbFileInput');
  fi.value = '';
  document.getElementById('markbookCSVModal').classList.add('open');
}

/** Handle file selection or drop */
function handleMarkbookFile(file) {
  if (!file) return;
  document.getElementById('mbDropLabel').textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const rows = _parseCSV(e.target.result);
      _mbPreviewCSV(rows);
    } catch (err) {
      showToast('CSV parse error: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * Minimal CSV parser — handles quoted fields and commas inside quotes.
 * Returns [{header: value, …}, …]
 */
function _parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const headers = _csvSplitLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));

  const required = ['assessment_name'];
  required.forEach(r => {
    if (!headers.includes(r)) throw new Error(`Missing required column: ${r}`);
  });

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = _csvSplitLine(line);
    const row  = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
    row._lineNum = i + 1;
    rows.push(row);
  }
  return rows;
}

function _csvSplitLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Show preview table for parsed rows */
function _mbPreviewCSV(rows) {
  _mbParsedCSV = rows;
  document.getElementById('mbPreviewCount').textContent = rows.length;
  document.getElementById('mbPreviewWrap').style.display = 'block';
  document.getElementById('mbUploadBtn').disabled = rows.length === 0;

  // Build preview (first 10 rows)
  const cols = ['assessment_name','course_id','year','block','score','max_score','percentage','letter','notes'];
  const head = document.getElementById('mbPreviewHead');
  const body = document.getElementById('mbPreviewBody');

  head.innerHTML = cols.map(c => `<th>${c}</th>`).join('');
  body.innerHTML = rows.slice(0, 10).map(r =>
    `<tr>${cols.map(c => `<td style="font-size:11px">${_esc(r[c] || '')}</td>`).join('')}</tr>`
  ).join('');
  if (rows.length > 10) {
    body.innerHTML += `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--ink3);font-size:11px;padding:8px">
      … and ${rows.length - 10} more rows</td></tr>`;
  }
}

/** Validate and upload parsed CSV rows to Supabase */
async function uploadMarkbookCSV() {
  if (!_mbParsedCSV.length) return;
  if (!_mbStudentId) { showToast('No student selected', 'error'); return; }

  const btn      = document.getElementById('mbUploadBtn');
  const progWrap = document.getElementById('mbUploadProgress');
  const progBar  = document.getElementById('mbProgressBar');
  const progLbl  = document.getElementById('mbProgressLabel');
  const errWrap  = document.getElementById('mbErrorWrap');
  const errBody  = document.getElementById('mbErrorBody');

  btn.disabled = true;
  progWrap.style.display = 'block';
  errWrap.style.display  = 'none';
  errBody.innerHTML = '';
  progBar.style.width = '0%';

  const errors = [];
  const toUpsert = [];

  // Validate rows
  _mbParsedCSV.forEach((row, idx) => {
    if (!row.assessment_name) {
      errors.push({ row: row._lineNum, issue: 'assessment_name is empty' });
      return;
    }
    const scoreNum  = row.score      !== '' ? parseFloat(row.score)      : null;
    const maxNum    = row.max_score  !== '' ? parseFloat(row.max_score)  : null;
    const pctNum    = row.percentage !== '' ? parseFloat(row.percentage) : null;

    if (row.score !== '' && isNaN(scoreNum)) {
      errors.push({ row: row._lineNum, issue: `Invalid score value: "${row.score}"` });
      return;
    }
    if (row.max_score !== '' && isNaN(maxNum)) {
      errors.push({ row: row._lineNum, issue: `Invalid max_score: "${row.max_score}"` });
      return;
    }

    // Compute percentage if missing
    let finalPct = pctNum;
    if (finalPct == null && scoreNum != null && maxNum) {
      finalPct = parseFloat(((scoreNum / maxNum) * 100).toFixed(4));
    }

    // Auto-letter if missing
    let letter = row.letter || null;
    if (!letter && finalPct != null) {
      letter = _mbPctToLetter(finalPct);
    }

    toUpsert.push({
      student_id:      _mbStudentId,
      assessment_name: row.assessment_name,
      course_id:       row.course_id  || null,
      year:            row.year       || null,
      block:           row.block      || null,
      score:           scoreNum,
      max_score:       maxNum,
      percentage:      finalPct,
      letter:          letter,
      notes:           row.notes || null,
      updated_at:      new Date().toISOString(),
    });
  });

  // Show errors if any but still continue with valid rows
  if (errors.length) {
    errWrap.style.display = 'block';
    errBody.innerHTML = errors.map(e =>
      `<tr><td style="font-size:12px;font-family:monospace">${e.row}</td>
            <td style="font-size:12px;color:var(--crimson)">${_esc(e.issue)}</td></tr>`
    ).join('');
    if (!toUpsert.length) {
      progWrap.style.display = 'none';
      btn.disabled = false;
      return;
    }
  }

  // Upload in chunks of 50
  const CHUNK = 50;
  let done = 0;
  const allErrors = [...errors];

  for (let i = 0; i < toUpsert.length; i += CHUNK) {
    const chunk = toUpsert.slice(i, i + CHUNK);
    progLbl.textContent = `Uploading rows ${i + 1}–${Math.min(i + CHUNK, toUpsert.length)} of ${toUpsert.length}…`;

    try {
      // Upsert on (student_id, assessment_name, year, block) uniqueness
      // Since there's no unique constraint defined in the schema, we do a soft upsert:
      // try to find existing rows matching key fields, update them, insert the rest.
      for (const row of chunk) {
        // Look for existing row with same student + assessment + year + block
        const match = _mbEntries.find(e =>
          e.student_id      === row.student_id &&
          e.assessment_name === row.assessment_name &&
          (e.year  || null) === (row.year  || null) &&
          (e.block || null) === (row.block || null)
        );

        if (match) {
          const { error } = await window._supabase
            .from('markbook')
            .update(row)
            .eq('id', match.id);
          if (error) throw error;
        } else {
          const { error } = await window._supabase
            .from('markbook')
            .insert(row);
          if (error) throw error;
        }
        done++;
        progBar.style.width = `${Math.round((done / toUpsert.length) * 100)}%`;
      }
    } catch (err) {
      console.error('uploadMarkbookCSV chunk error:', err);
      allErrors.push({ row: `rows ${i+1}–${i+CHUNK}`, issue: err.message || String(err) });
    }
  }

  progLbl.textContent = `Done — ${done} row${done!==1?'s':''} saved.`;
  progBar.style.width = '100%';

  if (allErrors.length) {
    errWrap.style.display = 'block';
    errBody.innerHTML = allErrors.map(e =>
      `<tr><td style="font-size:12px;font-family:monospace">${e.row}</td>
            <td style="font-size:12px;color:var(--crimson)">${_esc(e.issue)}</td></tr>`
    ).join('');
  }

  showToast(`Mark book updated — ${done} entr${done!==1?'ies':'y'} saved.`, 'success');
  btn.disabled = false;

  // Reload table
  await loadMarkbook(_mbStudentId);
}

/* ═══════════════════════════════════════════════════════════════
   CSV EXPORT & TEMPLATE
═══════════════════════════════════════════════════════════════ */

/** Export the currently-filtered markbook data as a CSV */
function exportMarkbookCSV() {
  if (!_mbFiltered.length) { showToast('Nothing to export', 'error'); return; }

  const headers = ['assessment_name','course_id','year','block','score','max_score','percentage','letter','notes'];
  const lines   = [headers.join(',')];

  _mbFiltered.forEach(e => {
    lines.push(headers.map(h => {
      const val = e[h] != null ? String(e[h]) : '';
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g,'""')}"`
        : val;
    }).join(','));
  });

  _mbDownload(lines.join('\n'), `markbook_${_mbStudentId}_${_isoDate()}.csv`, 'text/csv');
  showToast('CSV exported', 'success');
}

/** Download a blank template CSV */
function downloadMarkbookTemplate() {
  const lines = [
    'assessment_name,course_id,year,block,score,max_score,percentage,letter,notes',
    'Mid-Term Exam,CRS015,M-1,Block 1,78.5,100,78.50,B+,Good effort',
    'Lab Report 2,CRS022,M-1,Block 2,45,50,90.00,A,Excellent',
    'OSCE Station 3,,Foundation Year,,62,80,,,',
  ];
  _mbDownload(lines.join('\n'), 'markbook_template.csv', 'text/csv');
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _isoDate() {
  return new Date().toISOString().slice(0,10);
}

function _mbDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fallback showToast — uses the app's existing toast if available,
 * otherwise falls back to a simple alert.
 */
function showToast(msg, type) {
  if (typeof window.showNotifToast === 'function') {
    window.showNotifToast(msg, type === 'error' ? 'Error' : 'Mark Book', type === 'error' ? '#E84040' : '#1A7A45');
    return;
  }
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    window.showToast(msg, type); return;
  }
  // Minimal inline toast
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type==='error'?'#8B1A2E':'#1A5438'};color:#fff;
    padding:12px 18px;border-radius:8px;font-size:13px;font-weight:500;
    box-shadow:0 4px 20px rgba(0,0,0,.25);animation:toastIn .3s ease`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ── Expose public API ── */
window.loadMarkbook          = loadMarkbook;
window.filterMarkbook        = filterMarkbook;
window.openMarkbookEntryModal = openMarkbookEntryModal;
window.saveMarkbookEntry     = saveMarkbookEntry;
window.deleteMarkbookEntry   = deleteMarkbookEntry;
window.mbAutoPercent         = mbAutoPercent;
window.mbAutoLetter          = mbAutoLetter;
window.openMarkbookCSVUpload = openMarkbookCSVUpload;
window.handleMarkbookFile    = handleMarkbookFile;
window.uploadMarkbookCSV     = uploadMarkbookCSV;
window.exportMarkbookCSV     = exportMarkbookCSV;
window.downloadMarkbookTemplate = downloadMarkbookTemplate;
