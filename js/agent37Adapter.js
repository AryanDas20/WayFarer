import { firebaseStatus } from './firebase.js';

let serverStatus = {
  connected: false,
  label: 'Checking Agent37 Cloud',
  detail: 'Checking the secure Vercel API configuration.'
};

export async function refreshAgent37Status() {
  try {
    const response = await fetch('/api/agent37', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    serverStatus = payload.configured
      ? { connected: true, label: 'Agent37 Cloud configured', detail: `Server-side Agent37 Cloud credentials are configured for instance ${payload.instanceId}. The live gateway is verified when you send a message.` }
      : { connected: false, label: 'Agent37 Cloud not configured', detail: payload.error || 'Add the three AGENT37_* variables in Vercel and redeploy.' };
  } catch (error) {
    serverStatus = { connected: false, label: 'Agent37 status unavailable', detail: `Could not check the Vercel API route: ${error.message}` };
  }
  return serverStatus;
}

export function agent37ConnectionStatus() {
  return serverStatus;
}

function sessionStorageKey() {
  const uid = firebaseStatus().auth?.currentUser?.uid || 'signed-out';
  return `wayfarer-agent37-session-${uid}`;
}

function parseSseFrame(frame) {
  if (!frame || frame.startsWith(':')) return null;
  const event = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
  const dataLine = frame.split(/\r?\n/).find(line => line.startsWith('data:'));
  if (!event || !dataLine) return null;
  try { return { event, data: JSON.parse(dataLine.slice(5).trim()) }; }
  catch { return null; }
}

export async function sendToAgent37({ message, profile = {}, trip = null }) {
  const firebase = firebaseStatus();
  const user = firebase.auth?.currentUser;
  if (!user) throw new Error('Sign in with your Firebase account before using Agent37.');
  const idToken = await user.getIdToken();
  const key = sessionStorageKey();
  const sessionId = sessionStorage.getItem(key) || '';
  const context = [
    'You are the WAYFARER AI travel concierge. Be honest, practical, and clear.',
    'Do not invent flight or hotel prices, availability, reservations, bookings, or completed actions.',
    'WAYFARER AI currently opens external providers for flight and hotel searches; it does not execute supplier bookings.',
    `Traveller profile (user-provided): ${JSON.stringify(profile || {})}`,
    trip ? `Current saved trip: ${JSON.stringify(trip)}` : 'No current trip is selected.',
    `User message: ${message}`
  ].join('\n\n');

  const response = await fetch('/api/agent37', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ input: context, ...(sessionId ? { session_id: sessionId } : {}) })
  });
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch {}
    const detail = payload.detail ? ` ${payload.detail}` : '';
    throw new Error(`${payload.error || `Agent37 request failed (${response.status}).`}${detail}`);
  }
  if (!response.body) throw new Error('Agent37 did not return a response stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';
  let nextSessionId = sessionId;
  let terminalError = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;
      if (parsed.event === 'response.created' && parsed.data.session_id) nextSessionId = parsed.data.session_id;
      if (parsed.event === 'response.output_text.delta' && typeof parsed.data.text === 'string') reply += parsed.data.text;
      if (parsed.event === 'response.completed' && typeof parsed.data.output_text === 'string') reply = parsed.data.output_text;
      if (parsed.event === 'response.failed') terminalError = parsed.data.error?.message || 'The Agent37 task failed.';
    }
  }
  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed?.event === 'response.created' && parsed.data.session_id) nextSessionId = parsed.data.session_id;
    if (parsed?.event === 'response.completed' && typeof parsed.data.output_text === 'string') reply = parsed.data.output_text;
    if (parsed?.event === 'response.failed') terminalError = parsed.data.error?.message || 'The Agent37 task failed.';
  }
  if (nextSessionId) sessionStorage.setItem(key, nextSessionId);
  if (terminalError) throw new Error(terminalError);
  if (!reply.trim()) throw new Error('Agent37 completed without a text reply.');
  return { source: 'agent37-cloud', reply, actions: [], sessionId: nextSessionId };
}
