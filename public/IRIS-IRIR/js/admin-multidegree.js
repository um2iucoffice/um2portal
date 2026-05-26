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

// ── Supabase REST helper (mirrors login.js approach, uses supabase-js client) ──
async function sbFetch(table, queryString, useService = true) {
  // Uses the already-initialized supabase client from the registrar
  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .or(queryString);  // simplified; replace with proper filter chain as needed
  if (error) throw error;
  return data || [];
}

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
    const { data: rows, error } = await supabaseClient
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
      const { data: allGrades } = await supabaseClient
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
function openAddEnrollmentModal(sid) {
  if (!sid) return;
  document.getElementById('nem-studentId').value = sid;
  nemUpdatePrograms();
  document.getElementById('newEnrollmentModal').classList.add('open');
}

// ── Populate program options based on selected level ─────────
function nemUpdatePrograms() {
  const level = document.getElementById('nem-level').value;
  const progSel = document.getElementById('nem-program');
  const yearSel = document.getElementById('nem-year');

  // Filter degreePrograms (global array from registrar) by level
  // degreePrograms is the existing global holding all degree program records
  const filtered = (typeof degreePrograms !== 'undefined' ? degreePrograms : [])
    .filter(p => (p.level || 'bachelor') === level);

  if (filtered.length) {
    progSel.innerHTML = filtered.map(p => `<option value="${p.id}">${p.name || p.id}</option>`).join('');
  } else {
    // Fallback: show hardcoded defaults
    const defaults = {
      master: [{ id:'MMEDSCI', name:'Master of Medical Science' },{ id:'MSC_ANAT', name:'M.Sc. Anatomy' }],
      phd:    [{ id:'PHD_MED', name:'Doctor of Philosophy (Medicine)' }],
    };
    progSel.innerHTML = (defaults[level] || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  // Year options per level
  const yearOptions = {
    master: ['Year 1','Year 2','Year 3'],
    phd:    ['Research Year 1','Research Year 2','Research Year 3','Research Year 4'],
  };
  yearSel.innerHTML = (yearOptions[level] || ['Year 1']).map(y => `<option>${y}</option>`).join('');
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
    const { error } = await supabaseClient.from('degree_enrollments').insert({
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
    await supabaseClient.from('students').update({
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

