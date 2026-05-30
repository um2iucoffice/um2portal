// ══════════════════════════════════════
// Multi-Degree Academic Journey
// ══════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// MULTI-DEGREE — Academic Journey Tab + New Enrollment Modal
// ══════════════════════════════════════════════════════════════

const DEGREE_LEVEL_ICON  = { bachelor:'🎓', master:'📖', phd:'⚗️' };
const DEGREE_LEVEL_LABEL = { bachelor:'Bachelor', master:'Master', phd:'PhD / Doctoral' };
const DEGREE_LEVEL_CSS   = { bachelor:'bach', master:'mast', phd:'phd' };

function degLvlIcon(l)  { return DEGREE_LEVEL_ICON[l]  || '🎓'; }
function degLvlLabel(l) { return DEGREE_LEVEL_LABEL[l] || 'Bachelor'; }
function degLvlCss(l)   { return DEGREE_LEVEL_CSS[l]   || 'bach'; }


// ── Load and render the Academic Journey tab ──────────────────
async function loadJourneyTab() {
  const sid = currentProfileId;
  if (!sid) return;
  const tl   = document.getElementById('journeyTimeline');
  const tabs = document.getElementById('journeyGradeTabs');
  const pans = document.getElementById('journeyGradePanels');
  if (!tl) return;
  tl.innerHTML = '<div style="color:var(--ink3);font-size:13px">Loading enrollments…</div>';

  try {
    const { data: rows, error } = await db
      .from('degree_enrollments')
      .select('*, degree_programs(id, name, level)')
      .eq('student_id', sid)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const enrollments = rows || [];

    if (!enrollments.length) {
      tl.innerHTML = '<div style="color:var(--ink3);font-size:13px;padding:8px 0">No degree enrollment records found. This student was likely created before the multi-degree migration. Use <strong>+ Admit to New Degree</strong> to add one.</div>';
      if (tabs) tabs.innerHTML = '';
      if (pans) pans.innerHTML = '';
      return;
    }

    // ── Timeline rows ──
    tl.innerHTML = enrollments.map((e, i) => {
      const lvl   = degLvlCss(e.degree_level);
      const prog  = (e.degree_programs || {}).name || e.degree_program_id || '—';
      const isGrd = /graduated|completed/i.test(e.graduation_status || '');
      const statusBadge = isGrd
        ? '<span class="badge b-green">Graduated</span>'
        : e.enrollment_status === 'Active'
          ? '<span class="badge b-gold">Active</span>'
          : `<span class="badge b-muted">${e.enrollment_status || '—'}</span>`;
      let meta = e.current_year || '';
      if (e.admission_date)  meta += (meta ? ' · ' : '') + 'Admitted ' + e.admission_date;
      if (isGrd && e.graduation_date) meta += ' · Graduated ' + e.graduation_date;
      const gpaStr = e.gpa != null ? Number(e.gpa).toFixed(2) : '—';
      return `
        <div class="degree-stack-row ${i===0?'active':''}" onclick="highlightJourneyRow(this)">
          <div class="ds-pip ${lvl}"></div>
          <div class="ds-icon ${lvl}">${degLvlIcon(e.degree_level)}</div>
          <div class="ds-info">
            <div class="ds-lvl ${lvl}">${degLvlLabel(e.degree_level)}</div>
            <div class="ds-name">${prog}</div>
            <div class="ds-meta">${meta}${e.thesis_title ? '<br><em style="font-size:11px;color:var(--ink3)">"'+e.thesis_title+'"</em>' : ''}${e.supervisor ? '<br><span style="font-size:11px;color:var(--ink3)">Supervisor: '+e.supervisor+'</span>' : ''}</div>
          </div>
          <div style="margin-left:8px">${statusBadge}</div>
          <div class="ds-gpa">
            <div class="ds-gpa-val" style="color:var(--${lvl})">${gpaStr}</div>
            <div class="ds-gpa-den">/ 4.00</div>
          </div>
        </div>`;
    }).join('');

    // ── Grade tabs per degree ──
    if (tabs && pans) {
      tabs.innerHTML = enrollments.map((e, i) => {
        const prog = (e.degree_programs || {}).name || e.degree_program_id || 'Degree ' + (i+1);
        return `<div class="tab${i===0?' active':''}" onclick="switchJourneyGradeTab(${i}, this)">${degLvlIcon(e.degree_level)} ${prog}</div>`;
      }).join('');

      // Load grades for each enrollment (filtered by enrollment_id if supported)
      const { data: allGrades } = await db
        .from('grades')
        .select('*')
        .eq('StudentID', sid)
        .order('CourseID', { ascending: true });

      pans.innerHTML = enrollments.map((e, i) => {
        const gradeRows = (allGrades || []).filter(g => !g.enrollment_id || g.enrollment_id === e.id);
        if (!gradeRows.length) {
          return `<div class="tab-panel${i===0?' active':''}" id="jgp-${i}"><div style="color:var(--ink3);font-size:13px;padding:12px 0">No grades linked to this enrollment.</div></div>`;
        }
        const rows = gradeRows.map(g => `
          <tr>
            <td style="font-family:monospace;color:var(--crimson);font-size:12px">${g.course_id || g.CourseID || g.courseid || '—'}</td>
            <td>${g.course || '—'}</td>
            <td style="text-align:center">${g.year || '—'}</td>
            <td style="text-align:center">${g.score != null ? g.score : (g.NumericScore != null ? g.NumericScore : '—')}</td>
            <td style="text-align:center"><span class="badge b-blue">${g.letter || '—'}</span></td>
            <td style="text-align:center">${g.gp != null ? g.gp : '—'}</td>
          </tr>`).join('');
        return `<div class="tab-panel${i===0?' active':''}" id="jgp-${i}">
          <div class="table-wrap">
            <table><thead><tr><th>Course ID</th><th>Course</th><th>Year</th><th>Score</th><th>Grade</th><th>GP</th></tr></thead>
            <tbody>${rows}</tbody></table>
          </div>
        </div>`;
      }).join('');
    }

  } catch (err) {
    tl.innerHTML = `<div style="color:var(--crimson);font-size:13px">Error loading enrollments: ${err.message}</div>`;
  }
}

function highlightJourneyRow(el) {
  document.querySelectorAll('#journeyTimeline .degree-stack-row').forEach(r => r.classList.remove('active'));
  el.classList.add('active');
}

function switchJourneyGradeTab(idx, btn) {
  document.querySelectorAll('#journeyGradePanels .tab-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
  btn.closest('.tabs').querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === idx));
}

// ── Open "Admit to New Degree" modal ─────────────────────────
async function openAddEnrollmentModal(sid) {
  if (!sid) return;
  document.getElementById('nem-studentId').value = sid;
  document.getElementById('newEnrollmentModal').classList.add('open');
  await nemUpdatePrograms();
}

// ── Populate program options based on selected level ─────────
// Loads live from degree_programs table filtered by level.
// Falls back to the global degreePrograms cache if DB call fails.
async function nemUpdatePrograms() {
  const level   = document.getElementById('nem-level').value;
  const progSel = document.getElementById('nem-program');
  const yearSel = document.getElementById('nem-year');

  progSel.innerHTML = '<option value="">Loading…</option>';
  yearSel.innerHTML  = '<option value="">Loading…</option>';

  // ── 1. Load matching degree programs from DB ──────────────
  let programs = [];
  try {
    const { data, error } = await db
      .from('degree_programs')
      .select('id, name, year_sequence, status')
      .eq('level', level)
      .eq('status', 'Active')
      .order('name', { ascending: true });
    if (error) throw error;
    programs = data || [];
  } catch (err) {
    console.warn('nemUpdatePrograms: DB fetch failed, using cache.', err);
    // Fall back to global cache loaded at startup
    programs = (typeof degreePrograms !== 'undefined' ? degreePrograms : [])
      .filter(p => (p.level || 'bachelor') === level && p.status !== 'Inactive');
  }

  if (programs.length) {
    progSel.innerHTML = programs
      .map(p => `<option value="${p.id}">${p.name || p.id}</option>`)
      .join('');
  } else {
    progSel.innerHTML = '<option value="">— No programs found for this level —</option>';
  }

  // ── 2. Populate year options from the selected program ────
  nemUpdateYears(programs);

  // Re-populate years whenever program changes
  progSel.onchange = () => nemUpdateYears(programs);
}

// ── Populate year select from chosen program's year_sequence ─
function nemUpdateYears(programs) {
  const progSel = document.getElementById('nem-program');
  const yearSel = document.getElementById('nem-year');
  const prog    = programs.find(p => p.id === progSel.value);

  let years = [];
  if (prog && prog.year_sequence) {
    years = prog.year_sequence.split(',').map(s => s.trim()).filter(Boolean);
  }

  // If no year_sequence defined on the program, fall back to academic_years cache
  if (!years.length && typeof academicYears !== 'undefined') {
    years = academicYears.map(y => y.name);
  }

  yearSel.innerHTML = years.length
    ? years.map(y => `<option value="${y}">${y}</option>`).join('')
    : '<option value="">— No years defined —</option>';
}

// ── Save new enrollment to Supabase ──────────────────────────
async function saveNewEnrollment() {
  const sid        = document.getElementById('nem-studentId').value;
  const level      = document.getElementById('nem-level').value;
  const programId  = document.getElementById('nem-program').value;
  const year       = document.getElementById('nem-year').value;
  const admDate    = getDateValue('nem-date') || null;
  const thesis     = document.getElementById('nem-thesis').value.trim() || null;
  const supervisor = document.getElementById('nem-supervisor').value.trim() || null;

  if (!sid || !level || !programId) {
    toast('Please fill in all required fields.', '⚠️'); return;
  }

  try {
    const { error } = await db.from('degree_enrollments').insert({
      student_id:        sid,
      degree_program_id: programId,
      degree_level:      level,
      current_year:      year,
      enrollment_status: 'Active',
      admission_date:    admDate,
      thesis_title:      thesis,
      supervisor:        supervisor,
    });
    if (error) throw error;

    // Also update the students row to reflect the new active program
    await db.from('students').update({
      program:      programId,
      year:         year,
      degree_level: level,
    }).eq('id', sid);

    toast(`✅ ${sid} admitted to ${degLvlLabel(level)} — ${programId}`, '🎓');
    closeModal('newEnrollmentModal');
    // Reload journey tab if it's visible
    if (document.getElementById('tab-journey')?.classList.contains('active')) {
      loadJourneyTab();
    }
    // Refresh student list
    if (typeof loadStudents === 'function') loadStudents();
  } catch (err) {
    toast('Error saving enrollment: ' + err.message, '❌');
  }
}

// ── nsUpdateLevelFields — show thesis/supervisor in Add Student form ──
function nsUpdateLevelFields() {
  const level = document.getElementById('ns-level').value;
  const tg = document.getElementById('ns-thesisGroup');
  const sg = document.getElementById('ns-supervisorGroup');
  if (tg) tg.style.display = (level === 'master' || level === 'phd') ? '' : 'none';
  if (sg) sg.style.display = level === 'phd' ? '' : 'none';
}
