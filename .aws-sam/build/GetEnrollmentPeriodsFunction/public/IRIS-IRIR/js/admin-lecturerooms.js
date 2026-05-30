// ══════════════════════════════════════
// Lecture Rooms
// ══════════════════════════════════════

// ══════════════════════════════════════════
// LECTURE ROOMS
// ══════════════════════════════════════════
let lectureRooms = [];
let _editingLectureRoomId = null;

async function loadLectureRooms() {
  const { data, error } = await db.from('lecture_rooms').select('*').order('subject');
  if (error) { toast('Failed to load lecture rooms: ' + error.message, '\u26a0'); return; }
  lectureRooms = data || [];
  renderLectureRoomsTable();
  populateLectureRoomPrograms();
}

function populateLectureRoomPrograms() {
  const pf = document.getElementById('lectureRoomProgramFilter');
  if (!pf) return;
  const saved = pf.value;
  pf.innerHTML = '<option value="">All Programs</option><option value="All">All</option>' +
    degreePrograms.filter(function(p){ return p.status === 'Active'; }).map(function(p){
      return '<option value="' + p.id + '">' + p.id + ' \u2014 ' + p.name + '</option>';
    }).join('');
  if (saved) pf.value = saved;
  const lrProg = document.getElementById('lr-program');
  if (lrProg) {
    const lrSaved = lrProg.value;
    lrProg.innerHTML = '<option value="All">All Programs</option>' +
      degreePrograms.filter(function(p){ return p.status === 'Active'; }).map(function(p){
        return '<option value="' + p.id + '">' + p.id + ' \u2014 ' + p.name + '</option>';
      }).join('');
    if (lrSaved) lrProg.value = lrSaved;
  }
}

function renderLectureRoomsTable(data) {
  const rows = data || lectureRooms;
  const tb = document.getElementById('lectureRoomsTableBody');
  if (!tb) return;
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--ink3)">No lecture rooms found. Add one with the button above.</td></tr>';
    return;
  }
  tb.innerHTML = rows.map(function(r) {
    const statusBadge = r.is_active ? '<span class="badge b-green">Active</span>' : '<span class="badge b-muted">Inactive</span>';
    const zoomLinkEl = r.zoom_link
      ? '<a href="' + r.zoom_link + '" target="_blank" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px;color:var(--blue)">Join Zoom \u2197</a>'
      : '\u2014';
    let yearDisplay = r.year_access || '\u2014';
    if (Array.isArray(yearDisplay)) yearDisplay = yearDisplay.join(', ');
    else { try { const p = JSON.parse(yearDisplay); if (Array.isArray(p)) yearDisplay = p.join(', '); } catch(e) {} }
    const progBadge = r.program === 'All'
      ? '<span class="badge b-blue">All</span>'
      : '<span class="badge b-muted">' + (r.program || '\u2014') + '</span>';
    return '<tr>' +
      '<td><strong>' + r.subject + '</strong></td>' +
      '<td style="max-width:180px;white-space:normal;font-size:12px;color:var(--ink2)">' + (r.description || '\u2014') + '</td>' +
      '<td>' + zoomLinkEl + '</td>' +
      '<td class="text-mono" style="font-size:12px">' + (r.zoom_meeting_id || '\u2014') + '</td>' +
      '<td class="text-mono" style="font-size:12px">' + (r.zoom_passcode || '\u2014') + '</td>' +
      '<td style="font-size:12px">' + yearDisplay + '</td>' +
      '<td>' + progBadge + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td class="flex gap-2">' +
        '<button class="btn btn-outline btn-sm" onclick="openLectureRoomModal(\'' + r.id + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="confirmDeleteLectureRoom(\'' + r.id + '\',\'' + (r.subject||'').replace(/'/g,"\\'") + '\')"><svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-trash"></use></svg></button>' +
      '</td></tr>';
  }).join('');
}

function filterLectureRooms(q) {
  const program = document.getElementById('lectureRoomProgramFilter').value;
  const status  = document.getElementById('lectureRoomStatusFilter').value;
  const query   = (q || '').toLowerCase();
  const filtered = lectureRooms.filter(function(r) {
    const matchQ = !query   || (r.subject + (r.description||'')).toLowerCase().includes(query);
    const matchP = !program || r.program === program;
    const matchS = status === '' ? true : String(r.is_active) === status;
    return matchQ && matchP && matchS;
  });
  renderLectureRoomsTable(filtered);
}

function openLectureRoomModal(rid) {
  _editingLectureRoomId = rid || null;
  const r = rid ? lectureRooms.find(function(x){ return x.id === rid; }) : null;
  document.getElementById('lectureRoomModalTitle').textContent = r ? 'Edit Lecture Room \u2014 ' + r.subject : 'Add Lecture Room';
  document.getElementById('lr-subject').value          = r ? r.subject : '';
  document.getElementById('lr-description').value      = r ? (r.description || '') : '';
  document.getElementById('lr-zoom-link').value        = r ? (r.zoom_link || '') : '';
  document.getElementById('lr-zoom-meeting-id').value  = r ? (r.zoom_meeting_id || '') : '';
  document.getElementById('lr-zoom-passcode').value    = r ? (r.zoom_passcode || '') : '';
  let yearDisplay = r ? (r.year_access || '') : '';
  if (Array.isArray(yearDisplay)) yearDisplay = yearDisplay.join(', ');
  else { try { const p = JSON.parse(yearDisplay); if (Array.isArray(p)) yearDisplay = p.join(', '); } catch(e) {} }
  document.getElementById('lr-year-access').value      = yearDisplay;
  populateLectureRoomPrograms();
  document.getElementById('lr-program').value          = r ? (r.program || 'All') : 'All';
  document.getElementById('lr-status').value           = r ? String(r.is_active) : 'true';
  document.getElementById('lectureRoomModal').classList.add('open');
}

async function saveLectureRoom() {
  const subject = document.getElementById('lr-subject').value.trim();
  if (!subject) { toast('Subject / Room Name is required.', '\u26a0'); return; }
  const yearRaw = document.getElementById('lr-year-access').value.trim();
  let yearAccess;
  if (!yearRaw || yearRaw.toUpperCase() === 'ALL') {
    yearAccess = ['ALL'];
  } else {
    yearAccess = yearRaw.split(',').map(function(y){ return y.trim(); }).filter(Boolean);
  }
  const record = {
    subject: subject,
    description:     document.getElementById('lr-description').value.trim() || null,
    zoom_link:       document.getElementById('lr-zoom-link').value.trim() || null,
    zoom_meeting_id: document.getElementById('lr-zoom-meeting-id').value.trim() || null,
    zoom_passcode:   document.getElementById('lr-zoom-passcode').value.trim() || null,
    year_access:     yearAccess,
    program:         document.getElementById('lr-program').value || 'All',
    is_active:       document.getElementById('lr-status').value === 'true',
    updated_at:      new Date().toISOString()
  };
  if (_editingLectureRoomId) {
    const { error } = await db.from('lecture_rooms').update(record).eq('id', _editingLectureRoomId);
    if (error) { toast('Update failed: ' + error.message, '\u274c'); return; }
    const idx = lectureRooms.findIndex(function(x){ return x.id === _editingLectureRoomId; });
    if (idx >= 0) lectureRooms[idx] = Object.assign({}, lectureRooms[idx], record);
    toast('Lecture room updated.', '\u2713');
  } else {
    const { data, error } = await db.from('lecture_rooms').insert(record).select().single();
    if (error) { toast('Insert failed: ' + error.message, '\u274c'); return; }
    lectureRooms.push(data || Object.assign({ id: 'new-' + Date.now() }, record));
    toast('Lecture room added.', '\u2713');
  }
  closeModal('lectureRoomModal');
  renderLectureRoomsTable();
}

function confirmDeleteLectureRoom(rid, rname) {
  document.getElementById('confirmDeleteTitle').textContent = 'Delete Lecture Room';
  document.getElementById('confirmDeleteMsg').innerHTML =
    'Are you sure you want to permanently delete lecture room <strong>' + rname + '</strong>? This cannot be undone.';
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const { error } = await db.from('lecture_rooms').delete().eq('id', rid);
    if (error) { toast('Delete failed: ' + error.message, '\u274c'); return; }
    lectureRooms = lectureRooms.filter(function(x){ return x.id !== rid; });
    renderLectureRoomsTable();
    toast('Lecture room "' + rname + '" deleted.', '\uD83D\uDDD1');
    closeModal('confirmDeleteModal');
  };
  document.getElementById('confirmDeleteModal').classList.add('open');
}

