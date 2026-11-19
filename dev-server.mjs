import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !match[1].startsWith('#') && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
const [agentModule, firebaseModule] = await Promise.all([
  import('./api/agent37.js'),
  import('./api/firebase-config.js')
]);
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' };

function addVercelResponseHelpers(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = payload => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
    return res;
  };
}

http.createServer(async (req, res) => {
  try {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    if (raw === '/api/firebase-config' || raw === '/api/agent37') {
      addVercelResponseHelpers(res);
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 30_000) { res.status(413).json({ error: 'Request too large.' }); return; }
        }
        try { req.body = body ? JSON.parse(body) : {}; }
        catch { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
      }
      const handler = raw === '/api/firebase-config' ? firebaseModule.default : agentModule.default;
      await handler(req, res);
      return;
    }
    const rel = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type':'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
      res.end(data);
    });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal server error');
  }
}).listen(port, () => console.log(`WAYFARER AI running at http://localhost:${port}`));
