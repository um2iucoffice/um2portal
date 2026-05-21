// netlify/functions/approve-photo.js
//
// Called by the Registrar UI when a photo edit request is approved.
// Workflow:
//   1. Fetch the pending photo from its URL (stored in student_edit_requests.photo_url)
//   2. Draw a repeating diagonal "UM2UM2UM2UM2UM2" watermark using Canvas
//   3. Upload the watermarked JPEG to Supabase Storage (student-photos bucket, permanent path)
//   4. Return { success: true, photoUrl: "<full public URL>" }
//
// Runtime: Node.js 18+  (Netlify Functions v2 / AWS Lambda)
// Dependencies: @supabase/supabase-js, canvas
//   npm install @supabase/supabase-js canvas
//
// Environment variables required (set in Netlify UI → Site settings → Environment):
//   SUPABASE_URL          — your Supabase project URL
//   SUPABASE_SERVICE_KEY  — service_role key (NOT the anon key — needs storage write access)

const { createClient } = require('@supabase/supabase-js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// ── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

// Watermark text — repeating pattern across the photo
const WM_TEXT      = 'UM2UM2UM2UM2UM2';
const WM_FONT_SIZE = 18;          // px  — adjust to taste
const WM_COLOR     = 'rgba(255, 255, 255, 0.30)'; // semi-transparent white
const WM_ANGLE     = -30;         // degrees — diagonal tilt
const WM_SPACING_X = 140;        // horizontal gap between repetitions
const WM_SPACING_Y = 60;         // vertical gap between rows

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  // CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, { success: false, message: 'Server mis-configuration: missing Supabase env vars' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, message: 'Invalid JSON body' });
  }

  const { studentId, pendingUrl } = body;
  if (!studentId || !pendingUrl) {
    return json(400, { success: false, message: 'studentId and pendingUrl are required' });
  }

  try {
    // ── 1. Fetch the pending photo ─────────────────────────────────────────
    const imgRes = await fetch(pendingUrl);
    if (!imgRes.ok) {
      throw new Error(`Could not fetch pending photo (HTTP ${imgRes.status}): ${pendingUrl}`);
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // ── 2. Draw watermark using node-canvas ───────────────────────────────
    const srcImage = await loadImage(imgBuffer);
    const { width, height } = srcImage;

    const canvas = createCanvas(width, height);
    const ctx    = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(srcImage, 0, 0, width, height);

    // Watermark settings
    ctx.save();
    ctx.font        = `bold ${WM_FONT_SIZE}px sans-serif`;
    ctx.fillStyle   = WM_COLOR;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';

    // Rotate canvas around its centre, then tile the text
    ctx.translate(width / 2, height / 2);
    ctx.rotate((WM_ANGLE * Math.PI) / 180);

    // Tile across the rotated canvas — extend beyond edges to cover corners
    const cols = Math.ceil(width  / WM_SPACING_X) + 4;
    const rows = Math.ceil(height / WM_SPACING_Y) + 6;
    const startX = -Math.ceil(cols / 2) * WM_SPACING_X;
    const startY = -Math.ceil(rows / 2) * WM_SPACING_Y;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * WM_SPACING_X;
        const y = startY + r * WM_SPACING_Y;
        ctx.fillText(WM_TEXT, x, y);
      }
    }
    ctx.restore();

    // Export as JPEG (quality 0.90 — good balance of file size vs quality)
    const watermarkedBuffer = canvas.toBuffer('image/jpeg', { quality: 0.90 });

    // ── 3. Upload to Supabase Storage ─────────────────────────────────────
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Permanent path: approved/<studentId>_<timestamp>.jpg
    const timestamp   = Date.now();
    const storagePath = `approved/${studentId}_${timestamp}.jpg`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, watermarkedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,          // overwrite if same path already exists
      });

    if (uploadError) {
      throw new Error('Supabase upload failed: ' + uploadError.message);
    }

    // Build the public URL
    const { data: urlData } = db.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const photoUrl = urlData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    // ── 4. Optionally delete the pending photo from temp storage ──────────
    // The pending photo lives at whatever path pendingUrl points to.
    // Extract the relative storage path and remove it to save space.
    const pendingStoragePrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    if (pendingUrl.startsWith(pendingStoragePrefix)) {
      const pendingPath = pendingUrl.slice(pendingStoragePrefix.length);
      // Best-effort — ignore errors (file may already be gone)
      await db.storage.from(BUCKET).remove([pendingPath]).catch(() => {});
    }

    return json(200, { success: true, photoUrl });

  } catch (err) {
    console.error('[approve-photo] Error:', err);
    return json(500, { success: false, message: err.message });
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────
function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
