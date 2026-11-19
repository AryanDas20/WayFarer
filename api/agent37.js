import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { Readable } from 'node:stream';

let firebaseCertCache = { certs: null, expiresAt: 0 };

async function getFirebaseCertificates() {
  if (firebaseCertCache.certs && firebaseCertCache.expiresAt > Date.now()) return firebaseCertCache.certs;
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Could not retrieve Firebase token verification certificates.');
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 3600);
  firebaseCertCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return certs;
}

// Best-effort per-user limiter (resets when the serverless instance recycles).
const RATE = { windowMs: 10 * 60 * 1000, max: 30 };
const hits = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const recent = (hits.get(uid) || []).filter(t => now - t < RATE.windowMs);
  if (recent.length >= RATE.max) { hits.set(uid, recent); return true; }
  recent.push(now); hits.set(uid, recent);
  if (hits.size > 5000) for (const [key, list] of hits) if (!list.some(t => now - t < RATE.windowMs)) hits.delete(key);
  return false;
}
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

function getConfig() {
  const instanceId = (process.env.AGENT37_INSTANCE_ID || '').trim();
  const apiKey = (process.env.AGENT37_API_KEY || '').trim();
  const base = (process.env.AGENT37_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!instanceId || !apiKey || !base) return { error: 'Agent37 server configuration is incomplete. Check AGENT37_API_KEY, AGENT37_INSTANCE_ID and AGENT37_BASE_URL in Vercel.' };
  if (!/^[a-z0-9]{6,32}$/i.test(instanceId)) return { error: 'AGENT37_INSTANCE_ID has an invalid format.' };
  let url;
  try { url = new URL(base); } catch { return { error: 'AGENT37_BASE_URL is not a valid URL.' }; }
  if (url.protocol !== 'https:' || url.hostname !== `${instanceId}.agent37.app` || url.pathname !== '/v1' || url.search || url.hash) {
    return { error: 'AGENT37_BASE_URL must be https://<instance-id>.agent37.app/v1 and match AGENT37_INSTANCE_ID.' };
  }
  return { instanceId, apiKey, endpoint: `${base}/responses` };
}

async function verifyFirebaseUser(req) {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) throw new Error('Firebase project is not configured on the server.');
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, 'Sign in to your WAYFARER account before using the AI assistant.');
  const parts = match[1].split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Firebase sign-in token is malformed.');
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw new HttpError(401, 'Firebase sign-in token is malformed.'); }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Firebase sign-in token uses an unsupported signature.');
  const certs = await getFirebaseCertificates();
  const cert = certs[header.kid];
  if (!cert) throw new HttpError(401, 'Firebase sign-in token signing key is not recognized. Retry after refreshing the page.');
  const publicKey = createPublicKey(cert);
  const valid = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  const now = Math.floor(Date.now() / 1000);
  if (!valid || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.aud !== projectId ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      typeof payload.iat !== 'number' || payload.iat > now + 60) {
    throw new HttpError(401, 'Firebase sign-in token is invalid or expired. Sign in again and retry.');
  }
  return payload.sub;
}

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const agent = getConfig();
    return sendJson(res, agent.error ? 503 : 200, {
      configured: !agent.error,
      instanceId: agent.instanceId || null,
      error: agent.error || null
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const agent = getConfig();
  if (agent.error) return sendJson(res, 503, { error: agent.error });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  res.on?.('close', () => controller.abort());
  try {
    const uid = await verifyFirebaseUser(req);
    if (rateLimited(uid)) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { error: 'Too many AI requests. Please wait a few minutes and try again.' });
    }
    const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id.trim() : '';
    if (!input || input.length > 12000) return sendJson(res, 400, { error: 'Message is required and must be 12,000 characters or fewer.' });
    if (sessionId && !/^[a-f0-9]{16,64}$/i.test(sessionId)) return sendJson(res, 400, { error: 'Invalid Agent37 session ID.' });

    // Only fields documented for POST /v1/responses are sent: input, session_id, stream.
    const upstream = await fetch(agent.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'X-Agent37-Key': agent.apiKey, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ input, ...(sessionId ? { session_id: sessionId } : {}), stream: true })
    });

    if (!upstream.ok) {
      const raw = await upstream.text().catch(() => '');
      const friendly = {
        401: 'Agent37 rejected the API key (AGENT37_API_KEY). Check the key in Vercel and redeploy.',
        402: 'Agent37 reports insufficient credit. Add funds in the Agent37 billing dashboard.',
        403: 'Agent37 refused access to this instance. Check that the key belongs to the same workspace as the instance.',
        404: 'Agent37 instance not found. Check AGENT37_INSTANCE_ID and AGENT37_BASE_URL.',
        409: 'The AI is still answering your previous message. Wait a moment and try again.',
        429: 'Agent37 rate limit reached. Wait a minute and try again.'
      }[upstream.status] || `Agent37 returned HTTP ${upstream.status}.`;
      console.error('Agent37 upstream error', upstream.status, raw.slice(0, 300));
      return sendJson(res, upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status, { error: friendly, detail: raw.slice(0, 300) });
    }
    if (!upstream.body) return sendJson(res, 502, { error: 'Agent37 returned an empty response stream.' });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', () => res.end());
    stream.on('end', () => clearTimeout(timer));
    stream.pipe(res);
  } catch (error) {
    clearTimeout(timer);
    if (res.headersSent) { res.end(); return; }
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
    if (error?.name === 'AbortError') return sendJson(res, 504, { error: 'Agent37 took too long to respond. Try a shorter request.' });
    console.error('WAYFARER Agent37 proxy error:', error?.message || error);
    return sendJson(res, 502, { error: 'Could not reach Agent37. Check that your instance is running and AGENT37_BASE_URL is correct.' });
  }
}
