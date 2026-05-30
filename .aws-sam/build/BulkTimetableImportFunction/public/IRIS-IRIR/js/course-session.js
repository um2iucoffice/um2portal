// ── Course Session Grid ───────────────────────────────────────
// Shows all courses for the student's current academic year.
// Graded courses are marked as completed (green); others as pending.
function renderCourseSession(student, grades, academicYears) {
  const wrap   = document.getElementById('courseSessionWrap');
  const grid   = document.getElementById('csGrid');
  const badge  = document.getElementById('csYearBadge');
  const pLabel = document.getElementById('csProgressLabel');
  const pFill  = document.getElementById('csProgressFill');
  const tabBar = document.getElementById('csYearTabs');
  if (!wrap || !grid) return;

  const studentYear = (student && (student.currentStatus || student.year || student.academic_year || '')) || '';

  // Build a set of graded courseIds from the grades array
  // F grades are excluded — they do not count as completed
  const gradedIds = new Set();
  const gradeMap  = {};
  (grades || []).forEach(g => {
    if (g.courseId) {
      const letterGrade = String(g.grade || '').trim().toUpperCase();
      if (letterGrade !== 'F') {
        gradedIds.add(String(g.courseId).trim());
      }
      gradeMap[String(g.courseId).trim()] = g;
    }
  });

  // Build year order:
  // If academicYears were returned from backend, use ONLY those (filtered to student's programs).
  // This prevents M-1…M-5 mixing with First Year…Final Part 2.
  let uniqueYears = [];
  if (academicYears && academicYears.length > 0) {
    // Determine which program IDs this student belongs to
    const enrollmentProgramIds = new Set(
      (window._enrollments || []).map(e => e.degreeProgramId).filter(Boolean)
    );
    // Also include student.program as fallback
    if (student && student.program) enrollmentProgramIds.add(String(student.program));

    // Filter academic years to only those matching the student's programs
    const filtered = enrollmentProgramIds.size > 0
      ? academicYears.filter(ay => enrollmentProgramIds.has(String(ay.programId)))
      : academicYears;

    // Sort by sort_order and extract names
    uniqueYears = filtered
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(ay => ay.name)
      .filter(Boolean);
  }

  // Fallback: derive years from grades first (most accurate), then course catalog
  if (uniqueYears.length === 0) {
    // Prefer years that appear in the student's actual grade records
    const gradeYears = new Set();
    (grades || []).forEach(g => {
      const c = COURSES[String(g.courseId || '').trim()];
      if (c && c.year) gradeYears.add(c.year);
    });
    if (gradeYears.size > 0) {
      // Use catalogue order but only for years the student has grades in
      const seen = new Set();
      Object.values(COURSES).forEach(c => {
        if (c.year && gradeYears.has(c.year) && !seen.has(c.year)) {
          seen.add(c.year); uniqueYears.push(c.year);
        }
      });
    }
    // If still empty (no grades yet), include only the student's current year
    if (uniqueYears.length === 0 && studentYear) {
      uniqueYears = [studentYear];
    }
    // Last resort: full catalog (original behaviour)
    if (uniqueYears.length === 0) {
      const seen = new Set();
      Object.values(COURSES).forEach(c => {
        if (c.year && !seen.has(c.year)) { seen.add(c.year); uniqueYears.push(c.year); }
      });
    }
  }

  // Group courses by year
  const coursesByYear = {};
  Object.entries(COURSES).forEach(([id, c]) => {
    const yr = c.year || 'Other';
    if (!coursesByYear[yr]) coursesByYear[yr] = [];
    coursesByYear[yr].push({ id, ...c });
  });

  // Filter uniqueYears to only those that have courses in the catalog
  uniqueYears = uniqueYears.filter(yr => coursesByYear[yr] && coursesByYear[yr].length > 0);

  if (uniqueYears.length === 0) { wrap.style.display = 'none'; return; }

  // Default active year: student's current year → first year with grades → first year
  let activeYear = uniqueYears.find(y => y === studentYear)
    || uniqueYears.find(y => (coursesByYear[y] || []).some(c => gradedIds.has(c.id)))
    || uniqueYears[0];

  function renderYearGrid(yr) {
    const courses = coursesByYear[yr] || [];
    const completed = courses.filter(c => gradedIds.has(c.id)).length;
    const total     = courses.length;

    if (badge)  badge.textContent  = yr;
    if (pLabel) pLabel.textContent = `${completed} / ${total} completed`;
    if (pFill)  pFill.style.width  = total > 0 ? Math.round((completed / total) * 100) + '%' : '0%';

    grid.innerHTML = courses.map(c => {
      const isDone  = gradedIds.has(c.id);
      const gRow    = gradeMap[c.id];
      const grade   = gRow ? (gRow.grade || '') : '';
      const gradeDisplay = grade
        ? grade.replace(/\+/g, '<sup>+</sup>').replace(/-/g, '<sup>−</sup>')
        : '';
      const gradeClass = grade ? gc(grade) : 'gX';

      const statusIcon = isDone
        ? `<span class="cs-status-icon done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
        : `<span class="cs-status-icon todo"><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor" opacity=".4"/></svg></span>`;

      const gradeBadge = isDone && grade
        ? `<span class="gbadge ${gradeClass}">${gradeDisplay}</span>`
        : `<span style="font-size:9px;color:rgba(255,255,255,0.28)">${escHtml(c.credits != null ? c.credits + ' cr' : '')}</span>`;

      return `<div class="cs-card ${isDone ? 'completed' : 'pending'}">
        <div class="cs-card-top">
          ${statusIcon}
        </div>
        <div class="cs-card-body">
          <div class="cs-card-name">${escHtml(c.name)}</div>
          <div class="cs-card-meta">${escHtml(c.id)}${c.credits != null ? ' · ' + c.credits + ' cr' : ''}${c.assessment ? ' · ' + escHtml(c.assessment) : ''}</div>
        </div>
        <div class="cs-card-right">${gradeBadge}</div>
      </div>`;
    }).join('');

    // Update active tab highlight
    document.querySelectorAll('.cs-year-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.yr === yr);
    });
  }

  // Build year tabs if there are multiple years in the catalog
  if (uniqueYears.length > 1) {
    tabBar.style.display = 'flex';
    tabBar.innerHTML = uniqueYears.map(yr => {
      const courses = coursesByYear[yr] || [];
      const done = courses.filter(c => gradedIds.has(c.id)).length;
      const pip  = done > 0 ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-left:5px;vertical-align:middle"></span>` : '';
      return `<button class="cs-year-tab${yr === activeYear ? ' active' : ''}" data-yr="${escHtml(yr)}">${escHtml(yr)}${pip}</button>`;
    }).join('');
    tabBar.querySelectorAll('.cs-year-tab').forEach(btn => {
      btn.addEventListener('click', function() { window.csShowYear(this.dataset.yr); });
    });
  } else {
    tabBar.style.display = 'none';
  }

  renderYearGrid(activeYear);
  wrap.style.display = '';

  // Expose for tab switching
  window._csRenderYear = renderYearGrid;
}

window.csShowYear = function(yr) {
  if (window._csRenderYear) window._csRenderYear(yr);
  // update badge to match
  const badge = document.getElementById('csYearBadge');
  if (badge) badge.textContent = yr;
};