// ── Our Chronicles in Spring — render functions ──────────────
function renderNews(announcements) {
  var container = document.getElementById('newsContent');
  if (!container) return;
  var items = (announcements || []);
  if (!items.length) {
    container.innerHTML = '<div style="padding:48px 0;text-align:center;color:var(--ink3);font-size:14px">No chronicles yet. Be the first to share a story!</div>';
    return;
  }

  var sorted = items.slice().sort(function(a, b) {
    var da = a.type === 'event' ? (a.event_date || a.published_at || '') : (a.published_at || '');
    var db = b.type === 'event' ? (b.event_date || b.published_at || '') : (b.published_at || '');
    return db.localeCompare(da);
  });

  function openNewsDetail(a) {
    var badgeTxt = a.type === 'announcement' ? 'Notice' : a.type === 'event' ? 'Event' : 'News';
    var dateStr  = a.type === 'event' && a.event_date ? escHtml(a.event_date) : escHtml((a.published_at || '').slice(0,10));
    var meta     = a.type === 'event'
      ? dateStr + (a.event_time ? ' · ' + escHtml(a.event_time) : '') + (a.event_location ? ' · ' + escHtml(a.event_location) : '')
      : dateStr;
    var typeBadgeColor = a.type === 'event'
      ? 'background:#EDE9FE;color:#5B21B6;border:1px solid #C4B5FD'
      : a.type === 'announcement'
        ? 'background:#F3E8F9;color:#7B2D8B;border:1px solid rgba(123,45,139,0.2)'
        : 'background:#D8F3DC;color:#2D6A4F;border:1px solid rgba(45,106,79,0.2)';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + escHtml(a.title) + ' — Our Chronicles</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">'
      + '<style>'
      + '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:\'DM Sans\',sans-serif;background:#0a0f1a;color:rgba(255,255,255,0.85);min-height:100vh;-webkit-font-smoothing:antialiased}'
      + '.art-header{background:rgba(8,12,22,0.98);border-bottom:1px solid rgba(255,255,255,0.06);padding:16px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10;backdrop-filter:blur(12px)}'
      + '.art-back{background:none;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:7px 14px;color:rgba(255,255,255,0.55);font-size:13px;cursor:pointer;font-family:\'DM Sans\',sans-serif;display:flex;align-items:center;gap:6px;transition:all .15s}'
      + '.art-back:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.9)}'
      + '.art-brand{font-size:12px;color:rgba(45,106,79,0.7);margin-left:auto;font-weight:600;letter-spacing:.5px}'
      + '.art-wrap{max-width:740px;margin:0 auto;padding:52px 28px 96px}'
      + '.art-badge{display:inline-block;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:18px}'
      + '.art-title{font-family:\'Libre Baskerville\',serif;font-size:34px;color:#fff;line-height:1.25;letter-spacing:-.4px;margin-bottom:16px}'
      + '.art-meta{font-size:13px;color:rgba(255,255,255,0.35);margin-bottom:36px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
      + '.art-divider{width:48px;height:3px;background:linear-gradient(90deg,#2D6A4F,#52B788);border-radius:2px;margin-bottom:36px}'
      + '.art-img{width:100%;max-height:440px;object-fit:cover;border-radius:14px;margin-bottom:36px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 32px rgba(0,0,0,0.4)}'
      + '.art-body{font-size:16px;line-height:1.85;color:rgba(255,255,255,0.72);text-align:justify;text-align-last:left;hyphens:auto;word-break:break-word}'
      + '.art-footer{margin-top:56px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.2);text-align:center}'
      + '</style></head><body>'
      + '<div class="art-header">'
      + '  <button class="art-back" onclick="window.close()">&#8592; Back</button>'
      + '  <span class="art-brand">Our Chronicles in Spring</span>'
      + '</div>'
      + '<div class="art-wrap">'
      + '  <div class="art-badge" style="' + typeBadgeColor + '">' + badgeTxt + '</div>'
      + '  <h1 class="art-title">' + escHtml(a.title) + '</h1>'
      + '  <div class="art-meta">' + meta + (a.author_name ? '<span>·</span><span>By ' + escHtml(a.author_name) + '</span>' : '') + '</div>'
      + '  <div class="art-divider"></div>'
      + (a.image_url ? '  <img class="art-img" src="' + escHtml(a.image_url) + '" alt="" draggable="false" oncontextmenu="return false" style="pointer-events:none;user-select:none;-webkit-user-select:none">' : '')
      + '  <div class="art-body">' + escHtml(a.body || '').replace(/\n/g, '<br>') + '</div>'
      + '  <div class="art-footer">Our Chronicles in Spring · UM2IUC · IRIS</div>'
      + '</div></body></html>';
    var w = window.open('', '_blank', 'width=820,height=720');
    if (w) { w.document.write(html); w.document.close(); }
  }

  window._newsItems = sorted;

  // Helper: parse date string to get month/day
  function parseDateParts(dateStr) {
    if (!dateStr) return { month: '', day: '' };
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return { month: '', day: dateStr };
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { month: months[d.getMonth()], day: String(d.getDate()) };
  }

  // Featured card (first non-event item, or first item)
  function featuredCard(a, idx) {
    var dateStr = a.type === 'event' && a.event_date ? escHtml(a.event_date) : escHtml((a.published_at || '').slice(0,10));
    var typeTxt = a.type === 'announcement' ? 'Notice' : a.type === 'event' ? 'Event' : 'News';
    var typeIcon = a.type === 'event'
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(29,53,87,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
      : a.type === 'announcement'
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(123,45,139,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(45,106,79,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>';
    return '<div class="chr-featured" data-newsidx="' + idx + '" onclick="window._newsItems&&window.openNewsDetail(window._newsItems[this.dataset.newsidx])">'
      + (a.image_url
          ? '<img class="chr-featured-img" src="' + escHtml(a.image_url) + '" alt="" draggable="false" oncontextmenu="return false">'
          : '<div class="chr-featured-noimgbg">' + typeIcon + '</div>')
      + '<div class="chr-featured-body">'
      + '  <div class="chr-featured-meta">'
      + '    <span class="chr-badge ' + escHtml(a.type || 'news') + '">' + typeTxt + '</span>'
      + '    <span style="font-size:12px;color:var(--ink3)">' + dateStr + '</span>'
      + '    <span style="margin-left:auto;font-size:12px;color:var(--chr-spring);font-weight:600">Read story →</span>'
      + '  </div>'
      + '  <div class="chr-featured-title">' + escHtml(a.title) + '</div>'
      + (a.body ? '  <div class="chr-featured-excerpt">' + escHtml(a.body) + '</div>' : '')
      + '  <div class="chr-featured-footer">'
      + '    <span class="chr-featured-author">' + (a.author_name ? 'By ' + escHtml(a.author_name) : 'University Community') + '</span>'
      + '    <span class="chr-featured-cta">Our Chronicles</span>'
      + '  </div>'
      + '</div>'
      + '</div>';
  }

  // Grid card (smaller)
  function gridCard(a, idx) {
    var dateStr = a.type === 'event' && a.event_date ? escHtml(a.event_date) : escHtml((a.published_at || '').slice(0,10));
    var typeTxt = a.type === 'announcement' ? 'Notice' : a.type === 'event' ? 'Event' : 'News';
    var typeIcon = a.type === 'event'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(29,53,87,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
      : a.type === 'announcement'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(123,45,139,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(45,106,79,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>';
    return '<div class="chr-card" data-newsidx="' + idx + '" onclick="window._newsItems&&window.openNewsDetail(window._newsItems[this.dataset.newsidx])">'
      + (a.image_url
          ? '<img class="chr-card-img" src="' + escHtml(a.image_url) + '" alt="" draggable="false" oncontextmenu="return false">'
          : '<div class="chr-card-noimgbg">' + typeIcon + '</div>')
      + '<div class="chr-card-body">'
      + '  <div class="chr-card-meta">'
      + '    <span class="chr-badge ' + escHtml(a.type || 'news') + '">' + typeTxt + '</span>'
      + '    <span style="font-size:11px;color:var(--ink3)">' + dateStr + '</span>'
      + '  </div>'
      + '  <div class="chr-card-title">' + escHtml(a.title) + '</div>'
      + (a.author_name ? '<div class="chr-card-author">By ' + escHtml(a.author_name) + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  // Event card (special style with date block)
  function eventCard(a, idx) {
    var dp = parseDateParts(a.event_date || a.published_at || '');
    var timeMeta = (a.event_time ? a.event_time : '');
    var locMeta  = (a.event_location ? a.event_location : '');
    return '<div class="chr-event-card" data-newsidx="' + idx + '" onclick="window._newsItems&&window.openNewsDetail(window._newsItems[this.dataset.newsidx])">'
      + '<div class="chr-event-date-block">'
      + '  <div class="chr-event-month">' + escHtml(dp.month) + '</div>'
      + '  <div class="chr-event-day">'   + escHtml(dp.day)   + '</div>'
      + '</div>'
      + '<div class="chr-event-body">'
      + '  <div class="chr-event-title">' + escHtml(a.title) + '</div>'
      + '  <div class="chr-event-meta">'
      + (timeMeta ? '<span class="chr-event-meta-item"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> ' + escHtml(timeMeta) + '</span>' : '')
      + (locMeta  ? '<span class="chr-event-meta-item"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + escHtml(locMeta)  + '</span>' : '')
      + (a.author_name ? '<span class="chr-event-meta-item"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> ' + escHtml(a.author_name) + '</span>' : '')
      + '  </div>'
      + (a.body ? '<div style="font-size:12px;color:var(--ink3);margin-top:6px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + escHtml(a.body) + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  var events  = sorted.filter(function(a) { return a.type === 'event'; });
  var stories = sorted.filter(function(a) { return a.type !== 'event'; });
  var html = '';

  // Events section
  if (events.length) {
    html += '<div class="chr-group-label events">Upcoming Events</div>';
    events.forEach(function(a) { html += eventCard(a, sorted.indexOf(a)); });
  }

  // Stories & notices section
  if (stories.length) {
    html += '<div class="chr-group-label news">Stories &amp; Notices</div>';
    if (stories.length >= 1) {
      html += featuredCard(stories[0], sorted.indexOf(stories[0]));
    }
    if (stories.length > 1) {
      html += '<div class="chr-grid">';
      for (var i = 1; i < stories.length; i++) {
        html += gridCard(stories[i], sorted.indexOf(stories[i]));
      }
      html += '</div>';
    }
  }

  container.innerHTML = html;
  window.openNewsDetail = openNewsDetail;
}

// ── Student overview strip (above apps dashboard) ───────────────────────────
function renderStudentOverview(student, grades, courses) {
  const gpaEl      = document.getElementById('ovGpa');
  const creditsEl  = document.getElementById('ovCredits');
  const coursesEl  = document.getElementById('ovCourses');
  const statusEl   = document.getElementById('ovStatus');
  const yearEl     = document.getElementById('ovYear');

  // GPA
  const gpa = getSheetOverallGpa(student);
  if (gpaEl) gpaEl.textContent = (gpa && gpa !== '—') ? gpa : '—';

  // Credits + courses from grades — exclude F-grade (failed) courses
  if (grades && grades.length && courses) {
    let totalCredits = 0; let creditsKnown = true;
    const passedGrades = grades.filter(g => String(g.grade || '').trim().toUpperCase() !== 'F');
    passedGrades.forEach(g => {
      const c = courses[g.courseId];
      if (c && c.credits != null) totalCredits += Number(c.credits);
      else creditsKnown = false;
    });
    if (creditsEl) creditsEl.textContent = creditsKnown ? totalCredits : (totalCredits > 0 ? totalCredits + '+' : '—');
    if (coursesEl) coursesEl.textContent = passedGrades.length;
  }

  // Status
  const status = (student && (student.currentStatus || student.enrollmentStatus || student.year || '')) || '—';
  if (statusEl) statusEl.textContent = status;

  // Academic year
  const yr = (student && (student.admissionYear || student.academic_year || '')) || '—';
  if (yearEl) yearEl.textContent = yr !== '—' ? yr : (student && student.id ? yr : '—');
}


function renderHomeNews(announcements) {
  var container    = document.getElementById('homeNewsCards');
  var mobContainer = document.getElementById('mobHomeNewsCards');
  if (!container && !mobContainer) return;
  var items = (announcements || []);

  var emptyMsg = '<div style="background:var(--glass-card-bg);border:1px solid var(--glass-card-border);border-radius:10px;padding:28px;text-align:center;color:var(--ink3);font-size:13px">No chronicles yet.</div>';
  if (!items.length) {
    if (container)    container.innerHTML    = emptyMsg;
    if (mobContainer) mobContainer.innerHTML = emptyMsg;
    return;
  }

  var sorted = items.slice().sort(function(a, b) {
    var da = a.type === 'event' ? (a.event_date || a.published_at || '') : (a.published_at || '');
    var db = b.type === 'event' ? (b.event_date || b.published_at || '') : (b.published_at || '');
    return db.localeCompare(da);
  });

  function homeCard(a, idx) {
    var dateStr = a.type === 'event' && a.event_date ? escHtml(a.event_date) : escHtml((a.published_at || '').slice(0,10));
    var typeTxt = a.type === 'announcement' ? 'Notice' : a.type === 'event' ? 'Event' : 'News';
    var typeIcon = a.type === 'event'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(29,53,87,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
      : a.type === 'announcement'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(123,45,139,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(45,106,79,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>';
    return '<div class="chr-home-card" data-newsidx="' + idx + '" onclick="window._newsItems&&window.openNewsDetail&&window.openNewsDetail(window._newsItems[this.dataset.newsidx])">'
      + (a.image_url
          ? '<img class="chr-home-card-img" src="' + escHtml(a.image_url) + '" alt="" draggable="false" oncontextmenu="return false">'
          : '<div class="chr-home-card-noimgbg">' + typeIcon + '</div>')
      + '<div class="chr-home-card-body">'
      + '  <div class="chr-home-card-meta">'
      + '    <span class="chr-badge ' + escHtml(a.type || 'news') + '">' + typeTxt + '</span>'
      + '    <span style="font-size:11px;color:var(--ink3)">' + dateStr + '</span>'
      + '  </div>'
      + '  <div class="chr-home-card-title">' + escHtml(a.title) + '</div>'
      + (a.author_name ? '<div class="chr-home-card-author">By ' + escHtml(a.author_name) + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  var preview = sorted.slice(0, 3);
  if (container)    container.innerHTML    = preview.map(function(a, i) { return homeCard(a, sorted.indexOf(a)); }).join('');
  if (mobContainer) mobContainer.innerHTML = preview.map(function(a, i) { return homeCard(a, sorted.indexOf(a)); }).join('');
}

var _postType = 'news'; // default post type

window.setPostType = function(type) {
  _postType = type;
  ['news','announcement','notice','event','newsitem'].forEach(function(t) {
    var btn = document.getElementById('postType' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === type);
  });
  var ef = document.getElementById('eventFieldsWrap');
  if (ef) ef.style.display = type === 'event' ? 'flex' : 'none';
};

window.submitPost = async function() {
  var title = (document.getElementById('postTitle').value || '').trim();
  var body  = (document.getElementById('postBody').value  || '').trim();
  var msg   = document.getElementById('submitPostMsg');
  var btn   = document.getElementById('submitPostBtn');
  if (!title || !body) { msg.textContent = 'Please fill in a title and body.'; return; }
  btn.disabled = true;
  msg.style.color = 'var(--ink3)';

  // ── Step 1: upload image if selected ──────────────────────────
  var image_url = null;
  var fileInput = document.getElementById('postImageFile');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    msg.textContent = 'Uploading image…';
    var formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
      var upRes  = await fetch('/.netlify/functions/upload-image', { method: 'POST', body: formData });
      var upData = await upRes.json();
      if (upData.url) {
        image_url = upData.url;
      } else {
        msg.textContent = upData.error || 'Image upload failed.';
        msg.style.color = 'var(--crimson)';
        btn.disabled = false;
        return;
      }
    } catch(e) {
      msg.textContent = 'Image upload error. Please try again.';
      msg.style.color = 'var(--crimson)';
      btn.disabled = false;
      return;
    }
  }

  // ── Step 2: submit the post ────────────────────────────────────
  msg.textContent = 'Submitting…';
  var payload = {
    student_id:     window._currentStudentId || '',
    title: title, body: body, type: _postType, 
    image_url:      image_url,
    author_name:    (document.getElementById('postAuthorName').value || '').trim() || null, 
    event_date:     (document.getElementById('postEventDate')     || {}).value || null,
    event_time:     (document.getElementById('postEventTime')     || {}).value || null,
    event_location: (document.getElementById('postEventLocation') || {}).value || null,
  };
  try {
    var res  = await fetch('/.netlify/functions/submit-post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data.success) {
      msg.textContent = 'Submitted! Your post will appear once approved by admin.';
      msg.style.color = 'var(--green)';
      document.getElementById('postTitle').value = '';
      document.getElementById('postBody').value  = '';
      fileInput.value = '';
      document.getElementById('postImageLabel').textContent = 'Upload photo (optional)';
      var prev = document.getElementById('postImagePreview');
      if (prev) { prev.src = ''; prev.style.display = 'none'; }
    } else {
      msg.textContent = data.error || 'Something went wrong.';
      msg.style.color = 'var(--crimson)';
    }
  } catch(e) {
    msg.textContent = 'Connection error. Please try again.';
    msg.style.color = 'var(--crimson)';
  }
  btn.disabled = false;
};

// ══════════════════════════════════════════════════════════════
//  LECTURE & DISCUSSION TIMETABLE
// ══════════════════════════════════════════════════════════════

var _ttLoaded   = false;
var _ttAllRows  = [];   // raw timetable rows from server
var _ttActiveDay = 'All';

// Only fetch once per session
function loadTimetableIfNeeded() {
  if (_ttLoaded) return;
  _ttLoaded = true;
  _loadTimetable();
}

async function _loadTimetable() {
  var loadEl   = document.getElementById('ttLoading');
  var errEl    = document.getElementById('ttError');
  var contentEl= document.getElementById('ttContent');
  var emptyEl  = document.getElementById('ttEmpty');
  var filterBar= document.getElementById('ttFilterBar');

  if (!loadEl) return;
  loadEl.style.display   = 'flex';
  errEl.style.display    = 'none';
  contentEl.style.display= 'none';
  emptyEl.style.display  = 'none';
  if (filterBar) filterBar.style.display = 'none';

  try {
    var s   = window._currentStudent || {};
    var res = await fetch('/.netlify/functions/get-timetable', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ studentId: s.id || '' })
    });
    var data = await res.json();
    loadEl.style.display = 'none';

    if (!data.success) throw new Error(data.message || 'Failed to load timetable.');

    var rows = data.timetable || [];
    _ttAllRows = rows;

    if (rows.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    if (filterBar) filterBar.style.display = 'flex';
    renderTimetable(rows, _ttActiveDay);
    contentEl.style.display = 'block';

  } catch(e) {
    loadEl.style.display = 'none';
    errEl.style.display  = 'block';
    errEl.textContent    = 'Unable to load timetable: ' + e.message;
    _ttLoaded = false; // allow retry
  }
}

var TT_DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function ttDurationLabel(start, end) {
  // start / end like "08:00:00"
  try {
    var s = start.split(':'); var e = end.split(':');
    var diff = (parseInt(e[0]) * 60 + parseInt(e[1])) - (parseInt(s[0]) * 60 + parseInt(s[1]));
    if (diff <= 0) return '';
    var h = Math.floor(diff / 60); var m = diff % 60;
    return (h ? h + 'h' : '') + (m ? (h ? ' ' : '') + m + 'm' : '');
  } catch(e) { return ''; }
}

function ttFmt(t) {
  // "08:00:00" → "08:00"
  if (!t) return '—';
  var parts = t.split(':');
  return parts[0] + ':' + parts[1];
}


(function() {
 
  var _docsLoaded = false;
 
  // Call this when Document Office panel becomes visible
  window.loadOfficeDocsIfNeeded = function() {
    if (_docsLoaded) return;
    _docsLoaded = true;
    _loadOfficeDocs();
  };
 
  async function _loadOfficeDocs() {
    var section  = document.getElementById('officeDocsSection');
    var loading  = document.getElementById('officeDocsLoading');
    var errorEl  = document.getElementById('officeDocsError');
    var grid     = document.getElementById('officeDocsGrid');
    if (!section) return;
 
    section.style.display = 'block';
    loading.style.display = 'flex';
    errorEl.style.display = 'none';
    grid.innerHTML = '';
 
    try {
      var res = await fetch('/.netlify/functions/get-documents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ student_id: window._currentStudentId || '' })
});
      var data = await res.json();
 
      loading.style.display = 'none';
 
      if (!data.success) {
        errorEl.textContent = data.error || 'Failed to load documents.';
        errorEl.style.display = 'block';
        return;
      }
 
      var docs = data.documents || [];
      if (docs.length === 0) {
        grid.innerHTML = '<p style="font-size:13px;color:var(--ink3);padding:8px 0">No documents published yet.</p>';
        return;
      }
 
      grid.innerHTML = docs.map(function(doc) {
        var icon = _iconForType(doc.file_type);
        var cat  = doc.category
          ? '<span class="odoc-category">' + _esc(doc.category) + '</span>'
          : '';
        var ft   = doc.file_type
          ? '<span class="odoc-filetype">' + _esc(doc.file_type.toUpperCase()) + '</span>'
          : '';
        return [
          '<div class="odoc-card">',
            '<div class="odoc-icon">' + icon + '</div>',
            '<div class="odoc-title">' + _esc(doc.title) + '</div>',
            doc.description
              ? '<div class="odoc-desc">' + _esc(doc.description) + '</div>'
              : '<div class="odoc-desc"></div>',
            '<div class="odoc-meta">' + cat + ft + '</div>',
            '<a class="odoc-btn" href="' + _esc(doc.file_url) + '" target="_blank" rel="noopener">',
              '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
              'Download',
            '</a>',
          '</div>',
        ].join('');
      }).join('');
 
    } catch (err) {
      loading.style.display = 'none';
      errorEl.textContent = 'Connection error. Please try again.';
      errorEl.style.display = 'block';
    }
  }
 
  function _iconForType(type) {
    var t = (type || '').toLowerCase();
    if (t === 'pdf') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
    }
    if (t === 'docx' || t === 'doc') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    }
    // default
    return '<svg viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
  }
 
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
 
})();
