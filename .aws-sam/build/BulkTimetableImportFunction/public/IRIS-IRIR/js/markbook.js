// ── Academic Journey (home panel, 2+ enrollments only) ───────
function renderJourney(enrollments) {
  const card = document.getElementById('journeyCard');
  const rows = document.getElementById('journeyRows');
  if (!card || !rows) return;
  if (!enrollments || enrollments.length < 2) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  rows.innerHTML = enrollments.map((e, i) => {
    const label    = e.programName || e.degreeProgramId || 'Degree Program';
    const lvl      = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD / Doctoral' }[e.degreeLevel] || 'Bachelor';
    const grad     = /graduated|completed/i.test(e.graduationStatus || '');
    const badge    = grad
      ? '<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:var(--green-light,#e6f4ec);color:var(--green,#1a5c3a);padding:2px 8px;border-radius:3px;margin-left:8px">Graduated</span>'
      : '<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:var(--gold-light,#fdf6e3);color:var(--gold,#9a7b2f);padding:2px 8px;border-radius:3px;margin-left:8px">Active</span>';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < enrollments.length - 1 ? 'border-bottom:1px solid var(--border,#e8e8e8)' : ''}">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--crimson,#8B1A2E);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--ink,#0D1B2A)">${lvl} — ${label}</div>
        ${e.admissionDate ? `<div style="font-size:11px;color:var(--ink3,#888);margin-top:2px">Admitted: ${e.admissionDate}</div>` : ''}
      </div>
      ${badge}
    </div>`;
  }).join('');
}

// ── Mark Book ─────────────────────────────────────────────────
// Renders internal assessment marks (tests/evaluations) into #markbookContent.
// markbook rows are expected to have: courseId, course, assessmentName,
// maxScore, score, percentage, grade, year, notes (all optional except courseId).
function renderMarkbook(student, markbook, grades) {
  const container = document.getElementById('markbookContent');
  if (!container) return;

  // If no markbook data, fall back to showing grades as assessments
  const rows = markbook && markbook.length > 0 ? markbook : [];

  if (rows.length === 0) {
    container.innerHTML = '<div class="g-wrap"><div class="no-g">No assessment records yet.</div></div>';
    return;
  }

  // Group by academic year then by course
  const groups = {};
  rows.forEach(r => {
    const courseId   = String(r.courseId || r.course_id || '').trim().toUpperCase();
    const courseMeta = COURSES[courseId] || { name: r.course || r.courseName || courseId || '—', year: r.year || 'Other', block: r.block || 'General' };
    const yr         = r.year || courseMeta.year || 'Other';
    const block      = r.block || courseMeta.block || r.course || courseMeta.name || 'General';
    if (!groups[yr])        groups[yr]        = {};
    if (!groups[yr][block]) groups[yr][block] = [];
    groups[yr][block].push(Object.assign({}, r, { courseId: courseId, courseMeta: courseMeta }));
  });

  // Year ordering — follow catalogue order
  const catalogYearOrder = [];
  Object.values(COURSES).forEach(c => {
    if (c.year && !catalogYearOrder.includes(c.year)) catalogYearOrder.push(c.year);
  });
  const metaOrder  = (PROGRAM_META && PROGRAM_META.yearOrder) ? PROGRAM_META.yearOrder : [];
  const mergedOrder = catalogYearOrder.concat(metaOrder.filter(function(y) { return !catalogYearOrder.includes(y); }));
  const order = mergedOrder.filter(function(y) { return groups[y]; }).concat(Object.keys(groups).filter(function(y) { return !mergedOrder.includes(y); }).sort());

  let totalAssessments = rows.length;
  let sumPct = 0, pctCount = 0;
  rows.forEach(r => {
    const pct = r.percentage != null && r.percentage !== '' ? parseFloat(r.percentage) : null;
    if (pct != null && !isNaN(pct)) { sumPct += pct; pctCount++; }
  });
  const avgPct = pctCount > 0 ? (sumPct / pctCount).toFixed(1) + '%' : '—';

  let html = '';

  order.forEach(yr => {
    const blockMap       = groups[yr] || {};
    const allRowsInYear  = Object.values(blockMap).flat();
    html += `<div class="g-wrap">`;
    html += `<div class="g-year-head">${escHtml(yr)}</div>`;

    Object.entries(blockMap).forEach(([blockName, brows]) => {
      html += `<div class="g-block-head">${escHtml(blockName)}</div>`;
      html += `<table class="gt">
        <thead>
          <tr>
            <th style="width:10%">Code</th>
            <th style="width:28%">Assessment</th>
            <th style="text-align:center;width:12%">Max Score</th>
            <th style="text-align:center;width:12%">Score</th>
            <th style="text-align:center;width:12%">Percentage</th>
            <th style="text-align:center;width:10%">Grade</th>
            <th style="width:16%">Notes</th>
          </tr>
        </thead>
        <tbody>`;

      brows.forEach(r => {
        const maxScore  = r.maxScore  != null && r.maxScore  !== '' ? r.maxScore  : (r.max_score != null && r.max_score !== '' ? r.max_score : '—');
        const score     = r.score     != null && r.score     !== '' ? r.score     : '—';
        const pct       = r.percentage != null && r.percentage !== '' ? r.percentage + '%' : (maxScore !== '—' && score !== '—' ? (parseFloat(score)/parseFloat(maxScore)*100).toFixed(1) + '%' : '—');
        const asmtName  = r.assessmentName || r.assessment_name || r.courseMeta.name || '—';
        const gradeVal  = r.grade || r.letter || '';
        const hasGrade  = gradeVal && String(gradeVal).trim() && String(gradeVal).trim() !== '—';
        const gradedIcon = hasGrade ? `<svg class="gt-graded-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : '';
        const gradeDisplay = escHtml(gradeVal || '—').replace(/\+/g, '<sup>+</sup>').replace(/-/g, '<sup>−</sup>');
        const noteVal   = r.notes || r.note || r.remarks || '';
        html += `<tr>
          <td style="font-size:11px;color:var(--ink3);font-family:monospace">${escHtml(r.courseId || '—')}</td>
          <td><div class="gt-course gt-course-graded">${gradedIcon}${escHtml(asmtName)}</div></td>
          <td style="text-align:center"><span class="gt-cr">${escHtml(String(maxScore))}</span></td>
          <td style="text-align:center"><span class="sbar-num">${escHtml(String(score))}</span></td>
          <td style="text-align:center;font-size:12px;color:var(--ink2)">${escHtml(pct)}</td>
          <td style="text-align:center"><span class="gbadge ${gc(gradeVal)}">${gradeDisplay}</span></td>
          <td style="font-size:11px;color:var(--ink3);font-style:italic;max-width:160px">${escHtml(noteVal)}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
    });

    html += `<div class="g-year-totals"><span>Assessments: <strong>${allRowsInYear.length}</strong></span></div>`;
    html += `</div>`;
  });

  container.innerHTML = html;
}

// ── Degree tabs (grades panel, 2+ enrollments only) ───────────
function renderDegreeTabs(enrollments, grades, courses) {
  const wrap = document.getElementById('gradeDegreeTabs');
  const bar  = document.getElementById('degreeTabsBar');
  if (!wrap || !bar) return;
  if (!enrollments || enrollments.length < 2) {
    wrap.style.display = 'none';
    window._activeEnrollmentIndex = 0;
    return;
  }
  wrap.style.display = '';
  bar.innerHTML = enrollments.map((e, i) => {
    const label  = e.programName || e.degreeProgramId || 'Degree Program';
    const lvl    = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD / Doctoral' }[e.degreeLevel] || 'Bachelor';
    const active = i === (window._activeEnrollmentIndex || 0);
    return `<button class="degree-tab${active ? ' active' : ''}" onclick="switchDegreeTab(${i})" style="cursor:pointer;padding:8px 16px;font-size:12px;font-weight:${active ? '700' : '500'};border:none;border-bottom:2px solid ${active ? 'var(--crimson,#8B1A2E)' : 'transparent'};background:none;color:${active ? 'var(--crimson,#8B1A2E)' : 'var(--ink3,#666)'};white-space:nowrap">
      ${lvl} — ${label}
    </button>`;
  }).join('');
}

function switchDegreeTab(idx) {
  window._activeEnrollmentIndex = idx;
  const enrollments = window._enrollments || [];
  renderDegreeTabs(enrollments, window._allGrades || [], window._allCourses || {});
  const e = enrollments[idx];
  const filtered = e
    ? (window._allGrades || []).filter(g => !g.enrollmentId || g.enrollmentId === e.id)
    : (window._allGrades || []);
  renderGrades(filtered, window._currentStudent || {});
  renderCourseSession(window._currentStudent || {}, filtered, window._academicYears || []);
  renderMarkbook(window._currentStudent || {}, window._markbook || [], filtered);
}

