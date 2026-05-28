// ── ui-events.js ─────────────────────────────────────────────
// Replaces all inline onclick/onchange/onmouseenter handlers removed
// from index.html as part of the CSP unsafe-inline fix.
// All handlers use event delegation from document or specific containers.

document.addEventListener('DOMContentLoaded', function () {

  // ── 1. Sidebar nav items (data-section, .sbnav-item) ─────────
  var sbNav = document.querySelector('.sb-nav');
  if (sbNav) {
    sbNav.addEventListener('click', function (e) {
      var btn = e.target.closest('.sbnav-item[data-section]');
      if (!btn) return;
      switchSection(btn.dataset.section, btn);
    });
  }

  // ── 2. Sidebar toggle & overlay ──────────────────────────────
  var sbToggle = document.getElementById('sbToggle');
  if (sbToggle) sbToggle.addEventListener('click', toggleSidebar);

  var sbOverlay = document.getElementById('sbOverlay');
  if (sbOverlay) sbOverlay.addEventListener('click', closeSidebar);

  // ── 3. Sidebar sign-out & theme toggle ───────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var action = t.dataset.action;

    switch (action) {

      // ── Sidebar / topbar ──────────────────────────────────────
      case 'signout':
        doSignOut();
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'toggle-sidebar':
        toggleSidebar();
        break;
      case 'close-sidebar':
        closeSidebar();
        break;
      case 'print-idcard':
        printIDCard();
        break;

      // ── Mobile tab bar ────────────────────────────────────────
      case 'mob-tab':
        mobSwitchTab(t.dataset.section, t);
        break;
      case 'mob-go-apps':
        mobGoApps(t);
        break;
      case 'toggle-mob-more':
        toggleMobMore(t);
        break;

      // ── Mobile more menu items ────────────────────────────────
      case 'mob-more-nav':
        mobSwitchTab(t.dataset.section, null);
        closeMobMore();
        break;
      case 'mob-more-ext':
        window.open(t.dataset.href, '_blank', 'noopener');
        closeMobMore();
        break;
      case 'mob-more-theme':
        toggleTheme();
        closeMobMore();
        break;
      case 'mob-more-signout':
        doSignOut();
        closeMobMore();
        break;

      // ── App dashboard tiles ───────────────────────────────────
      case 'switch-tab':
        switchTab(t.dataset.section);
        break;
      case 'ext-link':
        window.open(t.dataset.href, '_blank', 'noopener');
        break;

      // ── Document Office / Edit Info ───────────────────────────
      case 'submit-edit-info':
        submitInfoEditRequest();
        break;

      // ── Photo ─────────────────────────────────────────────────
      case 'remove-photo':
        removePhoto();
        break;
      case 'open-photo-input':
        var fi = document.getElementById('photoFileInput');
        if (fi) fi.click();
        break;
      case 'clear-photo-selection':
        clearPhotoSelection();
        break;
      case 'upload-photo':
        uploadPhoto();
        break;

      // ── Chronicles post submission ────────────────────────────
      case 'submit-post':
        submitPost();
        break;
    }
  });

  // ── 4. Mobile more overlay (click-outside to close) ──────────
  var mobOverlay = document.getElementById('mobMoreOverlay');
  if (mobOverlay) mobOverlay.addEventListener('click', closeMobMore);

  // ── 5. Timetable filter pills (data-day, .tt-filter-pill) ────
  var ttFilterBar = document.getElementById('ttFilterBar');
  if (ttFilterBar) {
    ttFilterBar.addEventListener('click', function (e) {
      var pill = e.target.closest('.tt-filter-pill[data-day]');
      if (!pill) return;
      ttFilterDay(pill.dataset.day, pill);
    });
  }

  // ── 6. Chronicles post type tabs (.chr-type-tab with IDs) ────
  var chrTypeTabs = document.querySelector('.chr-type-tabs');
  if (chrTypeTabs) {
    var typeMap = {
      postTypeNews:         'news',
      postTypeAnnouncement: 'announcement',
      postTypeNotice:       'notice',
      postTypeEvent:        'event',
      postTypeNewsitem:     'newsitem'
    };
    chrTypeTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button[id]');
      if (!btn) return;
      var type = typeMap[btn.id];
      if (type) setPostType(type);
    });
  }

  // ── 7. Submit post button ─────────────────────────────────────
  var submitPostBtn = document.getElementById('submitPostBtn');
  if (submitPostBtn) submitPostBtn.addEventListener('click', submitPost);

  // ── 8. postImageFile onchange ─────────────────────────────────
  var postImageFile = document.getElementById('postImageFile');
  if (postImageFile) {
    postImageFile.addEventListener('change', function () {
      var f    = this.files[0];
      var lbl  = document.getElementById('postImageLabel');
      var prev = document.getElementById('postImagePreview');
      if (f) {
        if (lbl) lbl.textContent = f.name;
        var r = new FileReader();
        r.onload = function (e) {
          if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
        };
        r.readAsDataURL(f);
      } else {
        if (lbl)  lbl.textContent = 'Upload a photo (optional)';
        if (prev) prev.style.display = 'none';
      }
    });
  }

  // ── 8b. photoFileInput onchange (profile photo panel) ────────
  var photoFileInput = document.getElementById('photoFileInput');
  if (photoFileInput) {
    photoFileInput.addEventListener('change', function () {
      if (typeof previewPhoto === 'function') previewPhoto(this);
    });
  }

  // ── 9. Login theme pill buttons ───────────────────────────────
  var loginThemePill = document.getElementById('loginThemePill');
  if (loginThemePill) {
    loginThemePill.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-theme-apply]');
      if (!btn) return;
      // applyTheme() is expected to exist in ui-controls.js
      if (typeof applyTheme === 'function') applyTheme(btn.dataset.themeApply);
    });
  }

  // ── 10. Chronicles news-card delegation (renderNews injects these) ──
  // renderNews() in chronicles.js sets window.openNewsDetail and
  // injects cards with data-newsidx. We delegate from the container
  // so CSP-blocked inline onclick is never needed.
  function delegateNewsClicks(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', function (e) {
      var card = e.target.closest('[data-newsidx]');
      if (!card) return;
      if (window._newsItems && window.openNewsDetail) {
        window.openNewsDetail(window._newsItems[card.dataset.newsidx]);
      }
    });
  }
  delegateNewsClicks('newsContent');
  delegateNewsClicks('homeNewsCards');
  delegateNewsClicks('mobHomeNewsCards');

});