// ══════════════════════════════════════
// Email Sending Toggle, Email Log
// ══════════════════════════════════════

// EMAIL SENDING TOGGLE
// ══════════════════════════════════════════
let emailSendingEnabled = true;

function toggleEmailSending() {
  emailSendingEnabled = !emailSendingEnabled;
  // Update sidebar indicator
  const dot   = document.getElementById('emailToggleDot');
  const label = document.getElementById('emailToggleLabel');
  const btn   = document.getElementById('emailSendingBtn');
  const btnLbl= document.getElementById('emailSendingBtnLabel');
  const banner= document.getElementById('emailSendingBanner');
  if (dot)   dot.style.background   = emailSendingEnabled ? 'var(--green)' : 'var(--crimson)';
  if (label) label.textContent      = emailSendingEnabled ? 'Emails ON' : 'Emails OFF';
  if (btn)   btn.className          = emailSendingEnabled ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm';
  if (btnLbl)btnLbl.textContent     = emailSendingEnabled ? 'Stop Email Sending' : 'Resume Email Sending';
  if (banner) banner.style.display  = emailSendingEnabled ? 'none' : 'flex';
  toast(emailSendingEnabled ? '✅ Email sending re-enabled.' : '⛔ Email sending paused. No emails will be sent.', emailSendingEnabled ? '📧' : '🔕');
}

// ══════════════════════════════════════════
// EMAIL LOG
// ══════════════════════════════════════════
async function logEmail(toEmail, sid, subject, trigger) {
  if (!emailSendingEnabled) {
    // Still log as "Blocked" but don't actually send
    const tb = document.getElementById('emailLogBody');
    if (tb) {
      const now = new Date().toISOString().replace('T',' ').substr(0,16);
      tb.insertAdjacentHTML('afterbegin', `<tr style="opacity:.6">
        <td class="text-mono">${now}</td><td>${toEmail}</td>
        <td class="text-mono text-crimson">${sid}</td>
        <td>${subject}</td><td>${trigger}</td>
        <td><span class="badge b-red">⛔ Blocked</span></td>
      </tr>`);
    }
    return null;
  }
  const { data: logRow } = await db.from('email_log').insert({
    to_email: toEmail, student_id: sid, subject, trigger, status: 'Queued'
  }).select('id').single();
  const tb = document.getElementById('emailLogBody');
  if (tb) {
    const now = new Date().toISOString().replace('T',' ').substr(0,16);
    tb.insertAdjacentHTML('afterbegin', `<tr>
      <td class="text-mono">${now}</td><td>${toEmail}</td>
      <td class="text-mono text-crimson">${sid}</td>
      <td>${subject}</td><td>${trigger}</td>
      <td><span class="badge b-green">Queued</span></td>
    </tr>`);
  }
  return logRow?.id ?? null;
}

function renderEmailLog(data) {
  const tb = document.getElementById('emailLogBody');
  if (!tb) return;
  tb.innerHTML = '';
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--ink3)">No email notifications yet.</td></tr>`;
    return;
  }
  data.forEach(e => {
    const dt = (e.sent_at||'').replace('T',' ').substr(0,16);
    tb.innerHTML += `<tr>
      <td class="text-mono">${dt}</td><td>${e.to_email||'—'}</td>
      <td class="text-mono text-crimson">${e.student_id||'—'}</td>
      <td>${e.subject||'—'}</td><td>${e.trigger||'—'}</td>
      <td><span class="badge b-green">${e.status||'Queued'}</span></td>
    </tr>`;
  });
}

function addActivity(action, sid) {
  const tb = document.getElementById('recentActivityBody');
  if (!tb) return;
  const now = new Date().toISOString().replace('T',' ').substr(0,16);
  tb.insertAdjacentHTML('afterbegin', `<tr>
    <td class="text-mono">${now}</td><td>${action}</td>
    <td class="text-mono text-crimson">${typeof sid === 'function' ? sid() : sid}</td>
    <td>${currentRole === 'registrar' ? 'Registrar' : 'Staff'} (${currentUser?.staff_id||''})</td>
    <td><span class="badge b-green">✓ Done</span></td>
  </tr>`);
}

function toggleGradFields() {
  const grad = document.getElementById('em-grad').value;
  const isGrad = grad === 'Graduated';
  document.getElementById('em-gradIdGroup').style.display     = isGrad ? '' : 'none';
  document.getElementById('em-gradIdMyGroup').style.display   = isGrad ? '' : 'none';
  document.getElementById('em-gradDateGroup').style.display   = isGrad ? '' : 'none';
  document.getElementById('em-gradDateMyGroup').style.display = isGrad ? '' : 'none';
  // Auto-set enrollment status and academic year to Degree Awarded when Graduated
  if (isGrad) {
    const emStatus = document.getElementById('em-status');
    if (emStatus) emStatus.value = 'Degree Awarded';
    const emYear = document.getElementById('em-year');
    if (emYear) {
      // Add "Completed" option if not present, then select it
      if (!Array.from(emYear.options).some(o => o.value === 'Completed')) {
        const opt = document.createElement('option');
        opt.value = 'Completed'; opt.textContent = 'Completed';
        emYear.appendChild(opt);
      }
      emYear.value = 'Completed';
    }
  }
}

function toggleNewStudentGradFields() {
  const grad = document.getElementById('ns-grad').value;
  const isGrad = grad === 'Graduated';
  document.getElementById('ns-gradIdGroup').style.display     = isGrad ? '' : 'none';
  document.getElementById('ns-gradIdMyGroup').style.display   = isGrad ? '' : 'none';
  document.getElementById('ns-gradDateGroup').style.display   = isGrad ? '' : 'none';
  document.getElementById('ns-gradDateMyGroup').style.display = isGrad ? '' : 'none';
  // Auto-set enrollment status and academic year to Degree Awarded when Graduated
  if (isGrad) {
    const nsEnroll = document.getElementById('ns-enroll');
    if (nsEnroll) nsEnroll.value = 'Degree Awarded';
    const nsYear = document.getElementById('ns-year');
    if (nsYear) {
      if (!Array.from(nsYear.options).some(o => o.value === 'Completed')) {
        const opt = document.createElement('option');
        opt.value = 'Completed'; opt.textContent = 'Completed';
        nsYear.appendChild(opt);
      }
      nsYear.value = 'Completed';
    }
  }
}

function toggleEnrollGradFields() {
  const grad = document.getElementById('en-grad').value;
  const isGrad = grad === 'Graduated';
  const gig  = document.getElementById('en-gradIdGroup');
  const gimy = document.getElementById('en-gradIdMyGroup');
  const gdg  = document.getElementById('en-gradDateGroup');
  const gdmy = document.getElementById('en-gradDateMyGroup');
  if (gig)  gig.style.display  = isGrad ? '' : 'none';
  if (gimy) gimy.style.display = isGrad ? '' : 'none';
  if (gdg)  gdg.style.display  = isGrad ? '' : 'none';
  if (gdmy) gdmy.style.display = isGrad ? '' : 'none';
  if (isGrad) {
    const enStatus = document.getElementById('en-status');
    if (enStatus) enStatus.value = 'Degree Awarded';
    const enYear = document.getElementById('en-year');
    if (enYear) {
      if (!Array.from(enYear.options).some(o => o.value === 'Completed')) {
        const opt = document.createElement('option');
        opt.value = 'Completed'; opt.textContent = 'Completed';
        enYear.appendChild(opt);
      }
      enYear.value = 'Completed';
    }
  }
}

// ── Document label helpers (Student ID Card ↔ Alumni ID Card, Confirmation of Study ↔ Graduation) ──
function getIdCardLabel(s) {
  return (s && s.grad_status === 'Graduated') ? 'Alumni ID Card' : 'Student ID Card';
}
function getConfirmationLabel(s) {
  return (s && s.grad_status === 'Graduated') ? 'Confirmation of Graduation' : 'Confirmation of Study';
}


// ══════════════════════════════════════════

// In-memory store for degree programs
let degreePrograms = [
  { id: 'MBBS', name: 'Bachelor of Medicine, Bachelor of Surgery', duration_yrs: 6,
    year_sequence: 'Foundation Year, M-1, M-2, M-3, M-4, M-5', status: 'Active' }
];

function renderDegreeGrid() {
  const grid = document.getElementById('degreeProgramGrid');
  if (!grid) return;
  grid.innerHTML = '';

  degreePrograms.forEach(p => {
    const years = (p.year_sequence || '').split(',').map(s => s.trim()).filter(Boolean);
    const stuCount = students.filter(s => (s.program || 'MBBS') === p.id).length;
    const courseCount = courses.filter(c => c[2] && years.includes(c[2])).length;
    const badgeClass = p.status === 'Active' ? 'b-green' : 'b-muted';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="flex gap-2" style="margin-bottom:14px">
        <div style="flex:1">
          <div style="font-family:'Libre Baskerville',serif;font-size:18px;color:var(--ink)">${p.id}</div>
          <div class="text-muted">${p.name}</div>
          ${p.name_my ? `<div class="text-muted my-text" lang="my" style="font-size:12px;color:var(--ink3);margin-top:2px">${p.name_my}</div>` : ''}
        </div>
        <span class="badge ${badgeClass}">${p.status}</span>
      </div>
      <div class="flex gap-2" style="font-size:12px;color:var(--ink3);margin-bottom:12px">
        <span>⏱ ${p.duration_yrs || years.length} years</span><span>·</span>
        <span>📚 ${courseCount} courses</span><span>·</span>
        <span style="display:flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> ${stuCount} students</span>
      </div>
      <hr class="divider">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink3);margin-bottom:8px">Year Sequence</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${years.map((y, i) => `<div class="flex gap-2" style="font-size:12px"><span class="badge b-blue" style="min-width:24px;text-align:center">${i+1}</span>${y}</div>`).join('')}
        <div class="flex gap-2" style="font-size:12px"><span class="badge b-green" style="min-width:24px;text-align:center">✓</span><strong style="color:var(--green)">Completed</strong></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline btn-sm" onclick="openDegreeModal('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="archiveDegree('${p.id}')">${p.status === 'Active' ? 'Archive' : 'Restore'}</button>
      </div>`;
    grid.appendChild(card);
  });

  // "Add new" placeholder card
  const addCard = document.createElement('div');
  addCard.className = 'card';
  addCard.style.cssText = 'border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:220px;cursor:pointer';
  addCard.onclick = () => openDegreeModal();
  addCard.innerHTML = `<div style="margin-bottom:6px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div><div style="font-size:14px;color:var(--ink3)">Add another degree program</div><button class="btn btn-primary btn-sm">New Program</button>`;
  grid.appendChild(addCard);
}

function openDegreeModal(pid) {
  const p = pid ? degreePrograms.find(x => x.id === pid) : null;
  document.getElementById('degreeModalTitle').textContent = p ? 'Edit Degree — ' + p.id : 'Add Degree Program';
  document.getElementById('dm-id').value       = p ? p.id : '';
  document.getElementById('dm-id').readOnly    = false; // ID editable — CASCADE handles referential integrity
  document.getElementById('dm-id').dataset.originalId = p ? p.id : ''; // track original for rename detection
  document.getElementById('dm-name').value     = p ? p.name : '';
  document.getElementById('dm-name-my').value  = p ? (p.name_my || '') : '';
  document.getElementById('dm-dur').value      = p ? p.duration_yrs : '';
  document.getElementById('dm-years').value    = p ? p.year_sequence : 'Foundation Year, M-1, M-2, M-3, M-4, M-5';
  document.getElementById('dm-status').value   = p ? p.status : 'Active';
  document.getElementById('degreeModal').classList.add('open');
}

async function saveDegree() {
  const id         = document.getElementById('dm-id').value.trim();
  const originalId = document.getElementById('dm-id').dataset.originalId || '';
  const name = document.getElementById('dm-name').value.trim();
  if (!id || !name) { toast('Program ID and Name are required.', '⚠️'); return; }
  const nameMy = document.getElementById('dm-name-my').value.trim();
  const dur  = parseInt(document.getElementById('dm-dur').value) || 0;
  const yrs  = document.getElementById('dm-years').value.trim();
  const stat = document.getElementById('dm-status').value;

  const prog = { id, name, name_my: nameMy, duration_yrs: dur, year_sequence: yrs, status: stat };
  const isRename = originalId && originalId !== id;

  // Update in-memory store
  if (isRename) {
    // Remove old entry, add new one
    degreePrograms = degreePrograms.filter(x => x.id !== originalId);
    degreePrograms.push(prog);
  } else {
    const existing = degreePrograms.findIndex(x => x.id === id);
    if (existing >= 0) degreePrograms[existing] = prog;
    else degreePrograms.push(prog);
  }

  // Persist to Supabase
  try {
    if (isRename) {
      // Insert new record first (CASCADE will update students/enrollments), then delete old
      const { error: insErr } = await db.from('degree_programs').insert(prog);
      if (insErr) { toast('DB sync failed: ' + insErr.message, '⚠️'); return; }
      await db.from('degree_programs').delete().eq('id', originalId);
    } else {
      const { error } = await db.from('degree_programs').upsert(prog, { onConflict: 'id' });
      if (error) toast('DB sync failed: ' + error.message, '⚠️');
    }
  } catch(e) { /* offline / table not yet created */ }

  closeModal('degreeModal');
  document.getElementById('dm-id').dataset.originalId = '';
  renderDegreeGrid();
  populateAllSelects();
  toast(`Degree program "${name}" saved.`, '✓');
}

async function archiveDegree(pid) {
  const p = degreePrograms.find(x => x.id === pid);
  if (!p) return;
  const newStatus = p.status === 'Active' ? 'Archived' : 'Active';
  p.status = newStatus;
  try {
    await db.from('degree_programs').update({ status: newStatus }).eq('id', pid);
  } catch(e) { /* offline */ }
  renderDegreeGrid();
  populateAllSelects();
  toast(`"${pid}" is now ${newStatus}.`, newStatus === 'Active' ? '✓' : '🗄');
}
