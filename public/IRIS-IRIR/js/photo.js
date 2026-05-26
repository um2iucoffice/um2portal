// ── Photo utility: create a protected (no right-click) img ───
function makeProtectedPhoto(src, styleStr) {
  const img = document.createElement('img');
  img.src = src;
  if (styleStr) img.style.cssText = styleStr;
  img.draggable = false;
  img.oncontextmenu = function(e) { e.preventDefault(); return false; };
  return img;
}

// ── Photo panel: preview selected file before upload ─────────
function previewPhoto(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('File is too large. Maximum size is 5 MB.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const wrap  = document.getElementById('photoSelectedWrap');
    const thumb = document.getElementById('photoSelectedThumb');
    const name  = document.getElementById('photoSelectedName');
    const size  = document.getElementById('photoSelectedSize');
    const btn   = document.getElementById('uploadPhotoBtn');
    if (thumb) thumb.src = e.target.result;
    if (name)  name.textContent = file.name;
    if (size)  size.textContent = (file.size / 1024).toFixed(1) + ' KB';
    if (wrap)  wrap.style.display = 'flex';
    if (btn)   btn.style.display = '';
    // store for upload
    window._pendingPhotoFile   = file;
    window._pendingPhotoBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Photo panel: clear selected file ─────────────────────────
function clearPhotoSelection() {
  const wrap  = document.getElementById('photoSelectedWrap');
  const btn   = document.getElementById('uploadPhotoBtn');
  const input = document.getElementById('photoFileInput');
  const status = document.getElementById('photoUploadStatus');
  if (wrap)   wrap.style.display = 'none';
  if (btn)    btn.style.display = 'none';
  if (input)  input.value = '';
  if (status) status.textContent = '';
  window._pendingPhotoFile   = null;
  window._pendingPhotoBase64 = null;
}

// ── Photo panel: remove current photo (clears UI + deletes from DB) ──
async function removePhoto() {
  const studentId = (document.getElementById('loginStudentId').value || '').trim().toLowerCase();
  if (!studentId) { alert('Session expired — please log in again.'); return; }

  const removeBtn = document.getElementById('removePhotoBtn');
  const status    = document.getElementById('photoUploadStatus');
  if (removeBtn) { removeBtn.disabled = true; removeBtn.textContent = 'Removing…'; }
  if (status)    { status.style.color = 'var(--ink3)'; status.textContent = 'Removing photo…'; }

  try {
    const resp = await fetch('/.netlify/functions/remove-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, token: window._sessionToken || '' })
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.message || 'Remove failed');
  } catch(e) {
    if (status)    { status.style.color = 'var(--crimson)'; status.textContent = 'Error: ' + e.message; }
    if (removeBtn) { removeBtn.disabled = false; removeBtn.textContent = 'Remove Photo'; }
    return;
  }

  // Clear all UI slots
  const preview = document.getElementById('profilePhotoPreview');
  if (preview) {
    preview.innerHTML = '<svg id="photoPlaceholderSvg" width="56" height="64" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="28" cy="20" rx="13" ry="14" fill="#D1D5DB"/><path d="M2 58c0-13.255 11.64-24 26-24s26 10.745 26 24" fill="#D1D5DB"/></svg>';
  }
  const avatarPhoto    = document.getElementById('avatarPhoto');
  const avatarInitials = document.getElementById('avatarInitials');
  if (avatarPhoto) { avatarPhoto.src = ''; avatarPhoto.style.display = 'none'; }
  if (avatarInitials) avatarInitials.style.display = '';
  if (removeBtn) { removeBtn.disabled = false; removeBtn.textContent = 'Remove Photo'; removeBtn.style.display = 'none'; }
  window._idcardPhotoData = null;

  // Restore initials in id card
  const idcardPhotoEl = document.getElementById('idcardPhoto');
  if (idcardPhotoEl) {
    const name = document.getElementById('profileName');
    const init = ((name && name.textContent) || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
    idcardPhotoEl.innerHTML = '';
    idcardPhotoEl.textContent = init;
  }

  // Clear sidebar avatar
  const sbAv = document.getElementById('sidebarAvatar');
  if (sbAv) { sbAv.innerHTML = ''; const n = document.getElementById('sidebarName'); sbAv.textContent = n ? (n.textContent||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?' : '?'; }

  // Clear home / grades avatars
  const homeAvatar = document.getElementById('homeAvatar');
  // homeAvatar removed
  const gradesAvatar = document.getElementById('gradesAvatar');
  // gradesAvatar removed

  // Update in-memory student data
  if (window._currentStudent) window._currentStudent.photo = null;

  if (status) { status.style.color = 'var(--green)'; status.textContent = '✓ Photo removed successfully.'; }
  setTimeout(() => { if (status) status.textContent = ''; }, 4000);
}

// ── Photo panel: upload photo to Supabase storage ────────────
async function uploadPhoto() {
  const file   = window._pendingPhotoFile;
  const status = document.getElementById('photoUploadStatus');
  const btn    = document.getElementById('uploadPhotoBtn');
  if (!file) { if (status) status.textContent = 'No file selected.'; return; }

  // Sanitize studentId — Supabase Storage rejects paths with spaces or special chars
  const rawId     = (document.getElementById('loginStudentId').value || '').trim().toLowerCase();
  const studentId = rawId.replace(/[^a-z0-9_\-]/g, '_');
  if (!studentId) { if (status) status.textContent = 'Session expired — please log in again.'; return; }

  // Use a safe timestamp-based filename so the Storage path is always valid
  const mimeToExt  = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const safeExt    = mimeToExt[file.type] || 'jpg';
  const safeFilename = `photo_${Date.now()}.${safeExt}`;

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
  if (status) { status.style.color = 'var(--ink3)'; status.textContent = 'Uploading…'; }

  try {
    const reader = new FileReader();
    const base64 = await new Promise((res, rej) => {
      reader.onload = e => res(e.target.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    const resp = await fetch('/.netlify/functions/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        safeFilename,          // backend uses this for the Storage path
        token: window._sessionToken ||'',
        imageBase64: base64,
        mimeType:    file.type
      })
    });
    const data = await resp.json();

   if (data.success && data.pending) {
  // Show the pending photo in the preview with a "Pending Approval" overlay
  const pendingUrl = data.pendingUrl || window._pendingPhotoBase64;
  const preview = document.getElementById('profilePhotoPreview');
  if (preview && pendingUrl) {
    preview.innerHTML = `
      <div style="position:relative;width:100%;height:100%">
        <img src="${pendingUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;opacity:0.65;pointer-events:none;user-select:none;-webkit-user-select:none" draggable="false" oncontextmenu="return false">
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(154,123,47,0.18);border-radius:8px;border:1.5px solid var(--gold,#9A7B2F)">
          <svg style="width:20px;height:20px;stroke:var(--gold,#9A7B2F);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--gold,#9A7B2F);text-align:center;margin-top:3px">Pending<br>Approval</span>
        </div>
      </div>`;
  }
  clearPhotoSelection();  // clear file selection
  if (status) {
    status.style.color = 'var(--gold, #9A7B2F)';
    status.textContent = 'Photo submitted for Registrar approval. Your ID photo will update once approved.';
  }

    } else if (data.success && data.photoUrl) {
      // Legacy direct-upload path (kept for safety)
      updatePhotoInUI(data.photoUrl);
      const preview = document.getElementById('profilePhotoPreview');
      if (preview) {
        const pImg = document.createElement('img');
        pImg.src = data.photoUrl;
        pImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;pointer-events:none;user-select:none;-webkit-user-select:none';
        pImg.draggable = false;
        pImg.oncontextmenu = function(e){ e.preventDefault(); return false; };
        preview.innerHTML = '';
        preview.appendChild(pImg);
      }
      const removeBtn = document.getElementById('removePhotoBtn');
      if (removeBtn) removeBtn.style.display = 'inline-block';
      if (status) status.textContent = 'Photo uploaded successfully!';
      clearPhotoSelection();
    } else {
      if (status) status.textContent = 'Upload failed: ' + (data.message || 'Unknown error');
    }
  } catch(e) {
    if (status) status.textContent = 'Upload error: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Photo'; }
  }
}


function updatePhotoInUI(photoUrl) {
  if (!photoUrl) return;
  // Profile banner avatar (top of profile tab)
  const avatarPhoto    = document.getElementById('avatarPhoto');
  const avatarInitials = document.getElementById('avatarInitials');
  if (avatarPhoto) {
    avatarPhoto.src = photoUrl;
    avatarPhoto.style.display = '';
    if (avatarInitials) avatarInitials.style.display = 'none';
  }
  const sbAv = document.getElementById('sidebarAvatar');
  if (sbAv) {
    sbAv.innerHTML = '';
    const si = makeProtectedPhoto(photoUrl, 'width:100%;height:100%;object-fit:cover;border-radius:7px;display:block;pointer-events:none;user-select:none;-webkit-user-select:none');
    sbAv.appendChild(si);
  }
  // Home hero avatar
  const homeAvatar = document.getElementById('homeAvatar');
  if (homeAvatar) {
    homeAvatar.innerHTML = '';
    const img = makeProtectedPhoto(photoUrl, 'width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;pointer-events:none;user-select:none;-webkit-user-select:none');
    homeAvatar.appendChild(img);
  }
  // Grades banner avatar
  const gradesAvatar = document.getElementById('gradesAvatar');
  if (gradesAvatar) {
    gradesAvatar.innerHTML = '';
    const img2 = makeProtectedPhoto(photoUrl, 'width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;pointer-events:none;user-select:none;-webkit-user-select:none');
    gradesAvatar.appendChild(img2);
  }
}

function populateIDCard(s, isGraduated, gradID, gradDate) {
  const init = (s.fullName || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
  const idcardPhotoEl = document.getElementById('idcardPhoto');
  // Always reset — never carry over a previous student's photo
  // Store photo data on window so printIDCard() can embed it directly
  window._idcardPhotoData = s.photo || null;
  if (idcardPhotoEl) {
    if (s.photo) {
      idcardPhotoEl.innerHTML = '';
      idcardPhotoEl.appendChild(makeProtectedPhoto(s.photo, 'width:100%;height:100%;object-fit:cover;display:block'));
    } else {
      idcardPhotoEl.innerHTML = '';
      idcardPhotoEl.textContent = init;
    }
  }
  document.getElementById('idcardName').textContent     = s.fullName      || '';
  document.getElementById('idcardNameMM').textContent   = s.fullNameMM    || '';
  document.getElementById('idcardID').textContent       = s.id            || '—';
  document.getElementById('idcardStatus').textContent   = s.currentStatus || '—';
  document.getElementById('idcardAdmission').textContent= s.admissionYear || '—';
  document.getElementById('idcardAdmissionBack').textContent = s.admissionYear || '—';
  document.getElementById('idcardEnroll').textContent   = s.enrollmentStatus || '—';
  // Gender — capitalise first letter
  const genderVal = s.gender ? (s.gender.charAt(0).toUpperCase() + s.gender.slice(1).toLowerCase()) : '—';
  const idcardGenderEl     = document.getElementById('idcardGender');
  const idcardGenderBackEl = document.getElementById('idcardGenderBack');
  if (idcardGenderEl)     idcardGenderEl.textContent     = genderVal;
  if (idcardGenderBackEl) idcardGenderBackEl.textContent = genderVal;
  const idcardProgramEl = document.getElementById('idcardProgram');
  if (idcardProgramEl) idcardProgramEl.textContent = s.programName || s.program || '—';

  // ── Supervisor — show for Master / PhD only ───────────────────
  const activeEnroll = (window._enrollments || []).find(e =>
    /^active$/i.test(e.enrollmentStatus || '')
  );
  const supervisorRow = document.getElementById('idcardSupervisorRow');
  const supervisorEl  = document.getElementById('idcardSupervisor');
  const supervisorVal = activeEnroll?.supervisor || s.supervisor || '';
  const showSupervisor = supervisorVal &&
    (activeEnroll?.degreeLevel === 'master' || activeEnroll?.degreeLevel === 'phd');
  if (supervisorRow) supervisorRow.style.display = showSupervisor ? '' : 'none';
  if (supervisorEl && showSupervisor) supervisorEl.textContent = supervisorVal;

  // ── Alumni vs Student labels on card ─────────────────────────
  const typeBadge = document.getElementById('idcardTypeBadge');
  const idLabel   = document.getElementById('idcardIDLabel');
  if (typeBadge) typeBadge.textContent = isGraduated ? 'Alumni' : 'Student';
  if (idLabel)   idLabel.textContent   = isGraduated ? 'Alumni ID' : 'Student ID';

  // ── Validity / graduation date ────────────────────────────────
  const ACADEMIC_YEAR = '2026–2027';
  const yearMatch = ACADEMIC_YEAR.match(/\d{4}.*?(\d{4})/);
  const validYear = yearMatch ? yearMatch[1] : '';
  const isActive = /^active$/i.test((s.enrollmentStatus || '').trim());
  const validityLabel = document.getElementById('idcardValidityLabel');
  const validityYear  = document.getElementById('idcardValidityYear');
  if (isGraduated) {
    if (validityLabel) validityLabel.textContent = 'Graduated';
    if (validityYear)  {
      validityYear.textContent   = gradDate || gradID || '';
      validityYear.style.fontSize   = '9px';
      validityYear.style.color      = 'rgba(255,255,255,.85)';
      validityYear.style.fontWeight = '600';
    }
  } else if (isActive) {
    if (validityLabel) validityLabel.textContent = 'Valid until';
    if (validityYear)  {
      validityYear.textContent   = validYear;
      validityYear.style.fontSize   = '10px';
      validityYear.style.color      = 'rgba(255,255,255,.85)';
      validityYear.style.fontWeight = '700';
    }
  } else {
    if (validityLabel) validityLabel.textContent = '';
    if (validityYear)  {
      validityYear.textContent   = 'This card is invalid';
      validityYear.style.fontSize   = '8px';
      validityYear.style.color      = 'rgba(255,180,180,.9)';
      validityYear.style.fontWeight = '600';
    }
  }

  document.getElementById('idcardBirth').textContent    = s.birthDate     || '—';
  document.getElementById('idcardPhone').textContent    = s.phone         || '—';
  document.getElementById('idcardFather').textContent   = s.fatherName    || '—';

  const sid = s.id || '';
  document.getElementById('idcardBarcodeNum').textContent = sid.toUpperCase();

  // Generate QR code on the back
  const qrEl = document.getElementById('idcardQR');
  qrEl.innerHTML = '';
  const qrData = window.location.origin + '/verify?id=' + encodeURIComponent(s.id || '');
  new QRCode(qrEl, {
    text: qrData,
    width: 76,
    height: 76,
    colorDark: '#0D1B2A',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function printIDCard() {
  const esc = function(value) {
    return String(value || '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const isGrad = window._studentGraduated || false;
  const _gradID   = window._studentGradID   || '';
  const _gradDate = window._studentGradDate || '';
  const _idLabel  = window._studentIdLabel  || 'Student ID';
  const s = {
    name:       document.getElementById('idcardName').textContent,
    nameMM:     document.getElementById('idcardNameMM').textContent,
    id:         document.getElementById('idcardID').textContent,
    status:     document.getElementById('idcardStatus').textContent,
    admission:  document.getElementById('idcardAdmission').textContent,
    enroll:     document.getElementById('idcardEnroll').textContent,
    program:    document.getElementById('idcardProgram')?.textContent || '',
    supervisor: document.getElementById('idcardSupervisor')?.textContent || '',
    supervisorVisible: document.getElementById('idcardSupervisorRow')?.style.display !== 'none',
    birth:      document.getElementById('idcardBirth').textContent,
    phone:      document.getElementById('idcardPhone').textContent,
    father:     document.getElementById('idcardFather').textContent,
    gender:     document.getElementById('idcardGender')?.textContent || '',
    init:       document.getElementById('idcardPhoto').textContent,
    hasPhoto:   !!window._idcardPhotoData,
    photoSrc:   window._idcardPhotoData || '',
    isGrad,
    gradID:     _gradID,
    gradDate:   _gradDate,
    idLabel:    _idLabel
  };

  const qrData = window.location.origin + '/verify?id=' + encodeURIComponent(s.id || '');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${esc(s.isGrad ? 'Alumni ID Card' : 'Student ID Card')} — ${esc(s.id)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--ink:#0D1B2A;--ink2:#3D4A5C;--ink3:#7A8599;--line:#E8EBF0;--surface:#F2F4F8;--white:#FFFFFF;--crimson:#8B1A2E;--crimson-mid:#C4273E;--gold:#9A7B2F;--r:6px}
    body{font-family:'DM Sans',sans-serif;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:24px;padding:20px;-webkit-font-smoothing:antialiased;color:var(--ink)}
    .idcard{width:480px;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px rgba(13,27,42,.2),0 4px 16px rgba(13,27,42,.1),0 0 0 1px rgba(13,27,42,.08);user-select:none}
    .idcard-front{display:flex;flex-direction:row;background:#fff;min-height:295px;position:relative;overflow:hidden}
    .idcard-left-band{width:120px;flex-shrink:0;background:linear-gradient(175deg,#8B1A2E 0%,#6b1222 55%,#3e0b18 100%);display:flex;flex-direction:column;align-items:center;padding:18px 10px 14px;position:relative;overflow:hidden}
    .idcard-left-band::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 1px,transparent 1px,transparent 14px);pointer-events:none}
    .idcard-left-band::after{content:'';position:absolute;top:0;left:0;right:0;height:60%;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.1) 0%,transparent 70%);pointer-events:none}
    .idcard-band-logo{width:54px;height:auto;object-fit:contain;margin-bottom:10px;position:relative;z-index:1}
    .idcard-band-title{font-size:7px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.6);text-align:center;line-height:1.6;position:relative;z-index:1;margin-bottom:12px}
    .idcard-photo{width:82px;height:100px;border-radius:3px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:28px;font-weight:700;color:rgba(255,255,255,.65);box-shadow:0 4px 14px rgba(0,0,0,.4);position:relative;z-index:1;flex-shrink:0}
    .idcard-photo img{width:100%;height:100%;object-fit:cover;display:block}
    .idcard-band-badge{margin-top:auto;padding-top:14px;font-size:6.5px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,.85);text-align:center;position:relative;z-index:1;border-top:1px solid rgba(255,255,255,.15);width:100%}
    .idcard-right{flex:1;display:flex;flex-direction:column;background:#fff;position:relative;overflow:hidden;min-width:0}
    .idcard-right::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(139,26,46,.045) 1px,transparent 1px);background-size:18px 18px;pointer-events:none}
    .idcard-right-header{padding:11px 16px 9px;border-bottom:2px solid #8B1A2E;position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .idcard-uni-block{flex:1;min-width:0}
    .idcard-uni-name{font-size:10px;font-weight:800;color:#0D1B2A;letter-spacing:.3px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .idcard-uni-sub{font-size:7px;color:#7A8599;letter-spacing:.2px;line-height:1.5}
    .idcard-right-badge{font-size:6.5px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;background:#8B1A2E;color:#fff;padding:3px 8px;border-radius:2px;white-space:nowrap;flex-shrink:0}
    .idcard-right-body{flex:1;padding:11px 16px 10px;position:relative;z-index:1;display:flex;flex-direction:column;gap:7px}
    .idcard-name{font-size:15.5px;font-weight:800;color:#0D1B2A;line-height:1.2;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .idcard-name-mm{font-size:9.5px;color:#7A8599;line-height:1.4;margin-top:-3px;margin-bottom:3px}
    .idcard-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}
    .idcard-field{display:flex;flex-direction:column;gap:1px}
    .idcard-field-lbl{font-size:6.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#9A7B2F}
    .idcard-field-val{font-size:11px;font-weight:600;color:#0D1B2A;line-height:1.3}
    .idcard-holo-strip{height:4px;background:linear-gradient(90deg,#9A7B2F,#e8c96a,#f5d98a,#9A7B2F,#c8a84b,#f0d080,#9A7B2F,#e8c96a);position:relative;z-index:1}
    .idcard-bottom{background:#0D1B2A;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
    .idcard-id-label{font-size:6.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:1px}
    .idcard-id-value{font-family:monospace;font-size:15px;font-weight:700;color:#fff;letter-spacing:2.5px}
    .idcard-validity{text-align:right}
    .idcard-validity span{font-size:6.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.4);display:block}
    .idcard-validity strong{font-size:11px;color:rgba(255,255,255,.88);letter-spacing:.5px;font-weight:700;display:block}
    .idcard-back{display:flex;flex-direction:row;background:#fff;position:relative;overflow:hidden;border-top:3px solid #8B1A2E}
    .idcard-back::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(139,26,46,.04) 1px,transparent 1px);background-size:18px 18px;pointer-events:none}
    .idcard-back-left{width:120px;flex-shrink:0;background:#f9f1f3;border-right:1px solid #e8d4d8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 10px;gap:12px;position:relative;z-index:1}
    .idcard-qr-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
    .idcard-qr-wrap canvas,.idcard-qr-wrap img{border:1px solid #ddd;border-radius:2px;display:block}
    .idcard-qr-lbl{font-size:6px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9A7B2F;text-align:center}
    .idcard-sig-area{border-top:1px solid #ccc;padding-top:6px;width:100%;text-align:center;font-size:6px;color:#7A8599;letter-spacing:.4px;text-transform:uppercase}
    .idcard-back-right{flex:1;padding:14px 16px;display:flex;flex-direction:column;gap:10px;position:relative;z-index:1}
    .idcard-back-header{font-size:7px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8B1A2E;padding-bottom:6px;border-bottom:1px solid #e8d4d8}
    .idcard-back-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1}
    .idcard-back-field .lbl{font-size:6.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7A8599;margin-bottom:2px}
    .idcard-back-field .val{font-size:11.5px;font-weight:600;color:#0D1B2A}
    .idcard-back-bottom{display:flex;flex-direction:column;gap:2px}
    .idcard-sid-block .lbl{font-size:6.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7A8599;margin-bottom:2px}
    .idcard-sid-block .val{font-size:13px;font-weight:700;color:#0D1B2A;letter-spacing:2px;font-family:monospace}
    .idcard-notice{font-size:6.5px;color:#9A9A9A;line-height:1.6;font-style:italic}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff;padding:0;min-height:auto;display:block}.idcard{box-shadow:none;width:100%}@page{margin:8mm;size:landscape}}
  </style>
  </head><body>
  <div class="idcard">
    <div class="idcard-front">
      <div class="idcard-left-band">
        <img src="https://raw.githubusercontent.com/um2iucoffice/um2portal/cddfb252ec6cf6cecc25c53a8630d92b08c2aaa8/public/UM2_Logo.svg" alt="UM2" class="idcard-band-logo">
        <div class="idcard-band-title">University<br>of Medicine (2)</div>
        <div class="idcard-photo">${s.hasPhoto ? `<img src="${s.photoSrc}">` : esc(s.init)}</div>
        <div class="idcard-band-badge">${esc(s.isGrad ? 'Alumni' : 'Student')}</div>
      </div>
      <div class="idcard-right">
        <div class="idcard-right-header">
          <div class="idcard-uni-block">
            <div class="idcard-uni-name">University of Medicine (2)</div>
            <div class="idcard-uni-sub">Interim University Council · Republic of the Union of Myanmar</div>
          </div>
          <div class="idcard-right-badge">Student ID</div>
        </div>
        <div class="idcard-right-body">
          <div class="idcard-name">${esc(s.name)}</div>
          <div class="idcard-name-mm">${esc(s.nameMM)}</div>
          <div class="idcard-fields">
            <div class="idcard-field"><span class="idcard-field-lbl">Year of Study</span><span class="idcard-field-val">${esc(s.status)}</span></div>
            <div class="idcard-field"><span class="idcard-field-lbl">Gender</span><span class="idcard-field-val">${esc(s.gender || '—')}</span></div>
            <div class="idcard-field"><span class="idcard-field-lbl">Program</span><span class="idcard-field-val">${esc(s.program)}</span></div>
            <div class="idcard-field"><span class="idcard-field-lbl">Enrolled</span><span class="idcard-field-val">${esc(s.admission)}</span></div>
            ${s.supervisorVisible ? `<div class="idcard-field"><span class="idcard-field-lbl">Supervisor</span><span class="idcard-field-val">${esc(s.supervisor)}</span></div>` : ''}
          </div>
        </div>
        <div class="idcard-holo-strip"></div>
        <div class="idcard-bottom">
          <div><div class="idcard-id-label">${esc(s.idLabel)}</div><div class="idcard-id-value">${esc(s.id)}</div></div>
          ${s.isGrad
            ? `<div class="idcard-validity"><span>Graduated</span><strong>${esc(s.gradDate || s.gradID || '')}</strong></div>`
            : /^active$/i.test((s.enroll || '').trim())
              ? `<div class="idcard-validity"><span>Valid Through</span><strong>${((() => { const m = '2026–2027'.match(/\d{4}.*?(\d{4})/); return m ? m[1] : ''; })())}</strong></div>`
              : `<div class="idcard-validity"><span style="font-size:7px;color:rgba(255,160,160,.9);font-weight:600;letter-spacing:.5px">Card Inactive</span></div>`
          }
        </div>
      </div>
    </div>
    <div class="idcard-back">
      <div class="idcard-back-left">
        <div class="idcard-qr-wrap"><div id="printQR"></div><div class="idcard-qr-lbl">Scan to Verify</div></div>
        <div class="idcard-sig-area">Registrar's Office</div>
      </div>
      <div class="idcard-back-right">
        <div class="idcard-back-header">University of Medicine (2) — Student Identification Card</div>
        <div class="idcard-back-fields">
          <div class="idcard-back-field"><div class="lbl">Date of Birth</div><div class="val">${esc(s.birth)}</div></div>
          <div class="idcard-back-field"><div class="lbl">Gender</div><div class="val">${esc(s.gender || '—')}</div></div>
          <div class="idcard-back-field"><div class="lbl">Father's Name</div><div class="val">${esc(s.father)}</div></div>
          <div class="idcard-back-field"><div class="lbl">Phone</div><div class="val">${esc(s.phone)}</div></div>
          <div class="idcard-back-field"><div class="lbl">Enrollment Status</div><div class="val">${esc(s.enroll)}</div></div>
          <div class="idcard-back-field"><div class="lbl">Admission Year</div><div class="val">${esc(s.admission)}</div></div>
        </div>
        <div class="idcard-back-bottom">
          <div class="idcard-sid-block"><div class="lbl">Student ID</div><div class="val">${esc(String(s.id).toUpperCase())}</div></div>
          <div class="idcard-notice">This card is the property of University of Medicine (2) — IUC. If found, please return to the Registrar's Office. Misuse of this card is subject to disciplinary action.</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      new QRCode(document.getElementById('printQR'), { text: ${JSON.stringify(qrData)}, width: 76, height: 76, colorDark: '#0D1B2A', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      setTimeout(function(){ window.print(); }, 900);
    };
  <\/script>
  </body></html>`;

  // AFTER
const win = window.open('', '_blank', 'width=500,height=750');
const blob = new Blob([html], { type: 'text/html' });
const url  = URL.createObjectURL(blob);
win.location.href = url;
setTimeout(() => URL.revokeObjectURL(url), 10000);
  win.document.close();
}


