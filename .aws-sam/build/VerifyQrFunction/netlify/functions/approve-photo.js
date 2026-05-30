// netlify/functions/approve-photo.js
//
// Called by the Registrar UI when a photo edit request is approved.
// Workflow:
//   1. Fetch the pending photo from its URL
//   2. Draw a repeating diagonal "UM2UM2UM2UM2UM2" watermark using sharp + SVG overlay
//   3. Upload the watermarked JPEG to Supabase Storage (student-photos bucket)
//   4. Return { success: true, photoUrl: "<full public URL>" }
//
// Runtime: Node.js 20+  (Netlify Functions / AWS Lambda)
// Dependencies: @supabase/supabase-js, sharp, ws
//
// FIX SUMMARY (v3):
//   - Upgraded to Node 20 (set in netlify.toml) — fixes native WebSocket support
//   - Added 'ws' package passed to Supabase createClient as transport fallback
//   - sharp is imported safely with try/catch
//   - node-fetch fallback for fetch (redundant on Node 20 but kept for safety)
//   - Fetch timeout via AbortController
//   - studentId sanitised to prevent storage path traversal

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

// ── sharp: native binary — must be built for the Linux runtime ────────────────
// If this throws, your function bundle is missing the Linux sharp binary.
// See README / netlify.toml for the correct build config.
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('[approve-photo] FATAL: sharp could not be loaded.', e.message);
}

// ── node-fetch fallback for Node < 18 ─────────────────────────────────────────
const fetchFn = globalThis.fetch ?? require('node-fetch');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

const WM_TEXT      = 'UM2UM2UM2UM2UM2';
const WM_FONT_SIZE = 18;
const WM_ANGLE     = -30;
const WM_SPACING_X = 140;
const WM_SPACING_Y = 60;

// Maximum time (ms) to wait for the upstream image fetch
const FETCH_TIMEOUT_MS = 8_000;

exports.handler = async function (event) {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed' });
  }

  // ── Environment guard ────────────────────────────────────────────────────
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[approve-photo] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    return json(500, { success: false, message: 'Server mis-configuration: missing Supabase env vars' });
  }

  // ── sharp guard ──────────────────────────────────────────────────────────
  if (!sharp) {
    return json(500, { success: false, message: 'Server mis-configuration: sharp native module not available' });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, message: 'Invalid JSON body' });
  }

  const { studentId, pendingUrl } = body;

  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    return json(400, { success: false, message: 'studentId is required and must be a non-empty string' });
  }
  if (!pendingUrl || typeof pendingUrl !== 'string') {
    return json(400, { success: false, message: 'pendingUrl is required' });
  }

  // Sanitise studentId — only allow alphanumeric, hyphens and underscores
  // to prevent path-traversal attacks in the Supabase storage key
  const safeStudentId = studentId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(pendingUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only http/https URLs are supported');
    }
  } catch (e) {
    return json(400, { success: false, message: `Invalid pendingUrl: ${e.message}` });
  }

  try {
    // ── 1. Fetch the pending photo (with timeout) ────────────────────────
    console.log(`[approve-photo] Fetching image for student ${safeStudentId}: ${pendingUrl}`);

    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let imgBuffer;
    try {
      const imgRes = await fetchFn(pendingUrl, { signal: controller.signal });
      clearTimeout(fetchTimer);
      if (!imgRes.ok) {
        throw new Error(`HTTP ${imgRes.status} ${imgRes.statusText}`);
      }
      imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    } catch (fetchErr) {
      clearTimeout(fetchTimer);
      if (fetchErr.name === 'AbortError') {
        throw new Error(`Timed out fetching pending photo after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw new Error(`Could not fetch pending photo: ${fetchErr.message}`);
    }

    console.log(`[approve-photo] Image fetched — ${imgBuffer.length} bytes`);

    // ── 2. Get image dimensions ──────────────────────────────────────────
    const meta = await sharp(imgBuffer).metadata();
    const width  = meta.width  || 400;
    const height = meta.height || 500;

    console.log(`[approve-photo] Image dimensions: ${width}x${height}`);

    // ── 3. Build SVG watermark overlay ───────────────────────────────────
    const cols = Math.ceil(width  / WM_SPACING_X) + 6;
    const rows = Math.ceil(height / WM_SPACING_Y) + 6;

    let textElements = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -Math.ceil(cols / 2) * WM_SPACING_X + c * WM_SPACING_X + width  / 2;
        const y = -Math.ceil(rows / 2) * WM_SPACING_Y + r * WM_SPACING_Y + height / 2;
        // Escape WM_TEXT to be safe inside SVG XML
        const safeText = WM_TEXT.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        textElements += `<text x="${x}" y="${y}" transform="rotate(${WM_ANGLE}, ${x}, ${y})">${safeText}</text>\n`;
      }
    }

    const svgOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text {
            font-family: Arial, Helvetica, Liberation Sans, sans-serif;
            font-size: ${WM_FONT_SIZE}px;
            font-weight: bold;
            fill: rgba(255,255,255,0.30);
            text-anchor: middle;
            dominant-baseline: middle;
          }
        </style>
        ${textElements}
      </svg>
    `);

    // ── 4. Composite watermark and export as JPEG ────────────────────────
    console.log('[approve-photo] Applying watermark...');
    const watermarkedBuffer = await sharp(imgBuffer)
      .composite([{ input: svgOverlay, blend: 'over' }])
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(`[approve-photo] Watermarked buffer: ${watermarkedBuffer.length} bytes`);

    // ── 5. Upload to Supabase Storage ────────────────────────────────────
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: ws },
    });

    const timestamp   = Date.now();
    const storagePath = `approved/${safeStudentId}_${timestamp}.jpg`;

    console.log(`[approve-photo] Uploading to Supabase: ${storagePath}`);

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, watermarkedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Supabase upload failed: ' + uploadError.message);
    }

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
    const photoUrl = urlData?.publicUrl
      || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    console.log(`[approve-photo] Upload successful: ${photoUrl}`);

    // ── 6. Delete pending photo (best-effort, non-blocking) ──────────────
    const pendingStoragePrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    if (pendingUrl.startsWith(pendingStoragePrefix)) {
      const pendingPath = pendingUrl.slice(pendingStoragePrefix.length);
      db.storage.from(BUCKET).remove([pendingPath])
        .then(() => console.log(`[approve-photo] Deleted pending photo: ${pendingPath}`))
        .catch((e) => console.warn(`[approve-photo] Could not delete pending photo: ${e.message}`));
    }

    return json(200, { success: true, photoUrl });

  } catch (err) {
    console.error('[approve-photo] Error:', err);
    return json(500, { success: false, message: err.message });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
