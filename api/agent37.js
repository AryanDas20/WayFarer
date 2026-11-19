import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { Readable } from 'node:stream';

let firebaseCertCache = { certs: null, expiresAt: 0 };

async function getFirebaseCertificates() {
  if (firebaseCertCache.certs && firebaseCertCache.expiresAt > Date.now()) return firebaseCertCache.certs;
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Could not retrieve Firebase token verification certificates.');
  const certs = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\\d+)/i)?.[1] || 3600);
  firebaseCertCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return certs;
}

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
  if (!match) throw new Error('Sign in to your WAYFARER account before using the AI assistant.');
  const parts = match[1].split('.');
  if (parts.length !== 3) throw new Error('Firebase sign-in token is malformed.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Firebase sign-in token uses an unsupported signature.');
  const certs = await getFirebaseCertificates();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Firebase sign-in token signing key is not recognized. Retry after refreshing the page.');
  const publicKey = createPublicKey(cert);
  const valid = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  const now = Math.floor(Date.now() / 1000);
  if (!valid || payload.iss !== `https://securetoken.google.com/${projectId}` || payload.aud !== projectId ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      typeof payload.iat !== 'number' || payload.iat > now + 60) {
    throw new Error('Firebase sign-in token is invalid or expired. Sign in again and retry.');
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

  try {
    const uid = await verifyFirebaseUser(req);
    const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
    const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id.trim() : '';
    if (!input || input.length > 12000) return sendJson(res, 400, { error: 'Message is required and must be 12,000 characters or fewer.' });
    if (sessionId && !/^[a-f0-9]{16,64}$/i.test(sessionId)) return sendJson(res, 400, { error: 'Invalid Agent37 session ID.' });

    const upstream = await fetch(agent.endpoint, {
      method: 'POST',
      headers: {
        'X-Agent37-Key': agent.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        input,
        ...(sessionId ? { session_id: sessionId } : {}),
        stream: true,
        agent: 'hermes',
        mode: 'chat',
        metadata: { product: 'WAYFARER AI', firebase_uid: uid }
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return sendJson(res, upstream.status, {
        error: `Agent37 returned HTTP ${upstream.status}.`,
        detail: detail.slice(0, 1200)
      });
    }
    if (!upstream.body) return sendJson(res, 502, { error: 'Agent37 returned an empty response stream.' });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error('WAYFARER Agent37 proxy error:', error);
    if (!res.headersSent) return sendJson(res, 401, { error: error.message || 'Authentication failed.' });
    res.end();
  }
}
