// ══════════════════════════════════════
// Courses
// ══════════════════════════════════════

// COURSES
// ══════════════════════════════════════════
function renderCoursesTable() {
  const cb = document.getElementById('coursesBody');
  if (!cb) return;
  cb.innerHTML = '';
  if (!courses.length) {
    cb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--ink3)">No courses found. Add courses or use Bulk Import.</td></tr>`;
    return;
  }
  courses.forEach(c => {
    cb.innerHTML += `<tr id="course-row-${c[0]}">
      <td class="text-mono text-crimson">${c[0]}</td>
      <td><strong>${c[1]}</strong></td>
      <td><span class="badge b-blue">${c[2]||'—'}</span></td>
      <td class="text-muted">${c[3]||'—'}</td>
      <td>${c[4]||'—'}</td><td>${c[5]||'—'}</td>
      <td class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="openCourseModal('${c[0]}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteCourse('${c[0]}','${c[1].replace(/'/g,"\\'")}')">Delete</button>
      </td>
    </tr>`;
  });
}

function openCourseModal(cid) {
  document.getElementById('courseModalTitle').textContent = cid ? 'Edit Course — ' + cid : 'Add Course';
  const idInput = document.getElementById('cm-id');
  if (cid) {
    const c = courses.find(x => x[0] === cid);
    if (c) {
      idInput.value = c[0]; idInput.readOnly = true;
      document.getElementById('cm-name').value    = c[1];
      document.getElementById('cm-year').value    = c[2] || (academicYears[0] ? academicYears[0].name : '');
      document.getElementById('cm-block').value   = c[3] || '';
      document.getElementById('cm-credits').value = c[4] || '';
      document.getElementById('cm-assess').value  = c[5] || '';
      // Load program checkboxes for this course
      renderCourseProgramCheckboxes(cid);
    }
  } else {
    idInput.readOnly = false;
    // Reset all fields including year select to first option
    ['cm-id','cm-name','cm-block','cm-credits','cm-assess','cm-year'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    renderCourseProgramCheckboxes(null);
    const cmStatus = document.getElementById('cm-status');
    if (cmStatus) cmStatus.value = 'Active';
  }
  document.getElementById('courseModal').classList.add('open');
}

async function saveCourse() {
  const id   = document.getElementById('cm-id').value.trim();
  const name = document.getElementById('cm-name').value.trim();
  if (!id || !name) { toast('Course ID and Name are required.', 'Notice'); return; }
  const year    = document.getElementById('cm-year').value;
  const block   = document.getElementById('cm-block').value;
  const cr      = parseInt(document.getElementById('cm-credits').value) || 0;
  const ass     = document.getElementById('cm-assess').value;
  const selectedPrograms = Array.from(document.querySelectorAll('#cm-programs-list input[type=checkbox]:checked')).map(cb => cb.value);
  const status  = document.getElementById('cm-status').value || 'Active';

  const record = { id, name, year, block_module: block, credits: cr, assessment_type: ass, status };
  const existIdx = courses.findIndex(c => c[0] === id);

  const { error } = await db.from('courses').upsert(record, { onConflict: 'id' });
  if (error) { toast('Save failed: ' + error.message, 'DB Error'); return; }

  // Sync course_programs junction table
  await db.from('course_programs').delete().eq('course_id', id);
  if (selectedPrograms.length) {
    await db.from('course_programs').insert(selectedPrograms.map(pid => ({ course_id: id, program_id: pid })));
  }
  coursePrograms[id] = selectedPrograms;

  // courses array: [id, name, year, block, cr, ass, status]
  const entry = [id, name, year, block, cr, ass, status];
  if (existIdx >= 0) {
    courses[existIdx] = entry;
    const row = document.getElementById('course-row-' + id);
    if (row) row.innerHTML = buildCourseRowHtml(id, name, year, block, cr, ass);
    toast(`Course ${id} updated.`, 'Notice');
  } else {
    courses.push(entry);
    const cb = document.getElementById('coursesBody');
    const tr = document.createElement('tr');
    tr.id = 'course-row-' + id;
    tr.innerHTML = buildCourseRowHtml(id, name, year, block, cr, ass);
    cb.appendChild(tr);
    document.getElementById('dashCourseCount').textContent = courses.length;
    toast(`Course ${id} added.`, 'Notice');
  }
  // Reset readOnly so "Add Course" works next time
  document.getElementById('cm-id').readOnly = false;
  closeModal('courseModal');
  populateAllSelects();
  updateDashboardStats();
}

function buildCourseRowHtml(id, name, year, block, cr, ass) {
  return `<td class="text-mono text-crimson">${id}</td>
    <td><strong>${name}</strong></td>
    <td><span class="badge b-blue">${year}</span></td>
    <td class="text-muted">${block}</td>
    <td>${cr}</td><td>${ass}</td>
    <td class="flex gap-2">
      <button class="btn btn-outline btn-sm" onclick="openCourseModal('${id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteCourse('${id}','${name.replace(/'/g,"\\'")}')">Delete</button>
    </td>`;
}


function renderCourseProgramCheckboxes(cid) {
  const container = document.getElementById('cm-programs-list');
  if (!container) return;
  const selected = cid ? (coursePrograms[cid] || []) : [];
  if (!degreePrograms.length) {
    container.innerHTML = '<span style="font-size:12px;color:var(--ink3)">No programs loaded yet.</span>';
    return;
  }
  container.innerHTML = degreePrograms.map(p => {
    const checked = selected.includes(p.id) ? 'checked' : '';
    return `<label style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--white);cursor:pointer;font-size:12px;font-weight:500">
      <input type="checkbox" value="${p.id}" ${checked} style="accent-color:var(--crimson)">
      ${p.id}${p.name ? ' <span style="color:var(--ink3);font-weight:400">— ' + p.name + '</span>' : ''}
    </label>`;
  }).join('');
}

function confirmDeleteCourse(cid, cname) {
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Course';
  document.getElementById('confirmDeleteMsg').innerHTML =
    `Are you sure you want to delete course <strong>${cname}</strong>?<br>
    <span class="text-mono text-crimson">${cid}</span><br><br>This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('courses').delete().eq('id', cid);
    if (error) { toast('Delete failed: ' + error.message, 'DB Error'); return; }
    courses = courses.filter(c => c[0] !== cid);
    const row = document.getElementById('course-row-' + cid);
    if (row) row.remove();
    document.getElementById('dashCourseCount').textContent = courses.length;
    toast(`Course ${cid} deleted.`, 'Notice');
    closeModal('confirmDeleteModal');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

// BULK COURSE IMPORT
function downloadCourseTemplate() {
  downloadCSV('bulk_course_import_template.csv', 'course_id,course_name,year,block_module,credits,assessment_type,program_id\nCRS020,Neuroscience,M-1,Integrated System Modules,8,In-block exam,MBBS\nCRS021,Endocrinology,M-1,Integrated System Modules,8,In-block exam,MBBS');
}

function handleBulkCourseCSV(input) {
  const file = (input.files || input)[0];
  if (!file) return;
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: function(results) {
      const required = ['course_id','course_name','year'];
      const missing  = required.filter(r => !(results.meta.fields||[]).includes(r));
      if (missing.length) { toast(`Missing columns: ${missing.join(', ')}`, 'Notice'); return; }
      bulkCourseRows = results.data;
      let errors = 0;
      const tbl = document.getElementById('coursePreviewTable');
      tbl.innerHTML = `<thead><tr><th>#</th><th>Course ID</th><th>Course Name</th><th>Year</th><th>Program</th><th>Block/Module</th><th>Credits</th><th>Assessment</th><th>Status</th></tr></thead>`;
      const tbody = document.createElement('tbody');
      bulkCourseRows.forEach((row, i) => {
        const err = !row.course_id ? 'Missing course_id' : !row.course_name ? 'Missing course_name' : !row.year ? 'Missing year' : '';
        if (err) errors++;
        const exists = courses.some(c => c[0] === row.course_id);
        const statusBadge = err ? `<span class="badge b-red">⚠ ${err}</span>` : exists ? `<span class="badge b-blue">Update</span>` : `<span class="badge b-green">Insert</span>`;
        const progVal = (row.program_id || '').trim() || 'MBBS';
        const tr = document.createElement('tr');
        if (err) tr.className = 'bulk-row-err'; else if (exists) tr.className = 'bulk-row-ok';
        tr.innerHTML = `<td class="text-muted">${i+1}</td><td class="text-mono text-crimson">${row.course_id||'—'}</td><td><strong>${row.course_name||'—'}</strong></td><td><span class="badge b-blue">${row.year||'—'}</span></td><td><span class="badge b-muted">${progVal}</span></td><td class="text-muted">${row.block_module||'—'}</td><td>${row.credits||'—'}</td><td>${row.assessment_type||'—'}</td><td>${statusBadge}</td>`;
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      document.getElementById('coursePreviewCount').textContent  = bulkCourseRows.length;
      document.getElementById('coursePreviewErrors').textContent = errors + ' errors';
      document.getElementById('coursePreviewArea').style.display = '';
      document.getElementById('courseResultCard').style.display  = 'none';
      // Populate fallback program dropdown from degreePrograms
      const fpSel = document.getElementById('course-fallback-program');
      if (fpSel) {
        fpSel.innerHTML = degreePrograms.map(p =>
          `<option value="${p.id}"${p.id === 'MBBS' ? ' selected' : ''}>${p.id}${p.name ? ' — ' + p.name : ''}</option>`
        ).join('');
        if (!fpSel.value && degreePrograms.length) fpSel.value = degreePrograms[0].id;
      }
    }
  });
}

async function submitBulkCourses() {
  let inserted = 0, updated = 0, errored = 0;
  const resultTbl = document.getElementById('courseResultTable');
  resultTbl.innerHTML = `<thead><tr><th>Course ID</th><th>Course Name</th><th>Year</th><th>Result</th></tr></thead>`;
  const tbody = document.createElement('tbody');

  for (const row of bulkCourseRows) {
    if (!row.course_id || !row.course_name || !row.year) {
      errored++;
      const tr = document.createElement('tr'); tr.className = 'bulk-row-err';
      tr.innerHTML = `<td class="text-mono">${row.course_id||'—'}</td><td>${row.course_name||'—'}</td><td>${row.year||'—'}</td><td><span class="badge b-red">Error — missing required field</span></td>`;
      tbody.appendChild(tr); continue;
    }
    const fallbackProg = (document.getElementById('course-fallback-program')?.value || 'MBBS');
    const fallbackProgVal = (row.program_id||'').trim() || fallbackProg;
    const record = { id: row.course_id, name: row.course_name, year: row.year, block_module: row.block_module||'', credits: parseInt(row.credits)||0, assessment_type: row.assessment_type||'' };
    const { error } = await db.from('courses').upsert(record, { onConflict: 'id' });
    // Sync junction table for bulk import (single program per row)
    if (!error) {
      await db.from('course_programs').delete().eq('course_id', row.course_id);
      await db.from('course_programs').insert({ course_id: row.course_id, program_id: fallbackProgVal });
      coursePrograms[row.course_id] = [fallbackProgVal];
    }
    const existIdx = courses.findIndex(c => c[0] === row.course_id);
    const entry = [row.course_id, row.course_name, row.year, row.block_module||'', parseInt(row.credits)||0, row.assessment_type||'', (row.program_id||'').trim() || fallbackProg];
    const tr = document.createElement('tr'); tr.className = 'bulk-row-ok';
    if (error) {
      errored++;
      tr.className = 'bulk-row-err';
      tr.innerHTML = `<td class="text-mono">${row.course_id}</td><td>${row.course_name}</td><td>${row.year}</td><td><span class="badge b-red">✗ DB Error</span></td>`;
    } else if (existIdx >= 0) {
      updated++; courses[existIdx] = entry;
      tr.innerHTML = `<td class="text-mono text-crimson">${row.course_id}</td><td><strong>${row.course_name}</strong></td><td><span class="badge b-blue">${row.year}</span></td><td><span class="badge b-blue">✓ Updated</span></td>`;
    } else {
      inserted++; courses.push(entry);
      tr.innerHTML = `<td class="text-mono text-crimson">${row.course_id}</td><td><strong>${row.course_name}</strong></td><td><span class="badge b-blue">${row.year}</span></td><td><span class="badge b-green">✓ Inserted</span></td>`;
    }
    tbody.appendChild(tr);
  }
  resultTbl.appendChild(tbody);
  document.getElementById('courseInsertCount').textContent = inserted + ' inserted';
  document.getElementById('courseUpdateCount').textContent = updated + ' updated';
  document.getElementById('courseErrorCount').textContent  = errored + ' errors';
  document.getElementById('courseResultCard').style.display  = '';
  document.getElementById('coursePreviewArea').style.display = 'none';
  const bar = document.getElementById('courseProgressBar');
  bar.style.width = '0';
  setTimeout(() => bar.style.width = (bulkCourseRows.length ? (inserted+updated)/bulkCourseRows.length*100 : 0) + '%', 100);
  renderCoursesTable();
  document.getElementById('dashCourseCount').textContent = courses.length;
  toast(`Courses imported: ${inserted} added, ${updated} updated, ${errored} errors.`, 'Notice');
}

// ══════════════════════════════════════════
