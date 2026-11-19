import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

// Build a throw-away self-signed certificate + RS256 signer so we can exercise real token verification offline.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`, '-subj', '/CN=test', '-days', '2'], { stdio: 'ignore' });
const certPem = fs.readFileSync(`${dir}/c.pem`, 'utf8'); const keyPem = fs.readFileSync(`${dir}/k.pem`, 'utf8');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(over = {}, kid = 'k1') {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://securetoken.google.com/proj', aud: 'proj', sub: 'user123', iat: now - 10, exp: now + 3600, ...over };
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' }); const body = b64(payload);
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(keyPem).toString('base64url');
  return `${head}.${body}.${sig}`;
}
process.env.FIREBASE_PROJECT_ID = 'proj'; process.env.AGENT37_INSTANCE_ID = 'abc123xyz1'; process.env.AGENT37_API_KEY = 'sk_live_TESTKEY';
process.env.AGENT37_BASE_URL = 'https://abc123xyz1.agent37.app/v1';

let upstreamCalls = []; let upstreamMode = 'ok';
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('securetoken@system')) return new Response(JSON.stringify({ k1: certPem }), { headers: { 'cache-control': 'public, max-age=7200' } });
  upstreamCalls.push({ url: String(url), opts });
  if (upstreamMode === '402') return new Response('{"error":"no credit"}', { status: 402 });
  if (upstreamMode === '401') return new Response('{"error":"bad key"}', { status: 401 });
  const sse = 'event: response.created\ndata: {"id":"r1","session_id":"0123456789abcdef0123"}\n\nevent: response.output_text.delta\ndata: {"text":"hi"}\n\nevent: response.completed\ndata: {"output_text":"hi"}\n\n';
  return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
};
const { default: handler } = await import('../api/agent37.js');

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '', ended: false, headersSent: false,
    status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    json(o) { this.body = JSON.stringify(o); this.ended = true; return this; }, flushHeaders() { this.headersSent = true; },
    write(c) { this.body += c; return true; }, end(c) { if (c) this.body += c; this.ended = true; this.emit?.('finish'); }, on() { return this; }, once() { return this; }, emit() {} };
  return res;
}
const run = async (req) => { const res = mockRes(); await handler(req, res); await new Promise(r => setTimeout(r, 50)); return res; };
const post = (body, auth) => ({ method: 'POST', headers: auth ? { authorization: `Bearer ${auth}` } : {}, body });

let r = await run({ method: 'GET', headers: {} }); assert.equal(r.statusCode, 200); assert.equal(JSON.parse(r.body).configured, true);
r = await run({ method: 'DELETE', headers: {} }); assert.equal(r.statusCode, 405);
r = await run(post({ input: 'hello' })); assert.equal(r.statusCode, 401, 'missing token rejected');
r = await run(post({ input: 'hello' }, 'a.b.c')); assert.equal(r.statusCode, 401, 'malformed token rejected');
r = await run(post({ input: 'hello' }, token({ aud: 'other' }))); assert.equal(r.statusCode, 401, 'wrong audience rejected');
r = await run(post({ input: 'hello' }, token({ exp: 1 }))); assert.equal(r.statusCode, 401, 'expired token rejected');
r = await run(post({ input: 'hello' }, token({}, 'unknown'))); assert.equal(r.statusCode, 401, 'unknown kid rejected');
const tampered = token().split('.'); tampered[1] = b64({ iss: 'https://securetoken.google.com/proj', aud: 'proj', sub: 'attacker', iat: 1, exp: 9999999999 });
r = await run(post({ input: 'hello' }, tampered.join('.'))); assert.equal(r.statusCode, 401, 'tampered payload rejected');
assert.equal(upstreamCalls.length, 0, 'no upstream call before auth passes');

r = await run(post({ input: '' }, token())); assert.equal(r.statusCode, 400);
r = await run(post({ input: 'x'.repeat(12001) }, token())); assert.equal(r.statusCode, 400);
r = await run(post({ input: 'hi', session_id: '../etc' }, token())); assert.equal(r.statusCode, 400);

r = await run(post({ input: 'plan a trip', session_id: '0123456789abcdef0123' }, token()));
assert.equal(r.statusCode, 200); assert.match(r.body, /response\.completed/);
const call = upstreamCalls.at(-1);
assert.equal(call.url, 'https://abc123xyz1.agent37.app/v1/responses');
assert.equal(call.opts.headers['X-Agent37-Key'], 'sk_live_TESTKEY');
assert.deepEqual(Object.keys(JSON.parse(call.opts.body)).sort(), ['input', 'session_id', 'stream']);
assert.ok(!r.body.includes('sk_live_'), 'key never in response');

upstreamMode = '402'; r = await run(post({ input: 'x' }, token())); assert.equal(r.statusCode, 402); assert.match(JSON.parse(r.body).error, /credit/i);
upstreamMode = '401'; r = await run(post({ input: 'x' }, token())); assert.equal(r.statusCode, 502); assert.ok(!r.body.includes('sk_live_'));
upstreamMode = 'ok';
let last; for (let i = 0; i < 40; i++) last = await run(post({ input: 'x' }, token({ sub: 'spammer' })));
assert.equal(last.statusCode, 429, 'rate limit kicks in');
r = await run(post({ input: 'x' }, token({ sub: 'other-user' }))); assert.equal(r.statusCode, 200, 'limit is per user');
process.env.AGENT37_BASE_URL = 'https://evil.example.com/v1';
r = await run(post({ input: 'x' }, token())); assert.equal(r.statusCode, 503, 'base URL must match instance host');
console.log('api tests passed');
