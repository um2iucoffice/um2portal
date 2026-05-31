// ══════════════════════════════════════
// Student Table, Profile, Add, Edit, Delete, Bulk Import
// ══════════════════════════════════════

// ══════════════════════════════════════════
// STUDENT TABLE & PROFILE
// ══════════════════════════════════════════
function renderStudentTable(data) {
  const tb = document.getElementById('studentTableBody');
  tb.innerHTML = '';
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--ink3)">No students found. Add students via the sidebar or Bulk Import.</td></tr>`;
    return;
  }

  // ── Group by Program → Academic Year (3-level accordion) ──
  // Build: { program -> { year -> [students] } }
  const byProgram = {};
  data.forEach(s => {
    const prog = s.program || 'Unknown Program';
    const yr   = s.year   || 'Unknown Year';
    if (!byProgram[prog]) byProgram[prog] = {};
    if (!byProgram[prog][yr]) byProgram[prog][yr] = [];
    byProgram[prog][yr].push(s);
  });

  const colSpan = currentRole === 'registrar' ? 13 : 12;

  let html = '';
  Object.entries(byProgram).forEach(([prog, years], pi) => {
    const progTotal = Object.values(years).reduce((n, arr) => n + arr.length, 0);
    const progKey = `prog-${pi}`;
    // Program-level row
    html += `<tr class="stu-prog-header" data-prog-key="${progKey}" data-action="toggle-prog" style="cursor:pointer;background:rgba(139,26,46,0.07);border-top:2px solid rgba(139,26,46,0.15)">
      <td style="width:36px;padding:8px" data-stop-prop="1">
        <input type="checkbox" class="stu-group-cb" data-group="${progKey}" data-group="${progKey}" data-cb-type="group" title="Select all in ${prog}">
      </td>
      <td colspan="${colSpan - 1}" style="padding:10px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          <svg class="prog-chevron-${progKey}" style="width:14px;height:14px;stroke:var(--crimson);stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s;flex-shrink:0" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          <div>
            <span style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--crimson)">${prog}</span>
            <span style="font-size:11px;color:var(--ink3);margin-left:8px">${progTotal} student${progTotal!==1?'s':''} · ${Object.keys(years).length} year${Object.keys(years).length!==1?'s':''}</span>
          </div>
        </div>
      </td>
    </tr>`;

    // Year-level rows (inside each program)
    Object.entries(years).forEach(([yr, studs], yi) => {
      const yearKey = `year-${pi}-${yi}`;
      html += `<tr class="stu-year-header stu-prog-body-${progKey}" data-year-key="${yearKey}" data-action="toggle-year" style="cursor:pointer;background:rgba(30,58,110,0.04);display:table-row">
        <td style="width:36px;padding:7px 8px 7px 24px" data-stop-prop="1">
          <input type="checkbox" class="stu-group-cb" data-group="${yearKey}" data-cb-type="group" title="Select all in ${yr}">
        </td>
        <td colspan="${colSpan - 1}" style="padding:8px 14px 8px 10px">
          <div style="display:flex;align-items:center;gap:8px">
            <svg class="year-chevron-${yearKey}" style="width:12px;height:12px;stroke:var(--blue);stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s;flex-shrink:0" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            <span style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--blue)">${yr}</span>
            <span style="font-size:11px;color:var(--ink3)">${studs.length} student${studs.length!==1?'s':''}</span>
          </div>
        </td>
      </tr>`;

      // Student rows (inside each year)
      studs.forEach(s => {
        const gpa = Number(s.gpa) || 0;
        const gpaColor = gpa >= 3.5 ? 'text-green' : gpa >= 2.0 ? 'text-gold' : 'text-crimson';
        const statusBadge = s.status === 'Active' ? 'b-green' : s.status === 'Degree Awarded' ? 'b-blue' : 'b-red';
        const isGraduated = s.grad_status === 'Graduated';
        const pwDisplay = currentRole === 'registrar'
          ? `<td style="white-space:nowrap" data-stop-prop="1">
               <span class="pw-masked" style="font-family:monospace;color:var(--ink3);letter-spacing:.15em">••••••••</span>
               <span class="pw-plain" style="display:none;font-family:monospace;font-size:11px;color:var(--ink)">${s.master_password ? '(password set — not displayable)' : '—'}</span>
               <button class="pw-eye" style="margin-left:6px;display:inline-flex;vertical-align:middle" data-action="toggle-pw" title="Show / Hide">
                 <svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-eye"></use></svg>
               </button>
             </td>`
          : '';
        const levelBadgeMap = {
          bachelor: '<span class="badge b-blue">Bach</span>',
          master:   '<span class="badge b-mast" style="background:var(--mast-light);color:var(--mast)">Master</span>',
          phd:      '<span class="badge b-phd"  style="background:var(--phd-light);color:var(--phd)">PhD</span>',
        };
        const levelBadge = levelBadgeMap[s.degree_level || 'bachelor'] || levelBadgeMap.bachelor;
        const genderIcon = s.gender === 'male' ? '♂' : s.gender === 'female' ? '♀' : '—';
        const genderStyle = s.gender === 'male' ? 'color:var(--blue);font-weight:600' : s.gender === 'female' ? 'color:var(--crimson);font-weight:600' : 'color:var(--ink3)';
        html += `<tr id="stu-row-${s.id}" class="stu-prog-body-${progKey} stu-year-body-${yearKey}" data-action="view" data-id="${s.id}" style="cursor:pointer;display:none">
          <td style="width:36px;padding:9px 8px 9px 32px" data-stop-prop="1">
            <input type="checkbox" class="stu-cb" data-id="${s.id}" data-cb-type="student">
          </td>
          <td class="text-mono text-crimson">${s.id}${isGraduated ? ' <span style="font-size:9px;font-weight:700;background:var(--green-light);color:var(--green);border-radius:3px;padding:1px 5px;vertical-align:middle">ALUMNI</span>' : ''}</td>
          <td><strong>${s.name_en}</strong>${s.name_my ? `<br><span class="text-muted my-text">${s.name_my}</span>` : ''}</td>
          <td>${s.father || '—'}</td>
          <td>${s.email}</td>
          <td><span class="badge b-muted" style="font-size:10px">${s.program || '—'}</span></td>
          <td>${levelBadge}</td>
          <td><span class="badge b-blue">${s.year || '—'}</span></td>
          <td style="${genderStyle}">${genderIcon} ${s.gender ? s.gender.charAt(0).toUpperCase()+s.gender.slice(1) : '—'}</td>
          <td><strong class="${gpaColor}">${gpa.toFixed(1)}</strong></td>
          <td><span class="badge ${statusBadge}">${s.status}</span></td>
          ${pwDisplay}
          <td class="flex gap-2" data-stop-prop="1">
            <button class="btn btn-outline btn-sm" data-action="view" data-id="${s.id}">View</button>
            ${currentRole === 'registrar' ? `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${s.id}">Edit</button>` : ''}
            ${currentRole === 'registrar' ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}" data-name="${s.name_en.replace(/'/g, '\\'')}"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>` : ''}
          </td>
        </tr>`;
      });
    });
  });

  tb.innerHTML = html;
  // Also render mobile card list
  renderStudentCardList(data);
}

// ── Mobile card list renderer (shown ≤700px) ──
function renderStudentCardList(data) {
  const container = document.getElementById('studentCardList');
  if (!container) return;
  if (!data.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--ink3)">No students found.</div>`;
    return;
  }

  // Group by Program → Year (same as table)
  const byProgram = {};
  data.forEach(s => {
    const prog = s.program || 'Unknown Program';
    const yr   = s.year   || 'Unknown Year';
    if (!byProgram[prog]) byProgram[prog] = {};
    if (!byProgram[prog][yr]) byProgram[prog][yr] = [];
    byProgram[prog][yr].push(s);
  });

  let html = '';
  Object.entries(byProgram).forEach(([prog, years], pi) => {
    const progTotal = Object.values(years).reduce((n, arr) => n + arr.length, 0);
    const progId = `scp-${pi}`;
    html += `
      <div class="scard-prog-header open" id="${progId}-hdr" data-action="toggle-scard-prog" data-prog-id="${progId}">
        <svg class="scard-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <span class="scard-prog-label">${prog}</span>
        <span class="scard-prog-count">${progTotal} student${progTotal!==1?'s':''}</span>
      </div>
      <div id="${progId}-body" style="display:block;padding-left:0">`;

    Object.entries(years).forEach(([yr, studs], yi) => {
      const yearId = `scy-${pi}-${yi}`;
      html += `
        <div class="scard-year-header open" id="${yearId}-hdr" data-action="toggle-scard-year" data-year-id="${yearId}">
          <svg class="scard-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="scard-year-label">${yr}</span>
          <span class="scard-year-count">${studs.length} student${studs.length!==1?'s':''}</span>
        </div>
        <div id="${yearId}-body" style="display:block;padding-left:8px">`;

      studs.forEach(s => {
        const gpa = Number(s.gpa) || 0;
        const gpaColor = gpa >= 3.5 ? 'var(--green)' : gpa >= 2.0 ? 'var(--gold)' : 'var(--crimson)';
        const statusBadge = s.status === 'Active' ? 'b-green' : s.status === 'Degree Awarded' ? 'b-blue' : 'b-red';
        const initials = (s.name_en || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const photoUrl = s.photo ? `${SUPABASE_URL}/storage/v1/object/public/student-photos/${s.photo}` : '';
        const avatarInner = photoUrl
          ? `<img src="${photoUrl}" data-onerror-initials="${initials}">`
          : initials;
        html += `
          <div class="scard" data-action="view" data-id="${s.id}">
            <div class="scard-avatar">${avatarInner}</div>
            <div class="scard-body">
              <div class="scard-name">${s.name_en}</div>
              <div class="scard-id">${s.id}</div>
              <div class="scard-meta">
                <span class="badge ${statusBadge}" style="font-size:10px">${s.status}</span>
                ${s.program ? `<span class="badge b-muted" style="font-size:10px">${s.program}</span>` : ''}
              </div>
            </div>
            <div class="scard-right">
              <div class="scard-gpa" style="color:${gpaColor}">${gpa.toFixed(1)}</div>
              <div class="scard-gpa-den">/ 4.00</div>
            </div>
          </div>`;
      });
      html += `</div>`; // year body
    });
    html += `</div>`; // prog body
  });

  container.innerHTML = html;
}

function toggleScardProg(id) {
  const body = document.getElementById(id + '-body');
  const hdr  = document.getElementById(id + '-hdr');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (hdr) hdr.classList.toggle('open', !open);
}
function toggleScardYear(id) {
  const body = document.getElementById(id + '-body');
  const hdr  = document.getElementById(id + '-hdr');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (hdr) hdr.classList.toggle('open', !open);
}

// Toggle Program accordion
function toggleStudentProgram(progKey) {
  const rows = document.querySelectorAll(`.stu-prog-body-${progKey}`);
  const chevron = document.querySelector(`.prog-chevron-${progKey}`);
  const isOpen = rows.length && rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : 'table-row');
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  // Close year sub-rows when closing program
  if (isOpen) {
    rows.forEach(r => {
      const yk = r.dataset && r.dataset.yearKey;
      if (yk) {
        document.querySelectorAll(`.stu-year-body-${yk}`).forEach(sr => sr.style.display = 'none');
        const yc = document.querySelector(`.year-chevron-${yk}`);
        if (yc) yc.style.transform = '';
      }
    });
  }
}

// Toggle Year accordion (inside Program)
function toggleStudentYear(yearKey) {
  const rows = document.querySelectorAll(`.stu-year-body-${yearKey}`);
  const chevron = document.querySelector(`.year-chevron-${yearKey}`);
  const isOpen = rows.length && rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : 'table-row');
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function showProfile(sid) {
  currentProfileId = sid;
  const s = students.find(x => x.id === sid);
  if (!s) return;
  const gpa = Number(s.gpa) || 0;
  const avatarEl = document.getElementById('profAvatar');
  if (s.photo) {
    const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/student-photos/${s.photo}`;
    avatarEl.innerHTML = `<img src="${photoUrl}" alt="${s.name_en}" draggable="false" oncontextmenu="return false" style="pointer-events:none;user-select:none;-webkit-user-select:none" data-onerror-initial="${s.name_en.charAt(0)}">`;
  } else {
    avatarEl.textContent = s.name_en.charAt(0);
  }
  document.getElementById('profName').innerHTML = `${s.name_en}${s.name_my ? ` <span class="my-text" lang="my" style="color:var(--ink3);font-size:15px;font-weight:400">· ${s.name_my}</span>` : ''}`;
  document.getElementById('profId').textContent     = s.id;
  document.getElementById('profEmail').textContent   = s.email;
  document.getElementById('profBirth').textContent   = s.dob || '—';
  document.getElementById('profYear').textContent    = s.year || '—';
  document.getElementById('profAdmission').textContent = s.admission || '—';
  document.getElementById('profGpa').textContent     = gpa.toFixed(2);
  document.getElementById('profGpaBar').style.width  = (gpa / 4.0 * 100) + '%';

  // Alumni / Student ID label
  const isGraduated = s.grad_status === 'Graduated';
  const profIdLabel = document.getElementById('profIdLabel');
  if (profIdLabel) profIdLabel.style.display = isGraduated ? '' : 'none';

  // Graduation date in banner
  const gradDateMeta = document.getElementById('profGradDateMeta');
  const gradDateEl   = document.getElementById('profGradDate');
  if (gradDateMeta) gradDateMeta.style.display = isGraduated && s.graduation_date ? '' : 'none';
  if (gradDateEl)   gradDateEl.textContent = s.graduation_date || '—';

  // Personal tab
  ['name','nameMM','father','fatherMM','mother','motherMM','dob','email','phone','admission','address'].forEach(f => {
    const el = document.getElementById('pi-' + f);
    const map = { name:s.name_en, nameMM:s.name_my||'', father:s.father||'', fatherMM:s.father_my||'', mother:s.mother||'', motherMM:s.mother_my||'', dob:s.dob||'', email:s.email, phone:s.phone||'', admission:s.admission||'', address:s.address||'' };
    if (el) el.value = map[f] || '';
  });
  // Graduation fields in personal tab
  const piGradIdGroup   = document.getElementById('pi-gradIdGroup');
  const piGradIdMyGroup = document.getElementById('pi-gradIdMyGroup');
  const piGradDateGroup = document.getElementById('pi-gradDateGroup');
  const piGradDateMyGroup = document.getElementById('pi-gradDateMyGroup');
  const piGradId        = document.getElementById('pi-gradId');
  const piGradIdMy      = document.getElementById('pi-gradIdMy');
  const piGradDate      = document.getElementById('pi-gradDate');
  const piGradDateMy    = document.getElementById('pi-gradDateMy');
  if (isGraduated) {
    if (piGradIdGroup)     piGradIdGroup.style.display     = '';
    if (piGradIdMyGroup)   piGradIdMyGroup.style.display   = '';
    if (piGradDateGroup)   piGradDateGroup.style.display   = '';
    if (piGradDateMyGroup) piGradDateMyGroup.style.display = '';
    if (piGradId)          piGradId.value    = s.graduation_id    || '—';
    if (piGradIdMy)        piGradIdMy.value  = s.graduation_id_my || '—';
    if (piGradDate)        piGradDate.value  = s.graduation_date  || '';
    if (piGradDateMy)      piGradDateMy.value = s.graduation_date_my || (s.graduation_date ? toBurmeseDate(s.graduation_date) : '—');
  } else {
    if (piGradIdGroup)     piGradIdGroup.style.display     = 'none';
    if (piGradIdMyGroup)   piGradIdMyGroup.style.display   = 'none';
    if (piGradDateGroup)   piGradDateGroup.style.display   = 'none';
    if (piGradDateMyGroup) piGradDateMyGroup.style.display = 'none';
  }

  // ── Supervisor / Thesis — show for Master / PhD students ─────
  const degLevel        = s.degree_level || 'bachelor';
  const showSupField    = degLevel === 'master' || degLevel === 'phd';
  const supervisorVal   = s.supervisor   || '';
  const thesisVal       = s.thesis_title || '';

  // Banner meta
  const profSupMeta = document.getElementById('profSupervisorMeta');
  const profSupEl   = document.getElementById('profSupervisor');
  if (profSupMeta) profSupMeta.style.display = (showSupField && supervisorVal) ? '' : 'none';
  if (profSupEl)   profSupEl.textContent = supervisorVal;

  // Personal tab fields
  const piSupGroup  = document.getElementById('pi-supervisorGroup');
  const piSupEl     = document.getElementById('pi-supervisor');
  const piThesGroup = document.getElementById('pi-thesisGroup');
  const piThesEl    = document.getElementById('pi-thesis');
  if (piSupGroup)  piSupGroup.style.display  = showSupField ? '' : 'none';
  if (piSupEl)     piSupEl.value             = supervisorVal || '—';
  if (piThesGroup) piThesGroup.style.display = showSupField ? '' : 'none';
  if (piThesEl)    piThesEl.value            = thesisVal    || '—';

  // Grades tab
  const gb = document.getElementById('gradeTableBody');
  gb.innerHTML = '';
  const grades = gradeData[sid] || [];
  if (!grades.length) {
    gb.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--ink3);padding:24px">No grades recorded yet.</td></tr>';
  } else {
    grades.forEach(g => {
      const gpColor = Number(g.gp) >= 3.5 ? 'text-green' : Number(g.gp) >= 2.0 ? 'text-gold' : 'text-crimson';
      const updatedAt = g.updated_at ? g.updated_at.slice(0,10) : g.created_at ? g.created_at.slice(0,10) : '—';
      const displayScore = g.score ?? g.NumericScore ?? g.numericscore ?? '—';
      const displayCourseId = g.course_id || g.CourseID || g.courseid || '';
      gb.innerHTML += `<tr>
        <td class="text-mono text-crimson">${(g.id || '').toUpperCase()}</td>
        <td><strong>${g.course || '—'}</strong><br><span class="text-muted">${displayCourseId}</span></td>
        <td>${displayScore}</td>
        <td><span class="badge ${gradeBadgeClass(g.letter)}">${formatGradeLetter(g.letter)}</span></td>
        <td><strong class="${gpColor}">${Number(g.gp).toFixed(1)}</strong></td>
        <td><span class="badge b-blue">${g.attempt || '1st Attempt'}</span></td>
        <td>${g.year || '—'}</td>
        <td class="text-mono">${updatedAt}</td>
        <td>${g.uploaded_by || '—'}</td>
        <td class="flex gap-2">
          ${currentRole === 'registrar' ? `<button class="btn btn-outline btn-sm" data-action="edit-grade" data-sid="${sid}" data-gid="${g.id}"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-edit"></use></svg></button>` : ''}
          ${currentRole === 'registrar' ? `<button class="btn btn-danger btn-sm" data-action="delete-grade" data-sid="${sid}" data-gid="${g.id}" data-course="${(g.course||'').replace(/'/g,\"'\")}"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>` : ''}
        </td>
      </tr>`;
    });
  }

  // Enrollment tab
  const eb = document.getElementById('enrollHistoryBody');
  eb.innerHTML = '';
  const enrolRows = enrollHistory[sid] || [];
  if (!enrolRows.length) {
    eb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink3);padding:24px">No enrollment history.</td></tr>`;
  } else {
    enrolRows.forEach(e => {
      const sb = e.status === 'Active' ? 'b-green' : e.status === 'Degree Awarded' ? 'b-blue' : 'b-red';
      const gb = e.grad === 'Graduated' ? 'b-green' : 'b-muted';
      eb.innerHTML += `<tr><td><span class="badge b-blue">${e.program || '—'}</span></td><td>${e.year}</td><td><span class="badge ${sb}">${e.status}</span></td><td>${e.gpa}</td><td><span class="badge ${gb}">${e.grad}</span></td><td class="text-muted">${e.notes}</td></tr>`;
    });
  }

  // Attendance tab
  const ab = document.getElementById('profAttendanceBody');
  ab.innerHTML = '';
  const stdAtt = attendanceRecords.filter(r => r.student_id.toLowerCase() === sid.toLowerCase());
  stdAtt.sort((a,b) => (`${b.session_date} ${b.session_from}`).localeCompare(`${a.session_date} ${a.session_from}`));
  if (!stdAtt.length) {
    ab.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink3);padding:24px">No attendance records for this student.</td></tr>';
  } else {
    stdAtt.forEach(r => {
      ab.innerHTML += `<tr>
        <td><strong>${r.lecture_name}</strong></td>
        <td class="text-mono">${r.session_date}</td>
        <td class="text-mono"><span style="font-size:11px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:2px 8px;white-space:nowrap">From: ${r.session_from} &nbsp;/&nbsp; Till: ${r.session_till || '—'}</span></td>
        <td><span class="badge ${attendanceBadgeClass(r.status)}">${r.status}</span></td>
        <td class="text-muted">${r.remarks || '—'}</td>
      </tr>`;
    });
  }
  const pres = stdAtt.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const rate = stdAtt.length ? Math.round(pres / stdAtt.length * 100) : 0;
  const statsEl = document.getElementById('profAttStats');
  if (statsEl) statsEl.textContent = stdAtt.length ? `${stdAtt.length} sessions · ${rate}% attendance` : '';

  showView('profile');
  // Documents tab
  const idCardLabel      = document.getElementById('docIdCardLabel');
  const gradCertItem     = document.getElementById('docGradCertItem');
  const gradCertDesc     = document.getElementById('docGradCertDesc');
  if (idCardLabel)    idCardLabel.textContent  = isGraduated ? 'Alumni ID Card' : 'Student ID Card';
  if (gradCertItem)   gradCertItem.style.display = isGraduated ? '' : 'none';
  if (gradCertDesc && isGraduated) gradCertDesc.textContent =
    `Graduation ID: ${s.graduation_id || '—'} · Date: ${s.graduation_date || '—'}` +
    (s.graduation_id_my ? ` · Myanmar ID: ${s.graduation_id_my}` : '') +
    (s.graduation_date_my || s.graduation_date ? ` · Myanmar Date: ${s.graduation_date_my || toBurmeseDate(s.graduation_date)}` : '');

  setTimeout(() => {
    const bar = document.getElementById('profGpaBar');
    if (bar) { const w = bar.style.width; bar.style.width = '0'; setTimeout(() => bar.style.width = w, 100); }
  }, 100);
}

function sendManualEmail() {
  const s = students.find(x => x.id === currentProfileId);
  if (s) toast(`Email notification queued for ${s.email}`, 'Notice');
}

// ══════════════════════════════════════════
// STUDENT: ADD (single)
// ══════════════════════════════════════════
async function saveNewStudent() {
  const sid   = document.getElementById('ns-id').value.trim();
  const name  = document.getElementById('ns-name').value.trim();
  const email = document.getElementById('ns-email').value.trim();
  if (!sid || !name || !email) { toast('Student ID, Full Name and Email are required.', 'Notice'); return; }
  if (students.find(s => s.id === sid)) { toast('Student ID already exists!', '❌'); return; }

  const newStudent = {
    id: sid, name_en: name,
    name_my:   document.getElementById('ns-nameMM').value.trim(),
    father:    document.getElementById('ns-father').value.trim(),
    father_my: document.getElementById('ns-fatherMM').value.trim(),
    mother:    document.getElementById('ns-mother').value.trim(),
    mother_my: document.getElementById('ns-motherMM').value.trim(),
    dob:       getDateValue('ns-dob') || null,
    email,
    phone:     document.getElementById('ns-phone').value.trim(),
    address:   document.getElementById('ns-address').value.trim(),
    admission: document.getElementById('ns-admission').value.trim(),
    year:      document.getElementById('ns-year').value,
    program:   document.getElementById('ns-program').value,
    degree_level: document.getElementById('ns-level')?.value || 'bachelor',
    status:    document.getElementById('ns-enroll').value,
    gender:    document.getElementById('ns-gender')?.value || null,
    grad_status:     document.getElementById('ns-grad').value,
    graduation_id:   document.getElementById('ns-gradId').value.trim() || null,
    graduation_id_my: document.getElementById('ns-gradIdMy').value.trim() || null,
    graduation_date: getDateValue('ns-gradDate') || null,
    graduation_date_my: document.getElementById('ns-gradDateMy').value.trim() || null,
    gpa: 0.0
  };

  // Resolve plaintext FIRST — before any hashing — needed for welcome email
  const _plainPw  = document.getElementById('ns-masterPw').value.trim() || generateMasterPassword();
  const _nameVal  = document.getElementById('ns-name').value.trim();
  const _dobVal   = document.getElementById('ns-dob') ? getDateValue('ns-dob') : null;
  document.getElementById('ns-masterPw').value = _plainPw;
  alert(' Save this password for the student:\n\n' + _plainPw + '\n\nIt cannot be recovered after saving.');
  newStudent.master_password = await hashPassword(_plainPw);

  const { error } = await db.from('students').insert(newStudent);
  if (error) { toast('Save failed: ' + error.message, 'DB Error'); return; }

  // Auto-create a degree_enrollments row for this student
  const degreeLevel = newStudent.degree_level || 'bachelor';
  await db.from('degree_enrollments').insert({
    student_id:        sid,
    degree_program_id: newStudent.program,
    degree_level:      degreeLevel,
    current_year:      newStudent.year,
    enrollment_status: newStudent.status,
    gpa:               newStudent.gpa,
    graduation_status: newStudent.grad_status,
    graduation_id:     newStudent.graduation_id,
    graduation_date:   newStudent.graduation_date,
    thesis_title:      document.getElementById('ns-thesis')?.value.trim() || null,
    supervisor:        document.getElementById('ns-supervisor')?.value.trim() || null,
  }).then(({ error: e2 }) => { if (e2) console.warn('degree_enrollments insert failed:', e2.message); });

  students.push(newStudent);
  renderStudentTable(students);
  updateDashboardStats();
  const _logId = await logEmail(email, sid, '[UM2 Registry System] Welcome — Your student account is ready', 'New student');
  await sendWelcomeEmail(email, sid, _nameVal, _plainPw, _dobVal, 'new student', _logId);
  toast(`Student ${sid} added. Welcome email sent to ${email}.`, 'Notice');
  clearNewStudentForm();
}

function clearNewStudentForm() {
  ['ns-id','ns-admission','ns-name','ns-nameMM','ns-father','ns-fatherMM','ns-mother','ns-motherMM','ns-dob','ns-email','ns-phone','ns-address','ns-gradId','ns-gradIdMy','ns-gradDate','ns-gradDateMy','ns-masterPw'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const pwEl = document.getElementById('ns-masterPw'); if (pwEl) pwEl.type = 'password';
  const g = document.getElementById('ns-grad'); if (g) g.value = 'In Progress';
  toggleNewStudentGradFields();
}

// ══════════════════════════════════════════
// STUDENT: EDIT
// ══════════════════════════════════════════
function openEditModal(sid) {
  const s = students.find(x => x.id === sid);
  if (!s) return;
  document.getElementById('editModalId').textContent = sid;
  document.getElementById('em-name').value     = s.name_en;
  document.getElementById('em-nameMM').value   = s.name_my || '';
  document.getElementById('em-father').value   = s.father || '';
  document.getElementById('em-fatherMM').value = s.father_my || '';
  document.getElementById('em-mother').value   = s.mother || '';
  document.getElementById('em-motherMM').value = s.mother_my || '';
  document.getElementById('em-email').value    = s.email;
  document.getElementById('em-phone').value    = s.phone || '';
  setDateValue('em-dob', s.dob || '');
  document.getElementById('em-admission').value= s.admission || '';
  document.getElementById('em-status').value   = s.status;
  const emGender = document.getElementById('em-gender');
  if (emGender) emGender.value = s.gender || '';
  // Populate em-year filtered to this student's program, then restore value
  updateYearsForProgram('em-year', s.program || 'MBBS');
  document.getElementById('em-year').value     = s.year;
  document.getElementById('em-address').value  = s.address || '';
  document.getElementById('em-grad').value     = s.grad_status || 'In Progress';
  document.getElementById('em-gradId').value   = s.graduation_id || '';
  document.getElementById('em-gradIdMy').value = s.graduation_id_my || '';
  setDateValue('em-gradDate', s.graduation_date || '');
  document.getElementById('em-gradDateMy').value = s.graduation_date_my || (s.graduation_date ? toBurmeseDate(s.graduation_date) : '');
  // Master password: show placeholder hint if one exists, blank if none
  const pwEl = document.getElementById('em-masterPw');
  if (pwEl) {
    pwEl.value = '';
    pwEl.type  = 'password';
    pwEl.placeholder = 'Enter new password to set or change';
    const eyeBtn = pwEl.parentElement.querySelector('.pw-eye');
    if (eyeBtn) eyeBtn.innerHTML = '<svg><use href="#i-eye"></use></svg>';
  }
  toggleGradFields();
  document.getElementById('editModal').classList.add('open');
}

async function saveEdit() {
  const sid = document.getElementById('editModalId').textContent;
  const updates = {
    name_en:   document.getElementById('em-name').value,
    name_my:   document.getElementById('em-nameMM').value,
    father:    document.getElementById('em-father').value,
    father_my: document.getElementById('em-fatherMM').value,
    mother:    document.getElementById('em-mother').value,
    mother_my: document.getElementById('em-motherMM').value,
    email:     document.getElementById('em-email').value,
    phone:     document.getElementById('em-phone').value,
    dob:       getDateValue('em-dob') || null,
    admission: document.getElementById('em-admission').value,
    status:    document.getElementById('em-status').value,
    gender:    document.getElementById('em-gender')?.value || null,
    year:      document.getElementById('em-year').value,
    address:   document.getElementById('em-address').value,
    grad_status:     document.getElementById('em-grad').value,
    graduation_id:   document.getElementById('em-gradId').value.trim() || null,
    graduation_id_my: document.getElementById('em-gradIdMy').value.trim() || null,
    graduation_date: getDateValue('em-gradDate') || null,
    graduation_date_my: document.getElementById('em-gradDateMy').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  // Only update master_password if a new value was typed
  const newPw = (document.getElementById('em-masterPw').value || '').trim();
  if (newPw) {
  alert('Save this new password for the student:\n\n' + newPw + '\n\nIt cannot be recovered after saving.');
  updates.master_password = await hashPassword(newPw);
}

  const { error } = await db.from('students').update(updates).eq('id', sid);
  if (error) { toast('Update failed: ' + error.message, 'DB Error'); return; }

  const s = students.find(x => x.id === sid);
  if (s) Object.assign(s, updates);
  renderStudentTable(students);
  if (currentProfileId === sid) showProfile(sid);
  closeModal('editModal');
  await logEmail(updates.email, sid, '[UM2] Your profile has been updated', 'Profile edit');
  toast('Student record updated. Email notification queued.', 'Notice');
}

// ══════════════════════════════════════════
// STUDENT: DELETE
// ══════════════════════════════════════════
function confirmDeleteStudent(sid, name) {
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Student';
  document.getElementById('confirmDeleteMsg').innerHTML =
    `Are you sure you want to permanently delete student <strong>${name}</strong>?<br>
    <span class="text-mono text-crimson">${sid}</span><br><br>
    All grade and attendance records for this student will also be removed. This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('students').delete().eq('id', sid);
    if (error) { toast('Delete failed: ' + error.message, 'DB Error'); return; }
    students = students.filter(x => x.id !== sid);
    delete gradeData[sid];
    delete enrollHistory[sid];
    attendanceRecords = attendanceRecords.filter(r => r.student_id !== sid);
    renderStudentTable(students);
    updateDashboardStats();
    toast(`Student ${sid} deleted.`, 'Notice');
    closeModal('confirmDeleteModal');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

// ══════════════════════════════════════════
// STUDENT: BULK IMPORT
// ══════════════════════════════════════════
function handleBulkStudentCSV(input) {
  const file = input.files ? input.files[0] : (input[0] || null);
  if (!file) return;
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: (results) => {
      bulkStudentRows = results.data;
      let errors = 0;
      document.getElementById('studentPreviewCount').textContent = bulkStudentRows.length;
      const pt = document.getElementById('studentPreviewTable');
      pt.innerHTML = `<thead><tr><th>Student ID</th><th>Full Name (EN)</th><th>Email</th><th>Gender</th><th>Program</th><th>Year</th><th>Status</th><th>Master Password</th><th>Action</th><th>Validation</th></tr></thead>`;
      let body = '<tbody>';
      bulkStudentRows.forEach(row => {
        const sid = (row.student_id || '').trim();
        const existing = students.find(x => x.id === sid);
        const hasRequired = sid && row.full_name_en && row.email;
        if (!hasRequired) errors++;
        const progId = (row.program_id || '').trim();
        const validProgram = !progId || degreePrograms.some(p => p.id === progId);
        const action = existing ? 'UPDATE' : 'INSERT (new)';
        const actionBadge = existing ? 'b-blue' : 'b-green';
        const pwVal = (row.master_password || '').trim();
        const pwDisplay = pwVal ? `<span style="font-family:monospace;font-size:11px">••••••</span>` : `<span class="badge b-gold">Auto-gen</span>`;
        const statusVal = row.enrollment_status || row.status || (existing ? existing.status : 'Active');
        const progBadge = progId
          ? (validProgram ? `<span class="badge b-blue">${progId}</span>` : `<span class="badge b-red">${progId} ✗</span>`)
          : `<span class="badge b-muted">${existing ? existing.program : 'MBBS'} (default)</span>`;
        const issues = [];
        if (!hasRequired) issues.push('Missing required field');
        if (progId && !validProgram) issues.push('Unknown program');
        const genderVal = (row.gender || '').trim();
        const genderDisplay = genderVal === 'Male' ? '<span class="badge b-blue">Male</span>'
          : genderVal === 'Female' ? '<span class="badge b-gold">Female</span>'
          : genderVal ? `<span class="badge b-red">${genderVal} ✗</span>`
          : '<span style="color:var(--ink3);font-size:11px">—</span>';
        body += `<tr class="${issues.length ? 'bulk-row-err' : ''}">
          <td class="text-mono">${sid}</td>
          <td>${row.full_name_en || '<span class="text-crimson">Missing</span>'}</td>
          <td>${row.email || '<span class="text-crimson">Missing</span>'}</td>
          <td>${genderDisplay}</td>
          <td>${progBadge}</td>
          <td>${row.current_year || ''}</td>
          <td>${statusVal}</td>
          <td>${pwDisplay}</td>
          <td><span class="badge ${actionBadge}">${action}</span></td>
          <td>${issues.length ? `<span class="badge b-red">✗ ${issues.join(', ')}</span>` : '<span class="badge b-green">✓ OK</span>'}</td>
        </tr>`;
      });
      pt.innerHTML += body + '</tbody>';
      document.getElementById('studentPreviewErrors').textContent = errors + ' errors';
      document.getElementById('studentPreviewArea').style.display = 'block';
    }
  });
}

async function submitBulkStudents() {
  document.getElementById('studentPreviewArea').style.display = 'none';
  const rc = document.getElementById('studentResultCard');
  const rt = document.getElementById('studentResultTable');
  let inserted = 0, updated = 0, errs = 0;
  rt.innerHTML = `<thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Action</th><th>Welcome Email</th></tr></thead>`;
  let body = '<tbody>';

  // ── Date normaliser: accepts DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD or null ──
  function parseDate(val) {
    if (!val || !val.trim()) return null;
    const v = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    return null;
  }

  // ── Date normaliser: accepts DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD or null ──
  function parseDate(val) {
    if (!val || !val.trim()) return null;
    const v = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    return null;
  }

  // ── Step 1: validate rows and build records locally ──────────────────────
  const validRecords   = [];  // { record, existing, row } — will be batch-upserted
  const invalidRows    = [];  // rows missing required fields

  for (const row of bulkStudentRows) {
    const sid = (row.student_id || '').trim();
    if (!sid || !row.full_name_en || !row.email) {
      invalidRows.push(row);
      errs++;
      body += `<tr class="bulk-row-err"><td class="text-mono">${sid||'?'}</td><td>${row.full_name_en||'—'}</td><td>${row.email||'—'}</td><td colspan="2"><span class="badge b-red">✗ Skipped — missing required field</span></td></tr>`;
      continue;
    }
    const existing = students.find(x => x.id === sid);
    const resolvedStatus = (row.enrollment_status || row.status || (existing ? existing.status : '') || 'Active').trim();
    const resolvedGpa    = existing ? (existing.gpa ?? 0.0) : 0.0;
    const newPw          = (row.master_password || '').trim();
    const resolvedPw     = newPw || generateMasterPassword();
    const resolvedPwHash = await hashPassword(resolvedPw);

    const record = {
      id:         sid,
      name_en:   row.full_name_en,
      name_my:   row.full_name_my   || (existing ? existing.name_my   : ''),
      gender:    row.gender         || (existing ? existing.gender     : '') || '',
      father:    row.father_name_en || (existing ? existing.father     : ''),
      father_my: row.father_name_my || (existing ? existing.father_my  : ''),
      mother:    row.mother_name_en || (existing ? existing.mother     : ''),
      mother_my: row.mother_name_my || (existing ? existing.mother_my  : ''),
      dob:       parseDate(row.birth_date) || (existing ? existing.dob : null) || null,
      email:     row.email,
      phone:     row.phone          || (existing ? existing.phone      : ''),
      address:   row.address        || (existing ? existing.address    : ''),
      admission: row.admission_year || (existing ? existing.admission  : ''),
      year:      row.current_year   || (existing ? existing.year       : 'Foundation Year'),
      program:   row.program_id     || (existing ? existing.program    : 'MBBS'),
      status:    resolvedStatus,
      gpa:       resolvedGpa,
      photo:     existing ? (existing.photo || null) : null,
      grad_status:     row.graduation_status || (existing ? existing.grad_status     : 'In Progress'),
      graduation_id:   row.graduation_id     || (existing ? existing.graduation_id   : null) || null,
      graduation_id_my: row.graduation_id_my  || (existing ? existing.graduation_id_my : null) || null,
      graduation_date: parseDate(row.graduation_date) || (existing ? existing.graduation_date : null) || null,
      graduation_date_my: row.graduation_date_my || (existing ? existing.graduation_date_my : null) || (parseDate(row.graduation_date) ? toBurmeseDate(parseDate(row.graduation_date)) : null) || null,
      master_password: resolvedPwHash,
      updated_at: new Date().toISOString()
    };
    validRecords.push({ record, existing, row, resolvedPw });
  }

  // ── Step 2: UPDATE existing students, INSERT new ones — NEVER upsert
  // Upsert does DELETE+INSERT under the hood which cascades to wipe all grades/attendance
  if (validRecords.length > 0) {
    const toUpdate = validRecords.filter(x => x.existing);
    const toInsert = validRecords.filter(x => !x.existing);

    let effectiveBatchError = null;

    // Update existing students in parallel — Promise.all fires all requests simultaneously
    // instead of awaiting each one sequentially, cutting round-trip time proportionally.
    if (toUpdate.length > 0) {
      const updateResults = await Promise.all(
        toUpdate.map(({ record }) => {
          const { id, ...fields } = record;
          return db.from('students').update(fields).eq('id', id);
        })
      );
      for (const { error } of updateResults) {
        if (error && !effectiveBatchError) effectiveBatchError = error;
      }
    }

    // Insert new students in a single batch
    if (toInsert.length > 0) {
      const { error: insErr } = await db.from('students').insert(toInsert.map(x => x.record));
      if (insErr && !effectiveBatchError) {
        // Check if failure is due to missing columns and retry without grad fields
        if (insErr.message && (insErr.message.includes('grad_status') || insErr.message.includes('graduation_id') || insErr.message.includes('graduation_date'))) {
          const safeRecords = toInsert.map(x => {
            const { grad_status, graduation_id, graduation_date, ...rest } = x.record;
            return rest;
          });
          const { error: retryErr } = await db.from('students').insert(safeRecords);
          if (retryErr) effectiveBatchError = retryErr;
          else toast('⚠️ Imported without graduation fields — run the migration SQL in Setup to enable full support.', '⚠️');
        } else {
          effectiveBatchError = insErr;
        }
      }
    }
    if (effectiveBatchError) {
      // Batch failed entirely — report every valid row as errored
      for (const { record, row } of validRecords) {
        errs++;
        body += `<tr class="bulk-row-err">
          <td class="text-mono">${record.id}</td><td>${record.name_en}</td><td>${record.email}</td>
          <td colspan="2"><span class="badge b-red" title="${effectiveBatchError.message}">✗ DB Error: ${effectiveBatchError.message}</span></td>
        </tr>`;
      }
      toast(`❌ Batch upsert failed: ${effectiveBatchError.message}`, 'DB Error');
    } else if (!effectiveBatchError) {
      // Batch succeeded — update in-memory store and build result rows
      const newlyInserted = [];
      for (const { record, existing, row, resolvedPw } of validRecords) {
        if (existing) {
          updated++;
          Object.assign(existing, record);
          body += `<tr class="bulk-row-ok">
            <td class="text-mono text-crimson">${record.id}</td><td>${record.name_en}</td><td>${record.email}</td>
            <td><span class="badge b-blue">↑ Updated</span></td><td>—</td>
          </tr>`;
        } else {
          inserted++;
          students.push(record);
          newlyInserted.push({ email: record.email, sid: record.id, nameEn: record.name_en, plainPw: resolvedPw || '', dob: record.dob || null });
          body += `<tr class="bulk-row-ok">
            <td class="text-mono text-crimson">${record.id}</td><td>${record.name_en}</td><td>${record.email}</td>
            <td><span class="badge b-green">✓ Inserted</span></td><td><span class="badge b-green">✓ Queued</span></td>
          </tr>`;
        }
      }
      // Send welcome emails staggered — one every 700ms to avoid Resend rate limits
      (async () => {
        for (let i = 0; i < newlyInserted.length; i++) {
          const { email, sid, nameEn, plainPw, dob } = newlyInserted[i];
          if (i > 0) await new Promise(r => setTimeout(r, 700));
          const _bulkLogId = await logEmail(email, sid, '[UM2 Registry System] Welcome — Your student account is ready', 'Bulk import');
          await sendWelcomeEmail(email, sid, nameEn, plainPw, dob, 'bulk import', _bulkLogId);
        }
      })();
    }
  }

  rt.innerHTML += body + '</tbody>';
  rc.style.display = 'block';
  document.getElementById('studentProgressBar').style.width = '0';
  setTimeout(() => document.getElementById('studentProgressBar').style.width = '100%', 100);
  document.getElementById('studentInsertCount').textContent = inserted + ' inserted';
  document.getElementById('studentUpdateCount').textContent = updated + ' updated';
  document.getElementById('studentErrorCount').textContent  = errs + ' errors';
  renderStudentTable(students);
  updateDashboardStats();
  toast(`✅ ${inserted} inserted, ${updated} updated, ${errs} errors.`, '👥');
}

// ══════════════════════════════════════════
// EVENT DELEGATION — replaces all inline onclick/onchange/onerror
// ══════════════════════════════════════════

// ── Click delegate ──
document.addEventListener('click', function(e) {
  // Stop propagation for marked cells
  if (e.target.closest('[data-stop-prop]')) {
    e.stopPropagation();
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  if (action === 'view')             { e.stopPropagation(); showProfile(id); }
  if (action === 'edit')             { e.stopPropagation(); openEditModal(id); }
  if (action === 'delete')           { e.stopPropagation(); confirmDeleteStudent(id, btn.dataset.name); }
  if (action === 'toggle-pw')        { e.stopPropagation(); toggleTablePwVisibility(btn); }
  if (action === 'edit-grade')       { e.stopPropagation(); openEditGradeModal(btn.dataset.sid, btn.dataset.gid); }
  if (action === 'delete-grade')     { e.stopPropagation(); confirmDeleteGrade(btn.dataset.sid, btn.dataset.gid, btn.dataset.course); }
  if (action === 'toggle-prog')      { toggleStudentProgram(btn.dataset.progKey); }
  if (action === 'toggle-year')      { toggleStudentYear(btn.dataset.yearKey); }
  if (action === 'toggle-scard-prog'){ toggleScardProg(btn.dataset.progId); }
  if (action === 'toggle-scard-year'){ toggleScardYear(btn.dataset.yearId); }
});

// ── Change delegate ──
document.addEventListener('change', function(e) {
  if (e.target.matches('.stu-group-cb')) {
    toggleSelectGroup(e.target, e.target.dataset.group);
  }
  if (e.target.matches('.stu-cb')) {
    onStudentCheckChange();
  }
});

// ── onerror delegate for avatar images (card list + profile) ──
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG') {
    const initials = e.target.dataset.onerrorInitials;
    const initial  = e.target.dataset.onerrorInitial;
    if (initials !== undefined) {
      e.target.style.display = 'none';
      e.target.parentElement.textContent = initials;
    }
    if (initial !== undefined) {
      e.target.parentElement.innerHTML = initial;
    }
  }
}, true); // useCapture=true so error events bubble up