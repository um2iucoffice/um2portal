const params   = new URLSearchParams(window.location.search);
const token    = params.get('t');
const legacyId = params.get('id');

if (token) {
  fetch('/.netlify/functions/verify-qr?t=' + encodeURIComponent(token))
    .then(r => r.json())
    .then(data => {
      if (data.valid) {
        showValid(data);
      } else {
        showInvalid(data.error || 'Invalid or expired QR code.');
      }
    })
    .catch(() => {
      showInvalid('Could not connect to verification server. Please try again.');
    });

} else if (legacyId) {
  showLegacy(legacyId);

} else {
  showInvalid('No verification token found in this URL.');
}

function showValid(data) {
  document.getElementById('stateLoading').style.display = 'none';
  document.getElementById('stateValid').style.display   = '';
  document.getElementById('vName').textContent    = data.name         || '—';
  document.getElementById('vId').textContent      = 'ID: ' + (data.studentId || '—');
  document.getElementById('vProgram').textContent = data.program      || '—';
  document.getElementById('vValid').textContent   = data.validThrough || '—';
  document.getElementById('vIssued').textContent  = data.issuedAt
    ? new Date(data.issuedAt).toLocaleString() : '—';
  const typeMap = {
    idcard: 'Student ID Card',
    transcript: 'Academic Transcript',
    confirmation_of_study: 'Confirmation of Study',
    degree_certificate: 'Degree Certificate'
  };
  document.getElementById('vType').textContent =
    typeMap[data.type] || data.type || 'Official Document';
  document.getElementById('vTime').textContent = new Date().toLocaleString();
}

function showLegacy(id) {
  document.getElementById('stateLoading').style.display = 'none';
  document.getElementById('stateLegacy').style.display  = '';
  document.getElementById('vLegacyId').textContent      = 'ID: ' + id;
  document.getElementById('vLegacyTime').textContent    = new Date().toLocaleString();
}

function showInvalid(msg) {
  document.getElementById('stateLoading').style.display = 'none';
  document.getElementById('stateInvalid').style.display = '';
  document.getElementById('vError').textContent = msg;
}