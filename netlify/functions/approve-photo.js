// netlify/functions/approve-photo.js
//
// Called by the Registrar UI when a photo edit request is approved.
// Workflow:
//   1. Fetch the pending photo from its URL
//   2. Draw a repeating diagonal "UM2UM2UM2UM2UM2" watermark using sharp + SVG overlay
//   3. Upload the watermarked JPEG to Supabase Storage (student-photos bucket)
//   4. Return { success: true, photoUrl: "<full public URL>" }
//
// Runtime: Node.js 18+  (Netlify Functions / AWS Lambda)
// Dependencies: @supabase/supabase-js, sharp
//   npm install @supabase/supabase-js sharp
//
// Environment variables required:
//   SUPABASE_URL         — your Supabase project URL
//   SUPABASE_SERVICE_KEY — service_role key (NOT the anon key)

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

const WM_TEXT      = 'UM2UM2UM2UM2UM2';
const WM_FONT_SIZE = 18;
const WM_ANGLE     = -30;
const WM_SPACING_X = 140;
const WM_SPACING_Y = 60;

exports.handler = async function (event) {
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

    // ── 2. Get image dimensions ───────────────────────────────────────────
    const meta = await sharp(imgBuffer).metadata();
    const width  = meta.width  || 400;
    const height = meta.height || 500;

    // ── 3. Build SVG watermark overlay ────────────────────────────────────
    // We tile the watermark text across an SVG the same size as the image,
    // rotated diagonally — sharp composites it on top as a transparent overlay.
    const cols = Math.ceil(width  / WM_SPACING_X) + 6;
    const rows = Math.ceil(height / WM_SPACING_Y) + 6;

    let textElements = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -Math.ceil(cols / 2) * WM_SPACING_X + c * WM_SPACING_X + width  / 2;
        const y = -Math.ceil(rows / 2) * WM_SPACING_Y + r * WM_SPACING_Y + height / 2;
        textElements += `<text x="${x}" y="${y}" transform="rotate(${WM_ANGLE}, ${x}, ${y})">${WM_TEXT}</text>`;
      }
    }

    const svgOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text {
            font-family: sans-serif;
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

    // ── 4. Composite watermark and export as JPEG ─────────────────────────
    const watermarkedBuffer = await sharp(imgBuffer)
      .composite([{ input: svgOverlay, blend: 'over' }])
      .jpeg({ quality: 90 })
      .toBuffer();

    // ── 5. Upload to Supabase Storage ─────────────────────────────────────
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const timestamp   = Date.now();
    const storagePath = `approved/${studentId}_${timestamp}.jpg`;

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

    // ── 6. Delete pending photo (best-effort) ─────────────────────────────
    const pendingStoragePrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    if (pendingUrl.startsWith(pendingStoragePrefix)) {
      const pendingPath = pendingUrl.slice(pendingStoragePrefix.length);
      await db.storage.from(BUCKET).remove([pendingPath]).catch(() => {});
    }

    return json(200, { success: true, photoUrl });

  } catch (err) {
    console.error('[approve-photo] Error:', err);
    return json(500, { success: false, message: err.message });
  }
};

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
