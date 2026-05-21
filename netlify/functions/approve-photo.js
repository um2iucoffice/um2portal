// ============================================================
//  netlify/functions/approve-photo.js
//  Fetches pending photo, burns tiled watermark, saves to
//  photos/<studentId>.jpg, updates students.photo in Supabase.
//
//  Environment variables required:
//    SUPABASE_URL
//    SUPABASE_SERVICE_KEY
// ============================================================

import sharp from 'sharp';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'student-photos';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

async function supabaseRest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`REST ${path}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function uploadToStorage(filePath, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type':  contentType,
        'x-upsert':      'true'
      },
      body: buffer
    }
  );
  if (!res.ok) throw new Error(`Storage upload failed: ${await res.text()}`);
}

async function buildWatermarkTile(text) {
  // SVG tile with diagonal repeated text
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <style>
        text {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: bold;
          fill: rgba(255,255,255,0.35);
        }
      </style>
      <g transform="rotate(-35, 100, 100)">
        <text x="10"  y="60"  text-anchor="middle">${text}</text>
        <text x="110" y="60"  text-anchor="middle">${text}</text>
        <text x="10"  y="120" text-anchor="middle">${text}</text>
        <text x="110" y="120" text-anchor="middle">${text}</text>
        <text x="10"  y="180" text-anchor="middle">${text}</text>
        <text x="110" y="180" text-anchor="middle">${text}</text>
      </g>
    </svg>`;
  return Buffer.from(svg);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { studentId, pendingUrl } = JSON.parse(event.body || '{}');

    if (!studentId || !pendingUrl) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: 'Missing studentId or pendingUrl.' }) };
    }

    // 1. Fetch the pending photo
    const imgRes = await fetch(pendingUrl);
    if (!imgRes.ok) throw new Error('Could not fetch pending photo.');
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // 2. Get image dimensions
    const meta   = await sharp(imgBuffer).metadata();
    const width  = meta.width  || 400;
    const height = meta.height || 500;

    // 3. Build watermark tile and tile it across the image
    const watermarkText = `UM2IUC · ${studentId.toUpperCase()}`;
    const tile          = await buildWatermarkTile(watermarkText);

    // Create a full-size watermark overlay by tiling
    const tileSize  = 200;
    const cols      = Math.ceil(width  / tileSize) + 1;
    const rows      = Math.ceil(height / tileSize) + 1;
    const compositeInputs = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        compositeInputs.push({
          input: tile,
          top:   r * tileSize,
          left:  c * tileSize
        });
      }
    }

    // 4. Composite watermark onto photo
    const watermarked = await sharp(imgBuffer)
      .jpeg({ quality: 88 })
      .composite(compositeInputs)
      .toBuffer();

    // 5. Upload watermarked photo to photos/<studentId>.jpg
    const finalPath = `photos/${studentId}.jpg`;
    await uploadToStorage(finalPath, watermarked, 'image/jpeg');

    const finalUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${finalPath}`;

    // 6. Update students.photo
    await supabaseRest(
      `students?id=eq.${encodeURIComponent(studentId)}`,
      {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ photo: finalUrl })
      }
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, photoUrl: finalUrl })
    };

  } catch (err) {
    console.error('approve-photo error:', err);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: false, message: err.message }) };
  }
};