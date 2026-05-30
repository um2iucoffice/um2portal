// netlify/functions/upload-image.js
// NO extra dependencies — parses multipart using Node.js built-ins only.
// Only requires @supabase/supabase-js and ws which you already have.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

const BUCKET = 'post-images';

// ── Lightweight multipart parser (no busboy needed) ───────────────
function parseMultipart(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) throw new Error('No boundary found in Content-Type');

  const boundary = boundaryMatch[1];
  const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

  const delimiter  = Buffer.from('\r\n--' + boundary);
  const closeDelim = Buffer.from('\r\n--' + boundary + '--');

  let files = [];
  let start = bodyBuffer.indexOf('--' + boundary) + ('--' + boundary).length;

  while (start < bodyBuffer.length) {
    start += 2;
    const headerEnd = bodyBuffer.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;

    const headerStr = bodyBuffer.slice(start, headerEnd).toString();
    start = headerEnd + 4;

    const nextBoundary = bodyBuffer.indexOf(delimiter, start);
    const partEnd = nextBoundary === -1 ? bodyBuffer.indexOf(closeDelim, start) : nextBoundary;
    if (partEnd === -1) break;

    const data = bodyBuffer.slice(start, partEnd);
    start = partEnd + delimiter.length;

    const nameMatch     = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const mimeMatch     = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    if (filenameMatch) {
      files.push({
        fieldname: nameMatch ? nameMatch[1] : 'file',
        filename:  filenameMatch[1],
        mimeType:  mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream',
        data,
      });
    }

    if (bodyBuffer.indexOf(closeDelim, partEnd) === partEnd) break;
  }

  return files;
}

// ── Handler ───────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let files;
  try {
    files = parseMultipart(event);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Parse error: ' + err.message }) };
  }

  if (!files.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No file received.' }) };
  }

  const file     = files[0];
  const fileName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file.data, { contentType: file.mimeType, upsert: false });

  if (uploadError) {
    return { statusCode: 500, body: JSON.stringify({ error: uploadError.message }) };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return {
    statusCode: 200,
    body: JSON.stringify({ url: data.publicUrl }),
  };
};
