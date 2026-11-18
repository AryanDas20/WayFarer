import { CONFIG } from './config.js';
import { firebaseStatus } from './firebase.js';

/**
 * Agent37 Personal adapter.
 * IMPORTANT: An Agent37 Personal instance ID alone is not a public chat endpoint.
 * This adapter only calls a bridge URL that YOU configure and control, after
 * confirming that your chosen Personal connection method supports it.
 * Never paste a Cloud API key or private credential into this browser module.
 */
function secureBridgeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch { return false; }
}

export function agent37ConnectionStatus() {
  const cfg = CONFIG.agent37 || {};
  if (!cfg.enabled || !cfg.instanceId || !cfg.bridgeUrl) {
    return { connected: false, label: 'Agent37 not connected', detail: 'Add your instance ID and a documented secure bridge URL to js/config.js.' };
  }
  if (!secureBridgeUrl(cfg.bridgeUrl)) {
    return { connected: false, label: 'Unsafe bridge URL', detail: 'The Agent37 bridge must use HTTPS (localhost is allowed for local development). No token will be sent.' };
  }
  return { connected: true, label: 'Agent37 bridge configured', detail: 'Connection will be verified when a message is sent.' };
}

export async function sendToAgent37({ message, conversation = [], profile = {}, trip = null, tools = [] }) {
  const cfg = CONFIG.agent37 || {};
  if (!cfg.enabled || !cfg.instanceId || !cfg.bridgeUrl) throw new Error('Agent37 Personal bridge is not configured.');
  if (!secureBridgeUrl(cfg.bridgeUrl)) throw new Error('Refusing to send your Firebase sign-in token to a non-HTTPS Agent37 bridge.');
  const firebase = firebaseStatus();
  const signedInUser = firebase.auth?.currentUser;
  if (!signedInUser) throw new Error('Sign in with your Firebase account before using the private Agent37 bridge.');
  const idToken = await signedInUser.getIdToken();
  const response = await fetch(cfg.bridgeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      instanceId: cfg.instanceId,
      message,
      conversation,
      travellerProfile: profile,
      currentTrip: trip,
      availableTools: tools,
      product: 'WAYFARER AI'
    })
  });
  if (!response.ok) throw new Error(`Agent37 bridge returned ${response.status}.`);
  const payload = await response.json();
  if (!payload || typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('Agent37 bridge returned an invalid response.');
  return { source: 'agent37', reply: payload.reply, actions: Array.isArray(payload.actions) ? payload.actions : [] };
}
