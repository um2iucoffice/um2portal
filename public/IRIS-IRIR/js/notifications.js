// ── Notification System ───────────────────────────────────────
// Fetches, displays, and manages student notifications via Netlify functions.
// Notifications older than 2 days are automatically excluded.
// Usage: call initNotifications() after the student session is ready.

const NOTIF_TTL_DAYS  = 2;
const NOTIF_POLL_MS   = 60_000; // re-check every 60 seconds
let   _notifPollTimer = null;
let   _notifOpen      = false;

// ── Icon map ──────────────────────────────────────────────────
const NOTIF_ICONS = {
  grade_added:         { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, color: '#2563eb' },
  grade_updated:       { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, color: '#7c3aed' },
  profile_updated:     { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`, color: '#0891b2' },
  enrollment_updated:  { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, color: '#059669' },
  timetable_added:     { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`, color: '#d97706' },
  default:             { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, color: '#6b7280' },
};

// ── Time formatting ───────────────────────────────────────────
function formatNotifTime(isoString) {
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Fetch notifications via Netlify function ──────────────────
async function fetchNotifications() {
  const sid = window._currentStudent?.id
           || document.getElementById('infoID')?.textContent?.trim();
  if (!sid) return [];

  try {
    const res = await fetch('/.netlify/functions/get-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({ student_id: sid })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.notifications || [];
  } catch (err) {
    console.warn('Notifications fetch failed:', err);
    return [];
  }
}

// ── Mark all visible notifications as read ────────────────────
async function markAllRead(notifications) {
  const sid = window._currentStudent?.id
           || document.getElementById('infoID')?.textContent?.trim();
  if (!sid) return;

  const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
  if (!unreadIds.length) return;

  try {
    await fetch('/.netlify/functions/mark-notifications-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({ student_id: sid, ids: unreadIds })
    });
  } catch (err) {
    console.warn('Mark-read failed:', err);
  }
}

// ── Render the dropdown panel ─────────────────────────────────
function renderNotifPanel(notifications) {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;

  if (!notifications.length) {
    panel.innerHTML = `
      <div style="padding:32px 20px;text-align:center;color:var(--ink3,#888);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             style="width:36px;height:36px;margin:0 auto 10px;display:block;opacity:.4">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <div style="font-size:13px;font-weight:500">No recent notifications</div>
        <div style="font-size:12px;margin-top:4px;opacity:.7">Updates to your profile or grades will appear here</div>
      </div>`;
    return;
  }

  panel.innerHTML = notifications.map(n => {
    const icon    = NOTIF_ICONS[n.type] || NOTIF_ICONS.default;
    const unread  = !n.is_read;
    const timeStr = formatNotifTime(n.created_at);

    return `
      <div class="notif-item${unread ? ' notif-unread' : ''}" data-id="${n.id}">
        <div class="notif-icon-wrap" style="background:${icon.color}18;color:${icon.color}">
          ${icon.svg}
        </div>
        <div class="notif-body">
          <div class="notif-title">${escapeHtml(n.title)}</div>
          <div class="notif-msg">${escapeHtml(n.message)}</div>
          <div class="notif-time">${timeStr}</div>
        </div>
        ${unread ? '<div class="notif-dot"></div>' : ''}
      </div>`;
  }).join('');
}

// ── Update the bell badge ─────────────────────────────────────
function updateNotifBadge(notifications) {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const cutoff  = Date.now() - NOTIF_TTL_DAYS * 86_400_000;
  const unread  = notifications.filter(n =>
    !n.is_read && new Date(n.created_at).getTime() > cutoff
  ).length;

  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── Toggle panel open/close ───────────────────────────────────
async function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const bell  = document.getElementById('notifBell');
  if (!panel || !bell) return;

  _notifOpen = !_notifOpen;
  panel.classList.toggle('notif-panel-open', _notifOpen);
  bell.classList.toggle('notif-bell-active', _notifOpen);

  if (_notifOpen) {
    const notifications = await fetchNotifications();
    renderNotifPanel(notifications);
    updateNotifBadge(notifications);
    // Mark as read after a short delay (gives user time to see the badge)
    setTimeout(() => markAllRead(notifications), 1500);
  }
}

// ── Close panel when clicking outside ────────────────────────
function setupNotifOutsideClick() {
  document.addEventListener('click', (e) => {
    if (!_notifOpen) return;
    const container = document.getElementById('notifContainer');
    if (container && !container.contains(e.target)) {
      _notifOpen = false;
      document.getElementById('notifPanel')?.classList.remove('notif-panel-open');
      document.getElementById('notifBell')?.classList.remove('notif-bell-active');
    }
  });
}

// ── Poll for new notifications in the background ──────────────
async function pollNotifications() {
  if (_notifOpen) return; // don't overwrite open panel
  const notifications = await fetchNotifications();
  updateNotifBadge(notifications);
}

// ── Inject styles ─────────────────────────────────────────────
function injectNotifStyles() {
  if (document.getElementById('notif-styles')) return;
  const style = document.createElement('style');
  style.id = 'notif-styles';
  style.textContent = `
    #notifContainer {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    #notifBell {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ink2, #555);
      transition: background 0.15s, color 0.15s;
    }
    #notifBell:hover,
    #notifBell.notif-bell-active {
      background: var(--surface2, #f3f4f6);
      color: var(--ink1, #1a1a1a);
    }
    #notifBell svg {
      width: 20px;
      height: 20px;
      pointer-events: none;
    }
    #notifBadge {
      position: absolute;
      top: 3px;
      right: 3px;
      min-width: 17px;
      height: 17px;
      border-radius: 9px;
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      font-family: 'DM Sans', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid var(--surface1, #fff);
      pointer-events: none;
      animation: notif-pop 0.2s ease;
    }
    @keyframes notif-pop {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    #notifPanel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 340px;
      max-height: 480px;
      overflow-y: auto;
      background: var(--surface1, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.13);
      z-index: 999;
      display: none;
      flex-direction: column;
    }
    #notifPanel.notif-panel-open {
      display: flex;
    }
    #notifPanel::before {
      content: 'Notifications';
      display: block;
      padding: 14px 16px 12px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .4px;
      text-transform: uppercase;
      color: var(--ink3, #888);
      border-bottom: 1px solid var(--border, #e5e7eb);
      position: sticky;
      top: 0;
      background: var(--surface1, #fff);
      z-index: 1;
      flex-shrink: 0;
    }
    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #f0f0f0);
      transition: background 0.1s;
      position: relative;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: var(--surface2, #f9fafb); }
    .notif-unread { background: var(--blue-light, #eff6ff); }
    .notif-unread:hover { background: #dbeafe; }
    .notif-icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .notif-icon-wrap svg { width: 16px; height: 16px; stroke: currentColor; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-title { font-size: 13px; font-weight: 600; color: var(--ink1, #1a1a1a); line-height: 1.3; }
    .notif-msg { font-size: 12px; color: var(--ink2, #555); margin-top: 2px; line-height: 1.45; }
    .notif-time { font-size: 11px; color: var(--ink3, #888); margin-top: 4px; }
    .notif-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2563eb;
      flex-shrink: 0;
      margin-top: 6px;
    }
    #notifPanel::-webkit-scrollbar       { width: 4px; }
    #notifPanel::-webkit-scrollbar-track { background: transparent; }
    #notifPanel::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
    @media (max-width: 400px) {
      #notifPanel { width: calc(100vw - 24px); right: -8px; }
    }
  `;
  document.head.appendChild(style);
}

// ── Build the bell HTML ───────────────────────────────────────
function buildNotifBell() {
  const container = document.createElement('div');
  container.id = 'notifContainer';
  container.innerHTML = `
    <button id="notifBell" aria-label="Notifications">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span id="notifBadge" style="display:none"></span>
    </button>
    <div id="notifPanel" role="menu" aria-label="Notifications"></div>
  `;
  return container;
}

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main init — call this once the student session is ready ───
async function initNotifications(mountSelector = '#notifMount') {
  injectNotifStyles();

  let mount = document.querySelector(mountSelector);
  if (!mount) {
    const fallback = document.querySelector('.header-actions, .nav-right, .topbar-right, header');
    if (!fallback) {
      console.warn('initNotifications: no mount point found.');
      return;
    }
    mount = document.createElement('div');
    mount.id = 'notifMount';
    fallback.prepend(mount);
  }

  // Avoid duplicating the bell if already mounted
  if (document.getElementById('notifBell')) return;

  mount.appendChild(buildNotifBell());
  document.getElementById('notifBell').addEventListener('click', toggleNotifPanel);
  setupNotifOutsideClick();

  // Initial badge count
  const initial = await fetchNotifications();
  updateNotifBadge(initial);

  // Poll every minute
  clearInterval(_notifPollTimer);
  _notifPollTimer = setInterval(pollNotifications, NOTIF_POLL_MS);
}

// ── Manual trigger: push a notification from JS ───────────────
async function createNotification(studentId, type, title, message, metadata = {}) {
  try {
    const res = await fetch('/.netlify/functions/create-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({ student_id: studentId, type, title, message, metadata })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('createNotification failed:', err);
  }
}