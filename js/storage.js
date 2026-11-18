import { CONFIG } from './config.js';
import { firebaseStatus } from './firebase.js';

/** Secure Supabase Storage helper. It requires a Firebase-authenticated signing endpoint. */
async function firebaseToken() {
  const status = firebaseStatus();
  if (!status.enabled || !status.auth?.currentUser) throw new Error('Sign in with Firebase before uploading private travel documents.');
  return status.auth.currentUser.getIdToken();
}
async function requestSignature(action, payload) {
  const endpoint = CONFIG.storage?.signingEndpoint;
  if (!endpoint) throw new Error('Secure file storage is not configured. Add the Firebase signing endpoint in js/config.js.');
  const token = await firebaseToken();
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Storage signing failed (${response.status}).`);
  return data;
}
export async function uploadPrivateFile(file) {
  if (!file) throw new Error('Choose a file first.');
  const allowed = ['application/pdf','image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Allowed file types: PDF, JPG, PNG and WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Files must be 10 MB or smaller.');
  const signed = await requestSignature('create-upload', { fileName: file.name, contentType: file.type, size: file.size });
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const client = createClient(CONFIG.storage.supabaseUrl, CONFIG.storage.anonKey);
  const result = await client.storage.from(CONFIG.storage.bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
  if (result.error) throw result.error;
  return { path: signed.path, name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString() };
}
export async function getPrivateFileUrl(path) {
  const signed = await requestSignature('create-download', { path });
  return signed.signedUrl;
}
