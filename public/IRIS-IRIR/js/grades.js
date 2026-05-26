// ── Grades ───────────────────────────────────────────────────
function gc(g) {
  if (!g) return 'gX';
  const s = String(g).trim();
  if (s === 'A+') return 'gAp';
  if (s === 'A')  return 'gA';
  if (s === 'A-') return 'gAm';
  if (s === 'B+') return 'gBp';
  if (s === 'B')  return 'gB';
  return 'gX';
}

function escHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function getAcademicYear(row, course) {
  // Group by the course's academic year label (e.g. "Foundation Year", "M-1")
  // The grade row's year/created_at is only for the "Year" column (when exam was taken)
  return course.year || 'Other';
}

function getCompletionYear(row) {
  // Only accept a value that looks like a real calendar year (4-digit number)
  // Program labels like "M-2", "Foundation Year" are NOT calendar years
  function isCalendarYear(v) {
    return v && /^\d{4}$/.test(String(v).trim());
  }
  const candidates = [
    row.completionYear, row.CompletionYear, row.completion_year,
    row.year, row.Year,
    row.completionDate, row.CompletionDate
  ];
  for (const v of candidates) {
    if (isCalendarYear(v)) return String(v).trim();
  }
  // Fall back to extracting year from created_at / updated_at timestamps
  const ts = row.created_at || row.createdAt || row.updated_at || row.updatedAt || '';
  if (ts) {
    const m = String(ts).match(/^(\d{4})/);
    if (m) return m[1];
  }
  return '—';
}

function getNote(row) {
  const attempt = String(row.attempt || row.Attempt || row.attempt_no || '').trim();
  const note    = row.note || row.Note || row.notes || row.Notes ||
                  row.comment || row.Comment || row.remarks || row.Remarks || '';
  const is1st = !attempt || attempt === '1' || attempt === '1st Attempt' || attempt.toLowerCase() === '1st attempt';
  if (!is1st) {
    return note ? `${attempt} · ${note}` : attempt;
  }
  return note;
}

function getSheetOverallGpa(student) {
  // Try the passed-in student object first, then fall back to the globally stored student
  const src = student && (student.gpa || student.GPA || student['Overall GPA'] || student.OverallGPA || student.overallGPA || student.overall_gpa)
              ? student
              : (window._currentStudent || {});
  const raw = src['Overall GPA'] ?? src.OverallGPA ?? src.overallGPA ??
              src.overall_gpa ?? src.gpa ?? src.GPA ?? '';
  if (raw === null || raw === undefined || String(raw).trim() === '') return '—';
  return String(raw).trim();
}

function renderGrades(grades, student) {
  const container = document.getElementById('gradesContent');
  if (!grades || !grades.length) {
    container.innerHTML = '<div class="g-wrap"><div class="no-g">No results recorded yet.</div></div>';
    return;
  }

  // Group by academic year — F grades ARE included in academic record (shown with failed styling)
  // but excluded from credits/totals. Transcript print excludes F grades separately.
  const groups = {};
  grades.forEach(g => {
    const letterGrade = String(g.grade || '').trim().toUpperCase();
    const course = COURSES[g.courseId] || { name: g.course || g.courseId || '—', year: 'Other', block: g.block || 'General', credits: g.credits ?? null, assessment: g.assessment || '—' };
    const academicYear = getAcademicYear(g, course);
    if (!groups[academicYear]) groups[academicYear] = {};
    const block = course.block || 'General';
    if (!groups[academicYear][block]) groups[academicYear][block] = [];
    groups[academicYear][block].push(Object.assign({}, g, { course: course, academicYear: academicYear, _isFailed: letterGrade === 'F' }));
  });

  // Build year order from the active course catalogue (preserves DB insertion order),
  // falling back to PROGRAM_META.yearOrder for any years not in the catalogue.
  const catalogYearOrder = [];
  Object.values(COURSES).forEach(c => {
    if (c.year && !catalogYearOrder.includes(c.year)) catalogYearOrder.push(c.year);
  });
  const metaOrder = PROGRAM_META.yearOrder || [];
  // Merge: catalogue order first (reflects DB), then any extra from meta, then unknowns
  const mergedOrder = catalogYearOrder.concat(metaOrder.filter(function(y) { return !catalogYearOrder.includes(y); }));
  const order = mergedOrder.filter(function(y) { return groups[y]; }).concat(Object.keys(groups).filter(function(y) { return !mergedOrder.includes(y); }).sort());

  // Summary stats: GPA is not calculated here.
  // It only reflects the value supplied by the sheet/data source.
  // Exclude F-grade courses from earned course count
  let totalCourses = grades.filter(g => String(g.grade || '').trim().toUpperCase() !== 'F').length;
  const overallGpa = getSheetOverallGpa(student);

  // Calculate total credits — exclude F-grade (failed) courses
  let totalCredits = 0;
  let creditsKnown = true;
  grades.forEach(g => {
    const letterGrade = String(g.grade || '').trim().toUpperCase();
    if (letterGrade === 'F') return; // failed courses do not count toward earned credits
    const c = COURSES[g.courseId];
    if (c && c.credits != null) totalCredits += Number(c.credits);
    else creditsKnown = false;
  });

  // Update summary bar
  const summaryEl = document.getElementById('transcriptSummary');
  if (summaryEl) {
    summaryEl.style.display = 'flex';
    document.getElementById('tsCredits').textContent = creditsKnown ? totalCredits : (totalCredits > 0 ? totalCredits + '+' : 'TBD');
    document.getElementById('tsCourses').textContent = totalCourses;

    // Calculate total duration from academic_years duration_months for years in the student's record
    (function() {
      var ayData = window._academicYears || [];
      var totalMonths = 0;
      var matched = 0;
      order.forEach(function(yearLabel) {
        var ayRow = ayData.find(function(ay) { return ay.name === yearLabel; });
        if (ayRow) {
          // Support both camelCase (from login.js mapAcademicYear) and snake_case (raw)
          var dm = ayRow.durationMonths != null ? ayRow.durationMonths
                 : ayRow.duration_months != null ? ayRow.duration_months
                 : null;
          if (dm != null) {
            totalMonths += Number(dm);
            matched++;
          }
        }
      });
      var yearsEl = document.getElementById('tsYears');
      var yearsLblEl = document.getElementById('tsYearsLbl');
      if (matched > 0 && totalMonths > 0) {
        // Express as years+months e.g. "6 yrs" or "4 yrs 6 mo"
        var yrs = Math.floor(totalMonths / 12);
        var mo  = totalMonths % 12;
        var txt;
        if (yrs > 0 && mo === 0)  txt = yrs + ' yrs';
        else if (yrs > 0 && mo > 0) txt = yrs + ' yrs ' + mo + ' mo';
        else txt = totalMonths + ' mo';
        if (yearsEl) yearsEl.textContent = txt;
        if (yearsLblEl) yearsLblEl.textContent = 'Study Duration';
      } else {
        if (yearsEl) yearsEl.textContent = order.length;
        if (yearsLblEl) yearsLblEl.textContent = 'Study Duration';
      }
    })();
    const tsGpa = document.getElementById('tsGpa');
    if (tsGpa) tsGpa.textContent = overallGpa;
  }

  // Update grades banner GPA
  const gradesGpaEl = document.getElementById('gradesGpa');
  if (gradesGpaEl) gradesGpaEl.textContent = overallGpa;

  let html = '';
  order.forEach(yr => {
    const blockMap = groups[yr] || {};
    const allRowsInYear = Object.values(blockMap).flat();
    html += `<div class="g-wrap">`;
    html += `<div class="g-year-head">${escHtml(yr)} &nbsp;·&nbsp; ${escHtml(PROGRAM_META.label)}</div>`;

    // Render by block
    Object.entries(blockMap).forEach(([blockName, rows]) => {
      // Sort rows by course code ascending (CRS001 < CRS002 < TCRS001 etc.)
      rows.sort((a, b) => {
        const codeA = String(a.courseId || '').toUpperCase();
        const codeB = String(b.courseId || '').toUpperCase();
        // Extract numeric part for natural sort
        const numA = parseInt((codeA.match(/(\d+)$/) || ['0','0'])[1], 10);
        const numB = parseInt((codeB.match(/(\d+)$/) || ['0','0'])[1], 10);
        const prefA = codeA.replace(/\d+$/, '');
        const prefB = codeB.replace(/\d+$/, '');
        if (prefA !== prefB) return prefA < prefB ? -1 : 1;
        return numA - numB;
      });
      html += `<div class="g-block-head">${escHtml(blockName)}</div>`;
      html += `<table class="gt">
        <thead>
          <tr>
            <th style="width:10%">Code</th>
            <th style="width:28%">Course Title</th>
            <th style="text-align:center;width:6%">Credits</th>
            <th style="text-align:center;width:16%">Assessment Type</th>
            <th style="text-align:center;width:8%">Score</th>
            <th style="text-align:center;width:8%">Year</th>
            <th style="text-align:center;width:8%">Grade</th>
            <th style="width:16%">Note</th>
          </tr>
        </thead>
        <tbody>`;

      rows.forEach(r => {
        const scoreStr =
          r.numericScore !== undefined && r.numericScore !== '' ? r.numericScore :
          r.NumericScore !== undefined && r.NumericScore !== '' ? r.NumericScore :
          r.numeric_score !== undefined && r.numeric_score !== '' ? r.numeric_score :
          r.score !== undefined && r.score !== '' ? r.score : '—';
        const dateStr = getCompletionYear(r);
        const typeStr = r.completionType || r.CompletionType || r.course.assessment || '—';
        // Session: the academic year label for this course
        const sessionStr = r.course.year || yr;
        // No green mark in academic record table
        const gradedIcon = '';
        // Superscript + and - in grade
        const gradeDisplay = escHtml(r.grade || '—')
          .replace(/\+/g, '<sup>+</sup>')
          .replace(/-/g, '<sup>−</sup>');
        // Failed rows get a subtle red tint; no FAILED pill, credits hidden for F grades
        const failedRowStyle = r._isFailed ? 'background:rgba(139,26,46,0.04);' : '';
        const failedCreditDisplay = r._isFailed
          ? `<span style="color:var(--ink3);font-size:11px">—</span>`
          : `<span class="gt-cr">${r.course.credits != null ? r.course.credits : '—'}</span>`;
        html += `<tr style="${failedRowStyle}">
          <td style="font-size:11px;color:var(--ink3);font-family:monospace">${escHtml(r.courseId || '—')}</td>
          <td>
            <div class="gt-course gt-course-graded">${gradedIcon}${escHtml(r.course.name)}</div>
          </td>
          <td style="text-align:center">${failedCreditDisplay}</td>
          <td style="text-align:center;font-size:11px;color:var(--gt-assess-color,var(--ink3))">${escHtml(typeStr)}</td>
          <td style="text-align:center">
            <span class="sbar-num">${escHtml(scoreStr)}</span>
          </td>
          <td style="text-align:center;font-size:11px;color:var(--ink3)">${escHtml(dateStr)}</td>
          <td style="text-align:center"><span class="gbadge ${gc(r.grade)}">${gradeDisplay}</span></td>
          <td style="font-size:11px;color:var(--ink3);font-style:italic;max-width:160px">${escHtml(getNote(r))}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });

    // Year totals row — show passed and failed counts separately
    const passedInYear = allRowsInYear.filter(r => !r._isFailed).length;
    const failedInYear = allRowsInYear.filter(r => r._isFailed).length;
    const failedNote = failedInYear > 0
      ? ` &nbsp;·&nbsp; <span style="color:var(--crimson)">${failedInYear} Failed</span>`
      : '';
    html += `<div class="g-year-totals">
      <span>Passed: <strong>${passedInYear}</strong>${failedNote}</span>
    </div>`;
    html += `</div>`;
  });

  container.innerHTML = html;
}

