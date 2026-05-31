function ttFmtDate(d) {
  if (!d) return '';
  try {
    var dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  } catch(e) { return d; }
}

function renderTimetable(rows, dayFilter) {
  var contentEl = document.getElementById('ttContent');
  if (!contentEl) return;

  // ── Hide past sessions — only show today and future ──
  var todayStr = new Date().toISOString().slice(0, 10);
  rows = rows.filter(function(r) {
    if (!r.session_date) return true;
    return r.session_date >= todayStr;
  });

  // Group by day
  var grouped = {};
  TT_DAY_ORDER.forEach(function(d) { grouped[d] = []; });
  rows.forEach(function(r) {
    var d = ({'Monday':'Monday','Tuesday':'Tuesday','Wednesday':'Wednesday','Thursday':'Thursday','Friday':'Friday','Saturday':'Saturday','Sunday':'Sunday'})[r.day] || ({'mon':'Monday','tue':'Tuesday','wed':'Wednesday','thu':'Thursday','fri':'Friday','sat':'Saturday','sun':'Sunday'})[(r.day||'').toLowerCase().slice(0,3)] || 'Other';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(r);
  });

  // Sort each day's rows by time_start
  Object.keys(grouped).forEach(function(d) {
    grouped[d].sort(function(a,b) { return (a.time_start||'').localeCompare(b.time_start||''); });
  });

  // Current day-of-week name for "today" highlight
  var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var todayName = dayNames[new Date().getDay()];

  var html = '';
  TT_DAY_ORDER.forEach(function(day) {
    var dayRows = grouped[day] || [];
    if (dayRows.length === 0) return;
    if (dayFilter !== 'All' && dayFilter !== day) return;

    var isToday = (day === todayName);
    html += '<div class="tt-day-group">';
    html += '<div class="tt-day-head' + (isToday ? ' today' : '') + '">'
          + '<span class="tt-dot"></span>'
          + escHtml(day)
          + (isToday ? ' <span style="font-size:9px;opacity:.7;letter-spacing:.5px">&nbsp;TODAY</span>' : '')
          + '</div>';

    dayRows.forEach(function(r) {
      var dur = ttDurationLabel(r.time_start, r.time_end);
      var hasDate = !!r.session_date;
      var dateStr = ttFmtDate(r.session_date);
      var courseIdDisp = escHtml(r.course_id || '');
      var courseName   = escHtml((r.course_name || r.course_id || ''));
      var subtopic     = escHtml(r.sub_topic || '');
      var room         = escHtml(r.room_name || r.room_id || '—');

      html += '<div class="tt-row">'
            +   '<div class="tt-time-col">'
            +     '<div class="tt-time-start">' + ttFmt(r.time_start) + '</div>'
            +     '<div class="tt-time-end">– ' + ttFmt(r.time_end) + '</div>'
            +     (dur ? '<span class="tt-time-dur">' + escHtml(dur) + '</span>' : '')
            +   '</div>'
            +   '<div class="tt-body-col">'
            +     (courseIdDisp ? '<div class="tt-course-id">' + courseIdDisp + '</div>' : '')
            +     '<div class="tt-course-name">' + courseName + '</div>'
            +     (subtopic ? '<div class="tt-subtopic">' + subtopic + '</div>' : '')
            +     '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">'
            +       '<span class="tt-room-badge">'
            +         '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>'
            +         room
            +       '</span>'
            +       (hasDate ? '<span class="tt-date-badge">📅 ' + escHtml(dateStr) + '</span>' : '')
            +     '</div>'
            +     '<div style="margin-top:8px;padding:0 0 4px 0">'
            +       '<button class="tt-attend-btn" '
            +         'data-name="' + escHtml(r.course_name || r.course_id || r.sub_topic || 'Class') + '" '
            +         'data-date="' + escHtml(r.session_date || '') + '" '
            +         'data-from="' + escHtml(r.time_start || '') + '" '
            +         'data-till="' + escHtml(r.time_end || '') + '" '
            +         'onclick="markAttendance(this)">'
            +         '✓ Mark Attendance'
            +       '</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';
    });
    html += '</div>';
  });

  contentEl.innerHTML = html || '<div class="tt-empty">No entries for this filter.</div>';
}

window.ttFilterDay = function(day, btn) {
  _ttActiveDay = day;
  document.querySelectorAll('.tt-filter-pill').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderTimetable(_ttAllRows, day);
};

window.markAttendance = async function(btn) {
  btn.disabled = true;
  btn.textContent = 'Marking…';
  var s = window._currentStudent || {};
  try {
    var res = await fetch('https://4dgx435mmk.execute-api.ap-southeast-1.amazonaws.com/mark-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId:   s.id || '',
        lectureName: btn.dataset.name,
        sessionDate: btn.dataset.date,
        sessionFrom: btn.dataset.from,
        sessionTill: btn.dataset.till
      })
    });
    var data = await res.json();
    if (data.success) {
      btn.textContent = '✓ Attended';
      btn.style.background = 'var(--green)';
      btn.style.color = '#fff';
      btn.style.cursor = 'default';
    } else {
      btn.textContent = data.message || 'Failed';
      btn.disabled = false;
    }
  } catch(e) {
    btn.textContent = 'Error — try again';
    btn.disabled = false;
  }
};