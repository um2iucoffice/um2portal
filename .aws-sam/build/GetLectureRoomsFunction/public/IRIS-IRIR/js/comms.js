// ── Communication section ────────────────────────────────────
const COMMS_PLATFORM_META = {
  telegram:  { label: 'Telegram',  colorClass: 'telegram',
    /* Official Telegram paper-plane logo */
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#229ED9"/><path d="M5.33 11.9 17.9 7.05c.6-.22 1.12.15.92.94l-2.1 9.9c-.16.72-.58.9-1.17.56l-3.26-2.4-1.57 1.51c-.17.17-.32.32-.66.32l.23-3.33 6.02-5.43c.26-.23-.06-.36-.4-.13l-7.44 4.68-3.2-1c-.7-.22-.71-.7.15-1.03z" fill="#fff"/></svg>` },
  whatsapp:  { label: 'WhatsApp',  colorClass: 'whatsapp',
    /* Official WhatsApp brand logo */
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M17.47 6.51A7.24 7.24 0 0 0 12.01 4C8.2 4 5.1 7.1 5.1 10.9c0 1.21.32 2.4.92 3.44L5 19l4.76-1.25a7.3 7.3 0 0 0 3.25.77h.01c3.8 0 6.9-3.1 6.9-6.9 0-1.84-.72-3.57-2.02-4.87l-.43-.24zm-5.46 10.6h-.01a6.06 6.06 0 0 1-3.09-.84l-.22-.13-2.28.6.61-2.22-.15-.23a6.04 6.04 0 0 1-.92-3.2 6.07 6.07 0 0 1 6.06-6.06 6.07 6.07 0 0 1 6.07 6.07 6.07 6.07 0 0 1-6.07 6.01zm3.33-4.54c-.18-.09-1.08-.53-1.25-.59-.16-.06-.28-.09-.4.09-.12.18-.47.59-.57.71-.1.12-.21.13-.39.04a4.97 4.97 0 0 1-1.47-.9 5.5 5.5 0 0 1-1.01-1.27c-.11-.18-.01-.28.08-.37.08-.08.18-.21.27-.32.09-.11.12-.18.18-.3.06-.12.03-.23-.01-.32-.05-.09-.41-1-.57-1.37-.15-.36-.3-.31-.41-.31h-.35c-.12 0-.32.04-.48.23-.17.18-.63.62-.63 1.5 0 .89.65 1.74.74 1.86.09.12 1.28 1.95 3.1 2.74.43.19.77.3 1.03.38.43.14.82.12 1.13.07.35-.05 1.08-.44 1.23-.87.15-.43.15-.79.11-.87-.05-.08-.17-.12-.35-.21z" fill="#fff"/></svg>` },
  facebook:  { label: 'Facebook',  colorClass: 'facebook',
    /* Official Facebook "f" logo */
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M16.5 8H14a.5.5 0 0 0-.5.5V10H16l-.5 2.5H13.5V19h-3v-6.5H9V10h1.5V8.5A3.5 3.5 0 0 1 14 5H16.5v3z" fill="#fff"/></svg>` },
  viber:     { label: 'Viber',     colorClass: 'viber',
    /* Viber speech-bubble style */
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#7B65BF"/><path d="M17.1 7.1C15.5 5.6 13.3 4.8 11 4.9c-4.5.2-8 3.9-8 8.4 0 1.4.4 2.8 1 4l-1.1 4 4.2-1.1c1.1.6 2.4.9 3.6.9 4.6 0 8.3-3.7 8.3-8.3 0-2.2-.9-4.3-2.4-5.7h.5zm-5.6 12.7c-1.2 0-2.4-.3-3.4-.9l-.2-.1-2.5.7.7-2.4-.2-.2c-.7-1.1-1.1-2.4-1.1-3.7 0-3.8 3.1-6.9 6.9-6.9 1.8 0 3.5.7 4.8 2 1.3 1.3 2 3 2 4.8-.1 3.8-3.2 6.9-7 6.7zm3.8-5.1c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.7.8c-.1.1-.2.1-.4 0-.2-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.3-.3.2-.3c0-.1.1-.2 0-.4-.1-.1-.5-1.1-.7-1.5-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.5 2.4 3.7 3.3.5.2.9.3 1.2.4.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1-.1-.1-.2-.2-.4-.3z" fill="#fff"/></svg>` },
  other:     { label: 'Link',      colorClass: 'other',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e05470" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>` }
};

function getPlatformKey(url, platform) {
  if (platform) return platform.toLowerCase();
  if (!url) return 'other';
  if (/t\.me|telegram/i.test(url))   return 'telegram';
  if (/wa\.me|whatsapp/i.test(url))  return 'whatsapp';
  if (/facebook\.com|fb\.com/i.test(url)) return 'facebook';
  if (/viber\.com/i.test(url))       return 'viber';
  return 'other';
}

function buildCommsCard(ch) {
  // Support both channel link and GP (group) link
  const channelUrl = ch.channel_link || ch.channel_url || ch.url || ch.link || '';
  const gpUrl      = ch.gp_link || ch.group_link || ch.gp_url || '';
  const anyUrl     = channelUrl || gpUrl;
  const pKey       = getPlatformKey(anyUrl, ch.platform);
  const meta       = COMMS_PLATFORM_META[pKey] || COMMS_PLATFORM_META.other;
  const name       = ch.name || ch.title || 'Channel';
  const desc       = ch.description || ch.desc || '';
  const members    = ch.members || ch.member_count || '';

  // Card is a div so we can have multiple links inside
  const card = document.createElement('div');
  card.className = `comms-channel-card ${meta.colorClass}${!anyUrl ? ' disabled' : ''}`;

  // Platform-branded mini icons for buttons
  const PLATFORM_BTN_ICONS = {
    telegram: `<svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#229ED9"/><path d="M5.33 11.9 17.9 7.05c.6-.22 1.12.15.92.94l-2.1 9.9c-.16.72-.58.9-1.17.56l-3.26-2.4-1.57 1.51c-.17.17-.32.32-.66.32l.23-3.33 6.02-5.43c.26-.23-.06-.36-.4-.13l-7.44 4.68-3.2-1c-.7-.22-.71-.7.15-1.03z" fill="#fff"/></svg>`,
    whatsapp: `<svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M17.47 6.51A7.24 7.24 0 0 0 12.01 4C8.2 4 5.1 7.1 5.1 10.9c0 1.21.32 2.4.92 3.44L5 19l4.76-1.25a7.3 7.3 0 0 0 3.25.77h.01c3.8 0 6.9-3.1 6.9-6.9 0-1.84-.72-3.57-2.02-4.87l-.43-.24zm-5.46 10.6h-.01a6.06 6.06 0 0 1-3.09-.84l-.22-.13-2.28.6.61-2.22-.15-.23a6.04 6.04 0 0 1-.92-3.2 6.07 6.07 0 0 1 6.06-6.06 6.07 6.07 0 0 1 6.07 6.07 6.07 6.07 0 0 1-6.07 6.01zm3.33-4.54c-.18-.09-1.08-.53-1.25-.59-.16-.06-.28-.09-.4.09-.12.18-.47.59-.57.71-.1.12-.21.13-.39.04a4.97 4.97 0 0 1-1.47-.9 5.5 5.5 0 0 1-1.01-1.27c-.11-.18-.01-.28.08-.37.08-.08.18-.21.27-.32.09-.11.12-.18.18-.3.06-.12.03-.23-.01-.32-.05-.09-.41-1-.57-1.37-.15-.36-.3-.31-.41-.31h-.35c-.12 0-.32.04-.48.23-.17.18-.63.62-.63 1.5 0 .89.65 1.74.74 1.86.09.12 1.28 1.95 3.1 2.74.43.19.77.3 1.03.38.43.14.82.12 1.13.07.35-.05 1.08-.44 1.23-.87.15-.43.15-.79.11-.87-.05-.08-.17-.12-.35-.21z" fill="#fff"/></svg>`,
    facebook: `<svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M16.5 8H14a.5.5 0 0 0-.5.5V10H16l-.5 2.5H13.5V19h-3v-6.5H9V10h1.5V8.5A3.5 3.5 0 0 1 14 5H16.5v3z" fill="#fff"/></svg>`,
    viber:    `<svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#7B65BF"/><path d="M17.1 7.1C15.5 5.6 13.3 4.8 11 4.9c-4.5.2-8 3.9-8 8.4 0 1.4.4 2.8 1 4l-1.1 4 4.2-1.1c1.1.6 2.4.9 3.6.9 4.6 0 8.3-3.7 8.3-8.3 0-2.2-.9-4.3-2.4-5.7h.5zm-5.6 12.7c-1.2 0-2.4-.3-3.4-.9l-.2-.1-2.5.7.7-2.4-.2-.2c-.7-1.1-1.1-2.4-1.1-3.7 0-3.8 3.1-6.9 6.9-6.9 1.8 0 3.5.7 4.8 2 1.3 1.3 2 3 2 4.8-.1 3.8-3.2 6.9-7 6.7zm3.8-5.1c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.5.1l-.7.8c-.1.1-.2.1-.4 0-.2-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.3.1-.4l.3-.3.2-.3c0-.1.1-.2 0-.4-.1-.1-.5-1.1-.7-1.5-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.5 2.4 3.7 3.3.5.2.9.3 1.2.4.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1-.1-.1-.2-.2-.4-.3z" fill="#fff"/></svg>`,
    other:    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
  };
  const btnIcon = PLATFORM_BTN_ICONS[pKey] || PLATFORM_BTN_ICONS.other;

  // GP group icon (people)
  const gpIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

  // Build the action buttons row
  let actionsHtml = '';
  if (channelUrl) {
    actionsHtml += `<a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="comms-ch-btn comms-ch-btn-channel" onclick="event.stopPropagation()">${btnIcon} Channel</a>`;
  }
  if (gpUrl) {
    actionsHtml += `<a href="${gpUrl}" target="_blank" rel="noopener noreferrer" class="comms-ch-btn comms-ch-btn-gp" onclick="event.stopPropagation()">${gpIcon} Join Group</a>`;
  }
  if (!anyUrl) {
    actionsHtml = `<span class="comms-ch-join">Coming soon</span>`;
  }

  card.innerHTML = `
    <div class="comms-ch-accent"></div>
    <div class="comms-ch-body">
      <div class="comms-ch-icon">${meta.icon}</div>
      <div class="comms-ch-info">
        <div class="comms-ch-type">${meta.label}</div>
        <div class="comms-ch-name">${name}</div>
        ${desc ? `<div class="comms-ch-desc">${desc}</div>` : ''}
      </div>
    </div>
    <div class="comms-ch-footer">
      <span class="comms-ch-members">
        ${members ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> ${members} members` : ''}
      </span>
      <div class="comms-ch-actions">${actionsHtml}</div>
    </div>`;
  return card;
}

// ── Lecture Rooms ─────────────────────────────────────────────
let _lectureRoomsLoaded = false;

function buildLectureRoomCard(room) {
  const card = document.createElement('div');
  card.className = 'lr-card';

  const subject   = room.subject          || 'Lecture Room';
  const desc      = room.description      || '';
  const link      = room.zoom_link        || '';
  const meetingId = room.zoom_meeting_id  || '';
  const passcode  = room.zoom_passcode    || '';

  const meetingChip = meetingId ? `
    <div class="lr-chip">
      <span class="lr-chip-label">ID</span>
      <span class="lr-chip-val">${meetingId}</span>
    </div>` : '';

  const passcodeChip = passcode ? `
    <div class="lr-chip">
      <span class="lr-chip-label">Pass</span>
      <span class="lr-chip-val">${passcode}</span>
    </div>` : '';

  const safePass = passcode.replace(/'/g, "\'");

  const joinBtn = link ? `
    <a href="${link}" target="_blank" rel="noopener noreferrer" class="lr-btn lr-btn-join" onclick="event.stopPropagation()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.277A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14"/><rect x="1" y="6" width="14" height="12" rx="2"/></svg>
      Join Room
    </a>` : '';

  const copyBtn = passcode ? `
    <button class="lr-btn lr-btn-copy" onclick="event.stopPropagation();copyPasscode(this,'${safePass}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    </button>` : '';

  card.innerHTML = `
    <div class="lr-screen">
      <div class="lr-live-badge"><span class="lr-live-dot"></span>Session</div>
      <div class="lr-screen-display">
        <div class="lr-screen-logo">
          <svg width="34" height="26" viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Chalk lines on board -->
            <line x1="6" y1="8" x2="28" y2="8" stroke="rgba(200,220,200,0.35)" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="6" y1="13" x2="22" y2="13" stroke="rgba(200,220,200,0.25)" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="6" y1="18" x2="25" y2="18" stroke="rgba(200,220,200,0.2)" stroke-width="1.5" stroke-linecap="round"/>
            <!-- Chalk dot accent -->
            <circle cx="28" cy="13" r="1.5" fill="rgba(200,220,200,0.3)"/>
          </svg>
          <span class="lr-screen-logo-text">Lecture</span>
        </div>
      </div>
      <div class="lr-chalk-tray"></div>
    </div>
    <div class="lr-divider"></div>
    <div class="lr-card-body">
      <div class="lr-card-subject">${subject}</div>
      ${desc ? `<div class="lr-card-desc">${desc}</div>` : ''}
      ${(meetingChip || passcodeChip) ? `<div class="lr-chips">${meetingChip}${passcodeChip}</div>` : ''}
    </div>
    <div class="lr-card-footer">
      ${joinBtn}${copyBtn}
    </div>`;

  return card;
}

function copyPasscode(btn, code) {
  navigator.clipboard.writeText(code).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Passcode`;
    }, 2200);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.classList.add('copied');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Passcode`;
    }, 2200);
  });
}

async function loadLectureRooms() {
  const loadEl  = document.getElementById('lectureRoomsLoading');
  const errEl   = document.getElementById('lectureRoomsError');
  const gridEl  = document.getElementById('lectureRoomsGrid');
  const emptyEl = document.getElementById('lectureRoomsEmpty');

  if (!loadEl) return;

  // Already loaded — don't re-fetch
  if (_lectureRoomsLoaded) return;

  loadEl.style.display  = 'flex';
  errEl.style.display   = 'none';
  gridEl.style.display  = 'none';
  emptyEl.style.display = 'none';

  try {
    const s   = window._currentStudent || {};
    const res  = await fetch('/.netlify/functions/get-lecture-rooms', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ studentId: s.id || '' })
    });
    const data = await res.json();

    loadEl.style.display = 'none';

    if (!data.success) throw new Error(data.message || 'Failed to load lecture rooms.');

    const rooms = data.rooms || [];
    if (rooms.length === 0) {
      emptyEl.style.display = 'block';
      _lectureRoomsLoaded = true;
      return;
    }

    gridEl.innerHTML = '';
    rooms.forEach(r => gridEl.appendChild(buildLectureRoomCard(r)));
    gridEl.style.display = 'grid';
    _lectureRoomsLoaded = true;

  } catch(e) {
    loadEl.style.display = 'none';
    errEl.style.display  = 'block';
    errEl.textContent    = 'Unable to load lecture rooms: ' + e.message;
  }
}

async function loadCommsSection() {
  const loadEl  = document.getElementById('commsLoading');
  const errEl   = document.getElementById('commsError');
  const gridEl  = document.getElementById('commsGrid');
  const emptyEl = document.getElementById('commsEmpty');

  if (!loadEl) return;

  // Show loading, hide others
  loadEl.style.display  = 'flex';
  errEl.style.display   = 'none';
  gridEl.style.display  = 'none';
  emptyEl.style.display = 'none';

  try {
   const s = window._currentStudent || {};
const res = await fetch('/.netlify/functions/get-channels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentYear: s.currentStatus || '' })
});
    const data = await res.json();

    loadEl.style.display = 'none';

    if (!data.success) throw new Error(data.message || 'Failed to load channels.');

    const channels = data.channels || [];
    if (channels.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    gridEl.innerHTML = '';
    channels.forEach(ch => gridEl.appendChild(buildCommsCard(ch)));
    gridEl.style.display = 'grid';

  } catch(e) {
    loadEl.style.display  = 'none';
    errEl.style.display   = 'block';
    errEl.textContent     = 'Unable to load channels: ' + e.message;
  }
}

function doSignOut() {
  try { sessionStorage.removeItem('iris_session'); } catch(e) {}
  window._sessionToken = '';
  window._enrollments = [];
  window._currentStudent = null;
  window._docEnrollmentIndex = 0;
  window._allGrades = [];
  window._allCourses = {};
  _lectureRoomsLoaded = false;
  // Clear photo slots so they never bleed into the next login
  const idPhoto = document.getElementById('idcardPhoto');
  if (idPhoto) idPhoto.innerHTML = '';
  const avatarPhoto = document.getElementById('avatarPhoto');
  if (avatarPhoto) { avatarPhoto.src = ''; avatarPhoto.style.display = 'none'; }
  const avatarInitials = document.getElementById('avatarInitials');
  if (avatarInitials) avatarInitials.style.display = '';
  const preview = document.getElementById('profilePhotoPreview');
  if (preview) {
    preview.innerHTML = '<svg id="photoPlaceholderSvg" width="56" height="64" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="28" cy="20" rx="13" ry="14" fill="#D1D5DB"/><path d="M2 58c0-13.255 11.64-24 26-24s26 10.745 26 24" fill="#D1D5DB"/></svg>';
  }
  const homeAv = document.getElementById('homeAvatar');
  if (homeAv) homeAv.innerHTML = '';
  const gradesAv = document.getElementById('gradesAvatar');
  if (gradesAv) gradesAv.innerHTML = '';
  const removeBtn = document.getElementById('removePhotoBtn');
  if (removeBtn) removeBtn.style.display = 'none';
  document.getElementById('dashboard').classList.remove('show');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('accessError').classList.remove('show');
  document.getElementById('accessLoading').classList.remove('show');
  document.getElementById('loginStudentId').value = '';
  document.getElementById('loginPassword').value = '';
  document.body.classList.remove('dashboard-active');
  // Reset sidebar nav to home
  document.querySelectorAll('.sbnav-item').forEach(b => b.classList.remove('active'));
  const homeBtn = document.querySelector('.sbnav-item[data-section="home"]');
  if (homeBtn) homeBtn.classList.add('active');
  // Reset sidebar user card
  const sbAv = document.getElementById('sidebarAvatar'); if (sbAv) sbAv.textContent = '—';
  const sbNm = document.getElementById('sidebarName');   if (sbNm) sbNm.textContent = '—';
  const sbId = document.getElementById('sidebarId');     if (sbId) sbId.textContent = '—';
  const mobN = document.getElementById('mobMoreName');   if (mobN) mobN.textContent = '—';
  const mobI = document.getElementById('mobMoreId');     if (mobI) mobI.textContent = '—';

  // Clear hash so Back button doesn't navigate to a protected section
  _suppressHashChange = true;
  history.replaceState(null, '', location.pathname);
  setTimeout(function() { _suppressHashChange = false; }, 0);
  switchSection('home', null, true);
}

