// js/qr.js
// Fetches a signed QR token from the server and renders it on the ID card.
// Called from populate.js after student data is loaded.

/**
 * Generates a secure QR code on the ID card back.
 * @param {object} student  - Normalised student object from auth.js
 * @param {string} validThrough - e.g. "2027"
 */
async function generateIDCardQR(student, validThrough) {
  const container = document.getElementById('idcardQR');
  if (!container) return;

  // Clear any previous QR
  container.innerHTML = '';

  try {
    // ── Request a signed token from the server ──
    const res = await fetch('/.netlify/functions/generate-qr-token', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({
        studentId   : student.id,
        studentName : student.fullName,
        program     : student.programName || student.program,
        validThrough: validThrough || '—'
      })
    });

    if (!res.ok) throw new Error('Server error: ' + res.status);

    const data = await res.json();
    if (!data.verifyUrl) throw new Error('No verify URL returned');

    // ── Cache the signed URL so printIDCard() uses it instead of the fallback ──
    window._idcardVerifyUrl = data.verifyUrl;

    // ── Render the QR code using qrcodejs ──
    new QRCode(container, {
      text        : data.verifyUrl,
      width       : 200,   // ← FIX: increased from 80 (too small to scan)
      height      : 200,   // ← FIX: increased from 80 (too small to scan)
      colorDark   : '#000000',
      colorLight  : '#ffffff',
      correctLevel: QRCode.CorrectLevel.M  // ← FIX: M is better than H for long URLs at this size
    });

  } catch (e) {
    console.error('QR generation failed:', e);
    // Show a subtle fallback — don't expose error details
    container.innerHTML = '<div style="width:200px;height:200px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center">QR<br>unavailable</div>';
  }
}

/**
 * Generates a QR code for a specific document (transcript, letter, etc.)
 * Uses a shorter expiry than the ID card.
 * @param {string} containerId - DOM element ID to render into
 * @param {object} student
 * @param {string} docType - e.g. "transcript", "enrollment_letter"
 */
async function generateDocumentQR(containerId, student, docType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch('/.netlify/functions/generate-qr-token', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': 'Bearer ' + (window._sessionToken || '')
      },
      body: JSON.stringify({
        studentId   : student.id,
        studentName : student.fullName,
        program     : student.programName || student.program,
        validThrough: '30 days',
        type        : docType
      })
    });

    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    if (!data.verifyUrl) throw new Error('No URL');

    new QRCode(container, {
      text        : data.verifyUrl,
      width       : 200,   // ← FIX: increased from 100
      height      : 200,   // ← FIX: increased from 100
      colorDark   : '#000000',
      colorLight  : '#ffffff',
      correctLevel: QRCode.CorrectLevel.M  // ← FIX: M instead of H
    });
  } catch (e) {
    console.error('Document QR generation failed:', e);
    container.innerHTML = '<div style="width:200px;height:200px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999">QR unavailable</div>';
  }
}