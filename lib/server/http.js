import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'canto_session';
const lifetime = 7 * 24 * 60 * 60;
const attempts = new Map();
const bodyLimit = 32 * 1024;

export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function sendError(res, error) {
  const known = error instanceof ClientError;
  sendJson(res, known ? error.status : 503, {
    error: known ? error.message : 'The service is temporarily unavailable. Please try again.',
  });
}

export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods);
  sendJson(res, 405, { error: 'This request method is not supported.' });
}

export async function readBody(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new ClientError(403, 'Open the coach to continue.');
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    throw new ClientError(415, 'Send this request as JSON.');
  }
  if (Number(req.headers['content-length']) > bodyLimit) throw new ClientError(413, 'That request is too large.');
  let data = req.body;
  if (data === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > bodyLimit) throw new ClientError(413, 'That request is too large.');
      chunks.push(bytes);
    }
    data = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(data)) data = data.toString('utf8');
  if (typeof data === 'string') {
    if (Buffer.byteLength(data) > bodyLimit) throw new ClientError(413, 'That request is too large.');
    try { data = JSON.parse(data); } catch { throw new ClientError(400, 'Invalid JSON.'); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ClientError(400, 'Expected a JSON object.');
  if (Buffer.byteLength(JSON.stringify(data)) > bodyLimit) throw new ClientError(413, 'That request is too large.');
  return data;
}

function signature(payload) {
  return createHmac('sha256', process.env.APP_SESSION_SECRET || process.env.APP_PASSCODE)
    .update('canto-session-v1\0').update(process.env.APP_PASSCODE).update('\0').update(payload).digest('hex');
}

function equal(a, b) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function session(req) {
  if (!process.env.APP_PASSCODE) return null;
  const value = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const match = /^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value || '');
  if (!match || Number(match[1]) <= Date.now() / 1000) return null;
  return equal(signature(match[1] + '.' + match[2]), match[3]) ? match[2] : null;
}

export function requireSession(req) {
  const id = session(req);
  if (!id) throw new ClientError(401, 'Enter the friends passcode to continue.');
  return id;
}

// Per-instance burst control. Project-wide spend limits belong on the OpenRouter key.
export function throttle(key, limit, windowMs) {
  const now = Date.now();
  let entry = attempts.get(key);
  if (!entry || entry.until <= now) {
    if (attempts.size >= 4096) {
      for (const [name, item] of attempts) if (item.until <= now) attempts.delete(name);
      if (attempts.size >= 4096) throw new ClientError(429, 'Please wait a moment and try again.');
    }
    entry = { count: 0, until: now + windowMs };
    attempts.set(key, entry);
  }
  if (++entry.count > limit) throw new ClientError(429, 'Please wait a moment and try again.');
}

export function login(req, res, passcode) {
  if (!process.env.APP_PASSCODE) throw new ClientError(503, 'The host needs to set the friends passcode.');
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0];
  throttle('login:' + ip, 12, 10 * 60000);
  if (typeof passcode !== 'string' || passcode.length > 256 || !equal(passcode, process.env.APP_PASSCODE)) {
    throw new ClientError(401, 'That passcode did not match. Try again.');
  }
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const payload = expires + '.' + randomBytes(16).toString('hex');
  const secure = process.env.VERCEL || req.socket?.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', cookieName + '=' + payload + '.' + signature(payload) +
    '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + lifetime + secure);
}

export function language(value) {
  if (value !== 'cantonese') throw new ClientError(400, 'Kapok Club supports Cantonese.');
  return value;
}

export function inputText(value, max, message) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ClientError(400, message);
  return value.trim();
}
