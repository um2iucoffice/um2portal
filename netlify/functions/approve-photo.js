// netlify/functions/approve-photo.js
//
// Watermark approach: draws "UM2" as pixel art directly onto raw RGBA buffer.
// Zero font/librsvg dependency — works on any Linux Lambda runtime.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('[approve-photo] FATAL: sharp could not be loaded.', e.message);
}

const fetchFn = globalThis.fetch ?? require('node-fetch');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';
const FETCH_TIMEOUT_MS     = 8_000;

// ── Pixel font: 5×7 bitmap glyphs for U, M, 2, space ────────────────────────
// Each glyph is a 5-wide × 7-tall array of 0/1 rows (MSB = leftmost pixel)
const GLYPHS = {
  'U': [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  'M': [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  '2': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,1,1,1,1],
  ],
  ' ': [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ],
};

const GLYPH_W    = 5;
const GLYPH_H    = 7;
const GLYPH_GAP  = 2;   // pixels between characters
const WM_SCALE   = 3;   // scale factor — makes each pixel 3×3
const WM_LABEL   = 'UM2 UM2 UM2';
const WM_OPACITY = 100; // 0-255, alpha of the white watermark pixels
const WM_ANGLE   = -30; // degrees
const WM_SPACING_X = 160;
const WM_SPACING_Y = 60;

// Render the label into a small RGBA buffer
function renderTextToBuffer(label, scale, opacity) {
  const chars = label.split('');
  const totalW = chars.reduce((sum, ch) => {
    return sum + (GLYPHS[ch] ? GLYPH_W : 0) + GLYPH_GAP;
  }, -GLYPH_GAP); // subtract trailing gap

  const pw = totalW * scale;   // pixel width
  const ph = GLYPH_H * scale;  // pixel height
  const buf = Buffer.alloc(pw * ph * 4, 0); // RGBA all transparent

  let cx = 0;
  for (const ch of chars) {
    const glyph = GLYPHS[ch];
    if (!glyph) { cx += (GLYPH_W + GLYPH_GAP) * scale; continue; }
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (!glyph[gy][gx]) continue;
        // Paint scale×scale block
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cx + gx * scale + sx;
            const py = gy * scale + sy;
            const idx = (py * pw + px) * 4;
            buf[idx]     = 255; // R
            buf[idx + 1] = 255; // G
            buf[idx + 2] = 255; // B
            buf[idx + 3] = opacity; // A
          }
        }
      }
    }
    cx += (GLYPH_W + GLYPH_GAP) * scale;
  }

  return { buf, pw, ph };
}

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
  if (!sharp) {
    return json(500, { success: false, message: 'Server mis-configuration: sharp not available' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, message: 'Invalid JSON body' });
  }

  const { studentId, pendingUrl } = body;
  if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
    return json(400, { success: false, message: 'studentId is required' });
  }
  if (!pendingUrl || typeof pendingUrl !== 'string') {
    return json(400, { success: false, message: 'pendingUrl is required' });
  }

  const safeStudentId = studentId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    new URL(pendingUrl);
  } catch (e) {
    return json(400, { success: false, message: `Invalid pendingUrl: ${e.message}` });
  }

  try {
    // ── 1. Fetch image ───────────────────────────────────────────────────
    console.log(`[approve-photo] Fetching image for ${safeStudentId}`);
    const controller  = new AbortController();
    const fetchTimer  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let imgBuffer;
    try {
      const imgRes = await fetchFn(pendingUrl, { signal: controller.signal });
      clearTimeout(fetchTimer);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    } catch (fetchErr) {
      clearTimeout(fetchTimer);
      throw new Error(`Could not fetch photo: ${fetchErr.message}`);
    }

    // ── 2. Get dimensions ────────────────────────────────────────────────
    const meta   = await sharp(imgBuffer).metadata();
    const width  = meta.width  || 400;
    const height = meta.height || 500;
    console.log(`[approve-photo] ${width}×${height}`);

    // ── 3. Build pixel-art watermark tile ────────────────────────────────
    const { buf: textBuf, pw: textW, ph: textH } =
      renderTextToBuffer(WM_LABEL, WM_SCALE, WM_OPACITY);

    // Convert raw RGBA buffer → PNG via sharp
    const textPng = await sharp(textBuf, {
      raw: { width: textW, height: textH, channels: 4 }
    }).png().toBuffer();

    // Rotate the tile
    const rotatedTile = await sharp(textPng)
      .rotate(WM_ANGLE, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const tileMeta = await sharp(rotatedTile).metadata();
    const tw = tileMeta.width  || textW;
    const th = tileMeta.height || textH;

    // ── 4. Tile the watermark across the image ───────────────────────────
    const cols = Math.ceil(width  / WM_SPACING_X) + 4;
    const rows = Math.ceil(height / WM_SPACING_Y) + 4;
    const composites = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = Math.round(
          -Math.ceil(cols / 2) * WM_SPACING_X + c * WM_SPACING_X + width  / 2 - tw / 2
        );
        const top = Math.round(
          -Math.ceil(rows / 2) * WM_SPACING_Y + r * WM_SPACING_Y + height / 2 - th / 2
        );
        if (left + tw < 0 || top + th < 0 || left >= width || top >= height) continue;
        composites.push({
          input: rotatedTile,
          left:  Math.max(0, left),
          top:   Math.max(0, top),
          blend: 'over',
        });
      }
    }

    console.log(`[approve-photo] Compositing ${composites.length} watermark tiles`);
    const watermarkedBuffer = await sharp(imgBuffer)
      .composite(composites)
      .jpeg({ quality: 90 })
      .toBuffer();

    // ── 5. Upload to Supabase ────────────────────────────────────────────
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: ws },
    });

    const timestamp   = Date.now();
    const storagePath = `approved/${safeStudentId}_${timestamp}.jpg`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(storagePath, watermarkedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw new Error('Supabase upload failed: ' + uploadError.message);

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
    const photoUrl = urlData?.publicUrl
      || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    console.log(`[approve-photo] Done: ${photoUrl}`);

    // ── 6. Delete pending photo (best-effort) ────────────────────────────
    const pendingPrefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    if (pendingUrl.startsWith(pendingPrefix)) {
      const pendingPath = pendingUrl.slice(pendingPrefix.length);
      db.storage.from(BUCKET).remove([pendingPath])
        .then(() => console.log(`[approve-photo] Deleted pending: ${pendingPath}`))
        .catch(e  => console.warn(`[approve-photo] Could not delete pending: ${e.message}`));
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
