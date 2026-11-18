const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

if (!admin.apps.length) admin.initializeApp();

const SUPABASE_SERVICE_ROLE_KEY = defineSecret('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_URL = defineString('SUPABASE_URL');
const SUPABASE_BUCKET = defineString('SUPABASE_BUCKET', { default: 'wayfarer-private' });
const APP_ORIGIN = defineString('APP_ORIGIN', { default: 'http://localhost:8080' });

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 10 * 1024 * 1024;

function cleanFileName(name) {
  return String(name || 'document').normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90) || 'document';
}
function cors(req, res) {
  const origin = req.get('origin');
  const allowed = APP_ORIGIN.value();
  if (origin && (origin === allowed || allowed === '*')) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}
function supabaseAdmin() {
  const url = SUPABASE_URL.value();
  const key = SUPABASE_SERVICE_ROLE_KEY.value();
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

exports.storageSign = onRequest({ region: 'asia-south1', secrets: [SUPABASE_SERVICE_ROLE_KEY], cors: false }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const authHeader = req.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Firebase ID token required.' });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const { action } = req.body || {};
    const supabase = supabaseAdmin();
    const bucket = SUPABASE_BUCKET.value();

    if (action === 'create-upload') {
      const { fileName, contentType, size } = req.body || {};
      if (!allowedTypes.has(contentType)) return res.status(400).json({ error: 'Unsupported file type.' });
      if (!Number.isInteger(size) || size < 1 || size > maxBytes) return res.status(400).json({ error: 'File must be 10 MB or smaller.' });
      const path = `uploads/${decoded.uid}/${Date.now()}-${cleanFileName(fileName)}`;
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return res.status(200).json({ path, token: data.token, signedUrl: data.signedUrl });
    }

    if (action === 'create-download') {
      const path = String(req.body?.path || '');
      if (!path.startsWith(`uploads/${decoded.uid}/`) || path.includes('..')) return res.status(403).json({ error: 'You can only access your own files.' });
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (error) throw error;
      return res.status(200).json({ signedUrl: data.signedUrl, expiresIn: 60 });
    }

    return res.status(400).json({ error: 'Unknown storage action.' });
  } catch (error) {
    console.error('storageSign error:', error);
    return res.status(500).json({ error: 'Storage request failed.', detail: error.message });
  }
});
