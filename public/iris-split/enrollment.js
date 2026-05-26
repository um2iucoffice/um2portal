// ── Enrollment Eligibility ────────────────────────────────────────────────────
async function checkEnrollmentEligibility(student) {
  console.log('[ENROLL] called', student?.id, student?.program, student?.currentStatus);
  if (!student.id || !student.currentStatus) { console.warn('[ENROLL] missing id or currentStatus'); return; }
  const programRef = student.programId || student.program;
  if (!programRef) { console.warn('[ENROLL] missing program'); return; }
  try {
    console.log('[ENROLL] fetching for', student.id, programRef, student.currentStatus);
    const res = await fetch('/.netlify/functions/get-enrollment-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:   student.id,
        program_id:   programRef,
        current_year: student.currentStatus
      })
    });
    const data = await res.json();
    console.log('[ENROLL] response:', JSON.stringify(data));
   if (!data.period) {
  console.log('[ENROLL] no active period — banner hidden');
  // No active period = enrollment is closed. Show nothing.
  ['enrollmentBanner','enrollmentBannerGrades'].forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    el.style.display = 'none';
  });
  return;
}
    renderEnrollmentBanner(data.period, data.eligibility, student);
    console.log('[ENROLL] banner rendered');
  } catch(e) {
    console.warn('[ENROLL] failed:', e.message);
  }
}

// ── Enrollment banner SVG icons ───────────────────────────────────────────────
var _enrollIcons = {
  promoted: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5"/></svg>',
  approved: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  rejected: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  requested:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  eligible: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4l3 3"/></svg>',
  ineligible:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

function _enrollIconWrap(key, color) {
  return '<div style="width:36px;height:36px;border-radius:8px;background:' + color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
       + '<span style="display:flex;align-items:center;color:#fff;">' + _enrollIcons[key] + '</span>'
       + '</div>';
}

function renderEnrollmentBanner(period, elig, student) {
  ['enrollmentBanner', 'enrollmentBannerGrades'].forEach(function(id) {
    var container = document.getElementById(id);
    if (!container) return;

    var closeDate = new Date(period.close_at)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Use CSS variables throughout — no JS theme detection needed.
    // This ensures text is always legible regardless of theme or toggle timing.
    var strongStyle = 'font-weight:600;color:var(--ink);';

    function wrap(bgColor, borderColor, iconKey, iconBg, titleText, subHtml, titleCol, subCol) {
      var tc = titleCol || 'var(--ink)';
      var sc = subCol   || 'var(--ink2)';
      return '<div style="background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;margin-bottom:18px;">'
           + _enrollIconWrap(iconKey, iconBg)
           + '<div style="flex:1;min-width:0;">'
           + '  <div style="font-weight:700;font-size:14px;margin-bottom:3px;color:' + tc + ';">' + titleText + '</div>'
           + '  <div style="font-size:12px;line-height:1.6;color:' + sc + ';">' + subHtml + '</div>'
           + '</div>'
           + '</div>';
    }

    var html = '';

    if (elig.already_requested) {
      var enrollmentStatus = elig.enrollment_status || 'requested';
      var toYear           = elig.to_year || 'next year';
      var toYearStrong     = '<strong style="' + strongStyle + '">' + toYear + '</strong>';

      if (enrollmentStatus === 'promoted') {
        html = wrap(
          'var(--green-light)', 'rgba(26,92,58,0.25)',
          'promoted', '#1A5C3A',
          'Year Progression Complete',
          'You have been promoted to ' + toYearStrong + '. Your academic record has been updated.',
          '#1A3D2B', '#2D5A3D'
        );
      } else if (enrollmentStatus === 'approved') {
        html = wrap(
          'var(--green-light)', 'rgba(26,92,58,0.2)',
          'approved', '#1A7A48',
          'Enrollment Approved',
          'Your progression to ' + toYearStrong + ' has been approved and will be processed shortly.',
          '#1A3D2B', '#2D5A3D'
        );
      } else if (enrollmentStatus === 'rejected') {
        html = wrap(
          'var(--crimson-light)', 'rgba(139,26,46,0.22)',
          'rejected', 'var(--crimson)',
          'Enrollment Request Rejected',
          'Your request was not approved. Please contact the Registrar for more information.',
          '#5C0A18', '#8B1A2E'
        );
      } else {
        // Pending/submitted — use a solid blue-tinted card that works in both themes
        html = wrap(
          'rgba(59,130,246,0.10)', 'rgba(59,130,246,0.28)',
          'requested', '#2563EB',
          'Enrollment Request Submitted',
          'Your request to advance to the next year of study has been submitted and is under review. Closes ' + closeDate + '.',
          'var(--ink)', 'var(--ink2)'
        );
      }

    } else if (elig.eligible) {
      var enrollBtnStyle = [
        'flex-shrink:0',
        'background:var(--green)',
        'border:none',
        'color:#fff',
        'font-size:13px',
        'font-weight:600',
        'padding:9px 20px',
        'border-radius:8px',
        'cursor:pointer',
        'font-family:\'DM Sans\',sans-serif',
        'letter-spacing:.2px',
        'transition:opacity .15s'
      ].join(';');

      html = '<div style="background:var(--green-light);border:1px solid rgba(26,92,58,0.22);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;margin-bottom:18px;">'
           + _enrollIconWrap('eligible', 'var(--green)')
           + '<div style="flex:1;min-width:0;">'
           + '  <div style="font-weight:700;font-size:14px;margin-bottom:3px;color:#1A3D2B;">Year Progression Available</div>'
           + '  <div style="font-size:12px;line-height:1.6;color:#2D5A3D;">You are eligible to enroll for the next year of study. Enrollment closes ' + closeDate + '.</div>'
           + '</div>'
           + '<button id="enrollBtn" onclick="submitEnrollmentRequest(\'' + period.id + '\',\'' + student.id + '\')" style="' + enrollBtnStyle + '">'
           + '  Enroll Now'
           + '</button>'
           + '</div>';

    } else {
      var reasonsList = (elig.reasons || []).map(function(r) {
        return '<li style="margin-bottom:3px;color:#7A6320;">' + r + '</li>';
      }).join('');

      html = '<div style="background:var(--gold-light);border:1px solid rgba(154,123,47,0.25);border-radius:12px;padding:16px 20px;margin-bottom:18px;">'
           + '<div style="display:flex;align-items:center;gap:14px;">'
           + _enrollIconWrap('ineligible', 'var(--gold)')
           + '<div style="flex:1;min-width:0;">'
           + '  <div style="font-weight:700;font-size:14px;margin-bottom:3px;color:#5C4A10;">Not Yet Eligible for Year Progression</div>'
           + '  <div style="font-size:12px;line-height:1.6;color:#7A6320;">Enrollment closes ' + closeDate + '. Please resolve the following before the deadline:</div>'
           + '</div>'
           + '</div>'
           + (reasonsList ? '<ul style="margin:10px 0 0 50px;padding:0;font-size:12px;list-style:disc;color:#7A6320;">' + reasonsList + '</ul>' : '')
           + '</div>';
    }

    container.innerHTML = html;
    container.style.display = 'block';
  });
}

window.submitEnrollmentRequest = async function(periodId, studentId) {
  const btn = document.getElementById('enrollBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting…';
  }
  try {
    const res = await fetch('/.netlify/functions/create-enrollment-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, period_id: periodId })
    });
    const data = await res.json();
    if (data.success) {
      // Re-render both banners as pending
      ['enrollmentBanner', 'enrollmentBannerGrades'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        var _isDark2 = !document.body.classList.contains('theme-light');
        var _tc2 = _isDark2 ? 'rgba(255,255,255,0.92)' : '#0D1B2A';
        var _sc2 = _isDark2 ? 'rgba(255,255,255,0.58)' : '#3D4A5C';
        container.innerHTML = '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.22);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;margin-bottom:18px;">'
          + _enrollIconWrap('requested', '#2563EB')
          + '<div style="flex:1;min-width:0;">'
          + '  <div style="font-weight:700;font-size:14px;margin-bottom:3px;color:' + _tc2 + ';">Enrollment Request Submitted</div>'
          + '  <div style="font-size:12px;line-height:1.6;color:' + _sc2 + ';">Your request to advance to the next year of study has been submitted and is under review.</div>'
          + '</div>'
          + '</div>';
        container.style.display = 'block';
      });
    } else {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enroll Now';
      }
      // Show error inside the banner rather than a silent console warn
      ['enrollmentBanner', 'enrollmentBannerGrades'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        const msg = data.message || 'Submission failed. Please try again.';
        // Append an error note below the existing banner content
        const errEl = container.querySelector('.enroll-error-msg');
        if (errEl) { errEl.textContent = msg; return; }
        const div = document.createElement('div');
        div.className = 'enroll-error-msg';
        div.style.cssText = 'margin-top:8px;font-size:12px;color:rgba(255,160,120,0.9);padding:0 4px;';
        div.textContent = '⚠ ' + msg;
        container.firstElementChild && container.firstElementChild.appendChild(div);
      });
      console.warn('Enrollment submission failed:', data);
    }
  } catch(e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Enroll Now';
    }
    console.warn('Enrollment submission error:', e.message);
  }
};
// ── End Enrollment Eligibility ────────────────────────────────────────────────
