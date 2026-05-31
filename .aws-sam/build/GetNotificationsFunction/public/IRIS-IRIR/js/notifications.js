// ── Notification System ───────────────────────────────────────
// Fetches and displays student notifications as banner strips on the home page.
// Notifications older than 2 days are automatically excluded.
// Usage: call initNotifications() after the student session is ready.

const NOTIF_TTL_DAYS = 2;
const NOTIF_POLL_MS  = 60_000; // re-check every 60 seconds
let   _notifPollTimer = null;
let   _dismissedIds   = new Set(); // track dismissed notifications in session

// ── Icon map ──────────────────────────────────────────────────
const NOTIF_ICONS = {
  grade_added:        { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`, color: '#d97706', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.25)' },
  grade_updated:      { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`, color: '#d97706', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.25)' },
  profile_updated:    { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`, color: '#16a34a', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
  enrollment_updated: { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, color: '#16a34a', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
  timetable_added:    { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`, color: '#16a34a', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
  default:            { svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, color: '#16a34a', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
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
    const res = await fetch('https://4dgx435mmk.execute-api.ap-southeast-1.amazonaws.com/get-notifications', {
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

// ── Mark a single notification as read ───────────────────────
async function markOneRead(id) {
  const sid = window._currentStudent?.id
           || document.getElementById('infoID')?.textContent?.trim();
  if (!sid || !id) return;
  try {
    await fetch('https://4dgx435mmk.execute-api.ap-southeast-1.amazonaws.com/mark-notifications-read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({ student_id: sid, ids: [id] })
    });
  } catch (err) {
    console.warn('Mark-read failed:', err);
  }
}

// ── Escape HTML ───────────────────────────────────────────────
function _escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render notification banners on home page ──────────────────
function renderNotifBanners(notifications) {
  const container = document.getElementById('notifBannersContainer');
  if (!container) return;

  const cutoff = Date.now() - NOTIF_TTL_DAYS * 86_400_000;
  const visible = notifications.filter(n =>
    !n.is_read &&
    !_dismissedIds.has(n.id) &&
    new Date(n.created_at).getTime() > cutoff
  );

  if (!visible.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = visible.map(n => {
    const icon = NOTIF_ICONS[n.type] || NOTIF_ICONS.default;
    const time = formatNotifTime(n.created_at);
    return `
      <div class="notif-bar" data-notif-id="${n.id}" style="--notif-color:${icon.color};--notif-bg:${icon.bg};--notif-border:${icon.border};">
        <div class="notif-bar-accent"></div>
        <div class="notif-bar-icon">
          ${icon.svg}
        </div>
        <div class="notif-bar-body">
          <span class="notif-bar-title">${_escHtml(n.title)}</span>
          <span class="notif-bar-msg">${_escHtml(n.message)}</span>
        </div>
        <span class="notif-bar-time">${time}</span>
        <button class="notif-dismiss-btn notif-bar-close" data-notif-id="${n.id}" aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

// ── Handle dismiss click ──────────────────────────────────────
function _setupDismissHandlers() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.notif-dismiss-btn');
    if (!btn) return;
    const id = btn.dataset.notifId;
    if (!id) return;

    // Add to dismissed set
    _dismissedIds.add(id);

    // Remove the banner strip with animation
    const strip = document.querySelector(`.notif-bar[data-notif-id="${id}"]`);
    if (strip) {
      strip.classList.add('dismissing');
      setTimeout(() => {
        strip.remove();
        const container = document.getElementById('notifBannersContainer');
        if (container && !container.querySelector('.notif-bar')) {
          container.style.display = 'none';
        }
      }, 200);
    }

    // Mark as read in DB
    markOneRead(id);
  });
}

// ── Poll for new notifications ────────────────────────────────
async function pollNotifBanners() {
  const notifications = await fetchNotifications();
  renderNotifBanners(notifications);
}

// ── Main init ─────────────────────────────────────────────────
async function initNotifications() {
  // Create banner container if it doesn't exist
  if (!document.getElementById('notifBannersContainer')) {
    const container = document.createElement('div');
    container.id = 'notifBannersContainer';
    container.style.cssText = 'display:none;margin-bottom:8px;';

    // Insert at top of home panel, before hero
    const homePanel = document.getElementById('panel-home');
    if (homePanel) {
      homePanel.insertBefore(container, homePanel.firstChild);
    }
  }

  _setupDismissHandlers();

  // Initial fetch
  const notifications = await fetchNotifications();
  renderNotifBanners(notifications);

  // Poll every minute
  clearInterval(_notifPollTimer);
  _notifPollTimer = setInterval(pollNotifBanners, NOTIF_POLL_MS);
}