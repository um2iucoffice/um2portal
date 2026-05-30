// ══════════════════════════════════════
// Channels
// ══════════════════════════════════════

// ══════════════════════════════════════════
// CHANNELS
// ══════════════════════════════════════════
let channels = [];
let _editingChannelId = null;

const PLATFORM_BADGE = {
  whatsapp: '<span class="badge" style="background:#dcf8c6;color:#128c7e">WhatsApp</span>',
  telegram: '<span class="badge" style="background:#e3f2fd;color:#0088cc">Telegram</span>',
  discord:  '<span class="badge" style="background:#ede7f6;color:#5865f2">Discord</span>',
  other:    '<span class="badge b-muted">Other</span>'
};

async function loadChannels() {
  const { data, error } = await db.from('channels').select('*').order('sort_order');
  if (error) { toast('Failed to load channels: ' + error.message, '\u26a0'); return; }
  channels = data || [];
  renderChannelsTable();
}

function renderChannelsTable(data) {
  const rows = data || channels;
  const tb = document.getElementById('channelsTableBody');
  if (!tb) return;
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--ink3)">No channels found. Add one with the button above.</td></tr>';
    return;
  }
  tb.innerHTML = rows.map(function(c) {
    const plat = PLATFORM_BADGE[c.platform] || PLATFORM_BADGE.other;
    const statusBadge = c.is_active ? '<span class="badge b-green">Active</span>' : '<span class="badge b-muted">Inactive</span>';
    const channelLinkEl = c.channel_link ? '<a href="' + c.channel_link + '" target="_blank" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px">Open \u2197</a>' : '\u2014';
    const gpLinkEl = c.gp_link ? '<a href="' + c.gp_link + '" target="_blank" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px">Join \u2197</a>' : '\u2014';
    const allowedYears = c.allowed_years ? '<span style="font-size:11px;color:var(--ink2)">' + c.allowed_years + '</span>' : '<span class="badge b-blue" style="font-size:10px">All Years</span>';
    return '<tr>' +
      '<td><strong>' + c.name + '</strong></td>' +
      '<td>' + plat + '</td>' +
      '<td style="max-width:200px;white-space:normal;font-size:12px;color:var(--ink2)">' + (c.description || '\u2014') + '</td>' +
      '<td style="text-align:center">' + (c.members != null ? c.members : '\u2014') + '</td>' +
      '<td>' + channelLinkEl + '</td>' +
      '<td>' + gpLinkEl + '</td>' +
      '<td>' + allowedYears + '</td>' +
      '<td style="text-align:center">' + (c.sort_order != null ? c.sort_order : '\u2014') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td class="flex gap-2">' +
        '<button class="btn btn-outline btn-sm" onclick="openChannelModal(\'' + c.id + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="confirmDeleteChannel(\'' + c.id + '\',\'' + (c.name||'').replace(/'/g,"\\'") + '\')"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>' +
      '</td></tr>';
  }).join('');
}

function filterChannels(q) {
  const platform = document.getElementById('channelPlatformFilter').value;
  const status   = document.getElementById('channelStatusFilter').value;
  const query    = (q || '').toLowerCase();
  const filtered = channels.filter(function(c) {
    const matchQ = !query    || (c.name + (c.description||'')).toLowerCase().includes(query);
    const matchP = !platform || c.platform === platform;
    const matchS = status === '' ? true : String(c.is_active) === status;
    return matchQ && matchP && matchS;
  });
  renderChannelsTable(filtered);
}

function openChannelModal(cid) {
  _editingChannelId = cid || null;
  const c = cid ? channels.find(function(x){ return x.id === cid; }) : null;
  document.getElementById('channelModalTitle').textContent = c ? 'Edit Channel \u2014 ' + c.name : 'Add Channel';
  document.getElementById('ch-name').value          = c ? c.name : '';
  document.getElementById('ch-platform').value      = c ? (c.platform || 'whatsapp') : 'whatsapp';
  document.getElementById('ch-description').value   = c ? (c.description || '') : '';
  document.getElementById('ch-link').value          = c ? (c.channel_link || '') : '';
  document.getElementById('ch-gp-link').value       = c ? (c.gp_link || '') : '';
  document.getElementById('ch-members').value       = c ? (c.members != null ? c.members : '') : '';
  document.getElementById('ch-sort-order').value    = c ? (c.sort_order != null ? c.sort_order : '') : (channels.length + 1);
  document.getElementById('ch-allowed-years').value = c ? (c.allowed_years || '') : '';
  document.getElementById('ch-status').value        = c ? String(c.is_active) : 'true';
  document.getElementById('channelModal').classList.add('open');
}

async function saveChannel() {
  const name = document.getElementById('ch-name').value.trim();
  if (!name) { toast('Channel name is required.', '\u26a0'); return; }
  const record = {
    name: name,
    platform:      document.getElementById('ch-platform').value,
    description:   document.getElementById('ch-description').value.trim() || null,
    channel_link:  document.getElementById('ch-link').value.trim() || null,
    gp_link:       document.getElementById('ch-gp-link').value.trim() || null,
    members:       parseInt(document.getElementById('ch-members').value) || null,
    sort_order:    parseInt(document.getElementById('ch-sort-order').value) || null,
    allowed_years: (function(){
      const raw = document.getElementById('ch-allowed-years').value.trim();
      if (!raw) return null;
      return raw.split(',').map(function(y){ return y.trim(); }).filter(Boolean);
    })(),
    is_active:     document.getElementById('ch-status').value === 'true',
    updated_at:    new Date().toISOString()
  };
  if (_editingChannelId) {
    const { error } = await db.from('channels').update(record).eq('id', _editingChannelId);
    if (error) { toast('Update failed: ' + error.message, '\u274c'); return; }
    const idx = channels.findIndex(function(x){ return x.id === _editingChannelId; });
    if (idx >= 0) channels[idx] = Object.assign({}, channels[idx], record);
    toast('Channel updated.', '\u2713');
  } else {
    const { data, error } = await db.from('channels').insert(record).select().single();
    if (error) { toast('Insert failed: ' + error.message, '\u274c'); return; }
    channels.push(data || Object.assign({ id: 'new-' + Date.now() }, record));
    toast('Channel added.', '\u2713');
  }
  closeModal('channelModal');
  renderChannelsTable();
}

function confirmDeleteChannel(cid, cname) {
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Channel';
  document.getElementById('confirmDeleteMsg').innerHTML =
    'Are you sure you want to permanently delete the channel <strong>' + cname + '</strong>? This cannot be undone.';
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('channels').delete().eq('id', cid);
    if (error) { toast('Delete failed: ' + error.message, '\u274c'); return; }
    channels = channels.filter(function(x){ return x.id !== cid; });
    renderChannelsTable();
    toast('Channel "' + cname + '" deleted.', '\uD83D\uDDD1');
    closeModal('confirmDeleteModal');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

