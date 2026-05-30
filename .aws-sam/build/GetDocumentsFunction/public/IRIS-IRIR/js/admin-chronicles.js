// ══════════════════════════════════════
// Our Chronicles
// ══════════════════════════════════════

// ══════════════════════════════════════════
// OUR CHRONICLES
// ══════════════════════════════════════════
let chronicles = [];
let _chronicleFilter = 'all';
let _editingChronicleId = null;

async function loadChronicles() {
  const grid = document.getElementById('chronicleGrid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ink3)">Loading…</div>`;

  try {
    const { data, error } = await db
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) throw error;
    chronicles = data || [];
  } catch(e) {
    chronicles = [];
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--crimson)">Could not load chronicles: ${e.message}</div>`;
    return;
  }
  renderChronicles();
  renderDashChronicles();
  updateChroniclePendingBanner();
}

function updateChroniclePendingBanner() {
  const banner = document.getElementById('chroniclePendingBanner');
  const txt    = document.getElementById('chroniclePendingText');
  if (!banner || currentRole !== 'registrar') return;
  const pending = chronicles.filter(c => !c.is_approved && c.is_published);
  if (pending.length > 0) {
    banner.style.display = 'flex';
    txt.textContent = `${pending.length} post${pending.length !== 1 ? 's' : ''} pending approval`;
  } else {
    banner.style.display = 'none';
  }
}

function filterChronicles(type, btn) {
  _chronicleFilter = type;
  document.querySelectorAll('#chronicleTypeTabs .tab').forEach(t => t.classList.remove('active'));
  if (btn && btn.classList) btn.classList.add('active');
  renderChronicles();
}

function renderChronicles() {
  const grid = document.getElementById('chronicleGrid');
  if (!grid) return;

  let list = chronicles;
  if (_chronicleFilter === 'pending') {
    list = chronicles.filter(c => !c.is_approved && c.is_published);
  } else if (_chronicleFilter !== 'all') {
    // 'article' from SIS is treated as 'news' in the admin view
    const typeAliases = { news: ['news','article'], event: ['event'], announcement: ['announcement','notice'] };
    const validTypes  = typeAliases[_chronicleFilter] || [_chronicleFilter];
    list = chronicles.filter(c => validTypes.includes(c.type));
  }
  // Non-registrar: only show published+approved (treat null is_approved as approved for staff-created posts)
  if (currentRole !== 'registrar') {
    list = list.filter(c => c.is_published && (c.is_approved !== false));
  }

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ink3)">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.25;margin-bottom:12px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      <div>No posts yet</div>
    </div>`;
    return;
  }

  const badgeClass = { news: 'chronicle-badge-news', event: 'chronicle-badge-event', announcement: 'chronicle-badge-announcement', article: 'chronicle-badge-article' };
  const badgeLabel = { news: 'News', event: 'Event', announcement: 'Announcement', article: 'Article' };

  grid.innerHTML = list.map(c => {
    const bc   = badgeClass[c.type] || 'chronicle-badge-news';
    const bl   = badgeLabel[c.type] || c.type;
    const date = c.event_date || (c.published_at ? c.published_at.slice(0,10) : '');
    const unpublished = !c.is_published || !c.is_approved;
    const pendingTag  = (!c.is_approved && c.is_published && currentRole === 'registrar')
      ? `<span class="chronicle-badge chronicle-badge-pending">Pending</span>` : '';

    const imgHtml = c.image_url
      ? `<div class="chronicle-card-img"><img src="${c.image_url}" alt="${c.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=chronicle-card-img-placeholder><svg width=32 height=32 viewBox=\\'0 0 24 24\\' fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round><path d=\\'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\\'/><path d=\\'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\\'/></svg></div>'"></div>`
      : `<div class="chronicle-card-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>`;

    const eventStrip = (c.type === 'event' && (c.event_time || c.event_location)) ? `
      <div class="chronicle-event-strip">
        ${c.event_time ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${c.event_time}` : ''}
        ${c.event_location ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>${c.event_location}` : ''}
      </div>` : '';

    const adminActions = currentRole === 'registrar' ? `
      <div class="chronicle-card-actions">
        ${!c.is_approved ? `<button class="btn btn-sm" style="background:var(--green);color:#fff;border:none;border-radius:var(--r);padding:5px 12px;cursor:pointer;font-size:11px;font-weight:600" onclick="approveChronicle(${c.id})">Approve</button>` : '<span style="font-size:11px;color:var(--green);font-weight:600;padding:5px 2px">✓ Approved</span>'}
        <button class="btn btn-outline btn-sm" onclick="openChronicleModal(${c.id})" style="margin-left:auto">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChronicle(${c.id})"><svg style="width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>
      </div>` : '';

    return `<div class="chronicle-card${unpublished ? ' unpublished' : ''}">
      ${imgHtml}
      <div class="chronicle-card-body">
        <div class="chronicle-card-meta">
          <span class="chronicle-badge ${bc}">${bl}</span>
          ${pendingTag}
          ${date ? `<span class="chronicle-card-date">${date}</span>` : ''}
        </div>
        <div class="chronicle-card-title">${c.title}</div>
        ${c.body ? `<div class="chronicle-card-body-text">${c.body}</div>` : ''}
        ${eventStrip}
        ${c.author_name ? `<div class="chronicle-card-author">By <strong>${c.author_name}</strong></div>` : ''}
      </div>
      ${adminActions}
    </div>`;
  }).join('');
}

// Render the dashboard "Chronicles in Spring" preview strip (latest 3 approved+published)
function renderDashChronicles() {
  const grid = document.getElementById('dashChronicleGrid');
  if (!grid) return;

  const badgeClass = { news: 'chronicle-badge-news', event: 'chronicle-badge-event', announcement: 'chronicle-badge-announcement', article: 'chronicle-badge-article' };
  const badgeLabel = { news: 'News', event: 'Event', announcement: 'Announcement', article: 'Article' };

  const list = chronicles
    .filter(c => c.is_published && c.is_approved)
    .slice(0, 3);

  if (!list.length) {
    grid.innerHTML = `<div style="text-align:center;padding:32px;color:var(--ink3);font-size:13px;min-width:100%">No posts yet — <button class="btn btn-ghost btn-sm" style="color:var(--crimson)" onclick="openChronicleModal(null)">write the first one</button></div>`;
    return;
  }

  grid.innerHTML = list.map(c => {
    const bc   = badgeClass[c.type] || 'chronicle-badge-news';
    const bl   = badgeLabel[c.type] || c.type;
    const date = c.event_date || (c.published_at ? c.published_at.slice(0,10) : '');

    const imgHtml = c.image_url
      ? `<div class="chronicle-card-img"><img src="${c.image_url}" alt="${c.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=chronicle-card-img-placeholder><svg width=32 height=32 viewBox=\\'0 0 24 24\\' fill=none stroke=currentColor stroke-width=1.5 stroke-linecap=round><path d=\\'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\\'/><path d=\\'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\\'/></svg></div>'"></div>`
      : `<div class="chronicle-card-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.3"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>`;

    return `<div class="chronicle-card" style="cursor:pointer" onclick="openChronicleReader(${c.id})">
      ${imgHtml}
      <div class="chronicle-card-body">
        <div class="chronicle-card-meta">
          <span class="chronicle-badge ${bc}">${bl}</span>
          ${date ? `<span class="chronicle-card-date">${date}</span>` : ''}
        </div>
        <div class="chronicle-card-title">${c.title}</div>
        ${c.body ? `<div class="chronicle-card-body-text">${c.body}</div>` : ''}
        ${c.author_name ? `<div class="chronicle-card-author">By <strong>${c.author_name}</strong></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openChronicleReader(id) {
  const c = chronicles.find(x => x.id === id);
  if (!c) return;

  const badgeClass = { news: 'chronicle-badge-news', event: 'chronicle-badge-event', announcement: 'chronicle-badge-announcement', article: 'chronicle-badge-article' };
  const badgeLabel = { news: 'News', event: 'Event', announcement: 'Announcement', article: 'Article' };
  const bc   = badgeClass[c.type] || 'chronicle-badge-news';
  const bl   = badgeLabel[c.type] || c.type;
  const date = c.event_date || (c.published_at ? c.published_at.slice(0,10) : '');

  const imgHtml = c.image_url
    ? `<div class="chr-reader-img"><img src="${c.image_url}" alt="${c.title}" loading="lazy"></div>` : '';

  const eventInfo = (c.type === 'event' && (c.event_time || c.event_location || date)) ? `
    <div class="chr-reader-event-info">
      ${date ? `<div class="chr-reader-event-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${date}</div>` : ''}
      ${c.event_time ? `<div class="chr-reader-event-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${c.event_time}</div>` : ''}
      ${c.event_location ? `<div class="chr-reader-event-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>${c.event_location}</div>` : ''}
    </div>` : '';

  document.getElementById('chronicleReaderContent').innerHTML = `
    ${imgHtml}
    <div class="chr-reader-meta">
      <span class="chronicle-badge ${bc}">${bl}</span>
      ${date && c.type !== 'event' ? `<span class="chronicle-card-date" style="color:rgba(255,255,255,0.3);font-family:monospace;font-size:11px">${date}</span>` : ''}
    </div>
    <div class="chr-reader-title">${c.title}</div>
    ${c.author_name ? `<div class="chr-reader-author">By <strong>${c.author_name}</strong></div>` : ''}
    ${c.body ? `<div class="chr-reader-content">${c.body}</div>` : ''}
    ${eventInfo}
  `;

  const overlay = document.getElementById('chronicleReaderOverlay');
  overlay.classList.add('open');
  overlay.scrollTop = 0;
}

function closeChronicleReader() {
  document.getElementById('chronicleReaderOverlay').classList.remove('open');
}

function openChronicleModal(id) {
  _editingChronicleId = id;
  const c = id ? chronicles.find(x => x.id === id) : null;
  document.getElementById('chronicleModalTitle').textContent = id ? 'Edit Chronicle Post' : 'New Chronicle Post';
  document.getElementById('ch-type').value            = c ? (c.type || 'news') : 'news';
  document.getElementById('ch-title').value           = c ? (c.title || '') : '';
  document.getElementById('ch-body').value            = c ? (c.body || '') : '';
  document.getElementById('ch-image-url').value       = c ? (c.image_url || '') : '';
  document.getElementById('ch-event-date').value      = c ? (c.event_date || '') : '';
  document.getElementById('ch-event-time').value      = c ? (c.event_time || '') : '';
  document.getElementById('ch-event-location').value  = c ? (c.event_location || '') : '';
  document.getElementById('ch-author-name').value     = c ? (c.author_name || '') : (currentUser ? currentUser.name : '');
  document.getElementById('ch-published').checked     = c ? !!c.is_published : true;
  // Reset upload UI
  const statusEl  = document.getElementById('ch-img-upload-status');
  const previewEl = document.getElementById('ch-img-preview');
  const previewImg = document.getElementById('ch-img-preview-img');
  if (statusEl)  { statusEl.style.display = 'none'; statusEl.textContent = ''; }
  if (previewEl) { previewEl.style.display = c?.image_url ? 'block' : 'none'; }
  if (previewImg && c?.image_url) previewImg.src = c.image_url;
  document.getElementById('chronicleModalOverlay').style.display = 'flex';
}

function closeChronicleModal() {
  document.getElementById('chronicleModalOverlay').style.display = 'none';
  _editingChronicleId = null;
  // Reset file input so same file can be re-selected
  const fi = document.getElementById('ch-img-file');
  if (fi) fi.value = '';
}

async function uploadChronicleImage(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl   = document.getElementById('ch-img-upload-status');
  const previewEl  = document.getElementById('ch-img-preview');
  const previewImg = document.getElementById('ch-img-preview-img');
  const label      = document.getElementById('ch-img-upload-label');

  statusEl.style.display = 'block';
  statusEl.style.color   = 'var(--ink3)';
  statusEl.textContent   = '⏳ Uploading…';
  label.style.opacity    = '.5';
  label.style.pointerEvents = 'none';

  try {
    // Sanitise filename: strip spaces / special chars, prefix with timestamp
    const ext      = file.name.split('.').pop().toLowerCase();
    const safeName = `chronicle_${Date.now()}.${ext}`;
    const bucket   = 'announcements'; // change bucket name here if needed

    const { data, error } = await db.storage
      .from(bucket)
      .upload(`images/${safeName}`, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: urlData } = db.storage.from(bucket).getPublicUrl(`images/${safeName}`);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) throw new Error('Could not get public URL');

    document.getElementById('ch-image-url').value = publicUrl;
    statusEl.style.color = 'var(--green)';
    statusEl.textContent = '✓ Uploaded successfully';
    previewImg.src = publicUrl;
    previewEl.style.display = 'block';
  } catch(e) {
    statusEl.style.color = 'var(--crimson)';
    statusEl.textContent = '✗ Upload failed: ' + e.message;
  } finally {
    label.style.opacity = '1';
    label.style.pointerEvents = 'auto';
    input.value = ''; // allow re-upload of same file
  }
}

async function saveChronicle() {
  const title = document.getElementById('ch-title').value.trim();
  if (!title) { toast('Title is required', '⚠'); return; }

  const btn = document.getElementById('chronicleSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const isPublished = document.getElementById('ch-published').checked;
  const now = new Date().toISOString();

  const payload = {
    type:            document.getElementById('ch-type').value,
    title,
    body:            document.getElementById('ch-body').value.trim() || null,
    image_url:       document.getElementById('ch-image-url').value.trim() || null,
    event_date:      document.getElementById('ch-event-date').value || null,
    event_time:      document.getElementById('ch-event-time').value.trim() || null,
    event_location:  document.getElementById('ch-event-location').value.trim() || null,
    author_name:     document.getElementById('ch-author-name').value.trim() || null,
    is_published:    isPublished,
    published_at:    isPublished ? now : null,
    // 'staff' matches the RLS policy written for the SIS portal (not 'admin')
    author_type:     'staff',
    // Use auth UUID so RLS auth.uid() check can pass
    created_by:      currentUser ? currentUser.id : null,
    // Registrar posts auto-approved; staff posts need approval
    is_approved:     currentRole === 'registrar',
  };

  const _doSave = async (p) => {
    if (_editingChronicleId) {
      return await db.from('announcements').update(p).eq('id', _editingChronicleId);
    } else {
      return await db.from('announcements').insert(p);
    }
  };

  try {
    let { error } = await _doSave(payload);

    // Fallback 1: try without author_type (some RLS policies don't allow setting it)
    if (error && error.message && error.message.includes('row-level security')) {
      const { author_type, ...p2 } = payload;
      const res2 = await _doSave(p2);
      error = res2.error;
    }

    if (error) throw error;
    toast(_editingChronicleId ? 'Post updated ✓' : 'Post published ✓', '✓');
    closeChronicleModal();
    await loadChronicles();
  } catch(e) {
    if (e.message && e.message.includes('row-level security')) {
      toast('⚠ RLS policy is blocking this insert. Go to Setup Guide and run the Chronicles RLS fix SQL. Error: ' + e.message, '🔒');
    } else {
      toast('Error saving post: ' + e.message, '✗');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Save Post';
  }
}

async function approveChronicle(id) {
  try {
    const c = chronicles.find(x => x.id === id);
    const updates = { is_approved: true };
    // Set published_at if missing so it shows up in the feed
    if (c && !c.published_at) updates.published_at = new Date().toISOString();
    const { error } = await db.from('announcements').update(updates).eq('id', id);
    if (error) throw error;
    toast('Post approved ✓', '✓');
    await loadChronicles();
  } catch(e) {
    toast('Could not approve: ' + e.message, '✗');
  }
}

async function deleteChronicle(id) {
  const c = chronicles.find(x => x.id === id);
  if (!confirm(`Delete "${c ? c.title : 'this post'}"? This cannot be undone.`)) return;
  try {
    const { error } = await db.from('announcements').delete().eq('id', id);
    if (error) throw error;
    toast('Post deleted', '✓');
    await loadChronicles();
  } catch(e) {
    toast('Could not delete: ' + e.message, '✗');
  }
}

