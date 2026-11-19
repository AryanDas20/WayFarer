import { firebaseStatus } from './firebase.js';
import { buildPrompt, extractPlan } from './plan.js';

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

export function clearAgent37Session() { try { sessionStorage.removeItem(sessionStorageKey()); } catch { /* ignore */ } }

export async function sendToAgent37({ message, profile = {}, trip = null, raw = false }) {
  const firebase = firebaseStatus();
  const user = firebase.auth?.currentUser;
  if (!user) throw new Error('Sign in with your Firebase account before using Agent37.');
  const idToken = await user.getIdToken();
  const key = sessionStorageKey();
  const sessionId = sessionStorage.getItem(key) || '';
  const input = raw ? message : buildPrompt({ message, profile, trip, firstTurn: !sessionId });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65_000);
  let response;
  try {
    response = await fetch('/api/agent37', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ input, ...(sessionId ? { session_id: sessionId } : {}) })
    });
  } catch (error) {
    clearTimeout(timer);
    throw new Error(error.name === 'AbortError' ? 'The AI took too long to answer. Try again with a shorter request.' : `Network problem: ${error.message}`);
  }
  if (!response.ok) {
    clearTimeout(timer);
    let payload = {}; try { payload = await response.json(); } catch { /* not JSON */ }
    throw new Error(payload.error || `Agent37 request failed (${response.status}).`);
  }
  if (!response.body) { clearTimeout(timer); throw new Error('Agent37 did not return a response stream.'); }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', reply = '', nextSessionId = sessionId, terminalError = '';
  const handle = frame => {
    const parsed = parseSseFrame(frame); if (!parsed) return;
    if (parsed.event === 'response.created' && parsed.data.session_id) nextSessionId = parsed.data.session_id;
    if (parsed.event === 'response.output_text.delta' && typeof parsed.data.text === 'string') reply += parsed.data.text;
    if (parsed.event === 'response.completed' && typeof parsed.data.output_text === 'string') reply = parsed.data.output_text;
    if (parsed.event === 'response.failed') terminalError = parsed.data.error?.message || 'The Agent37 task failed.';
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() || '';
      frames.forEach(handle);
    }
    if (buffer.trim()) handle(buffer);
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'The AI took too long to answer. Try again.' : `The response stream was interrupted: ${error.message}`);
  } finally { clearTimeout(timer); }
  if (nextSessionId) sessionStorage.setItem(key, nextSessionId);
  if (terminalError) throw new Error(terminalError);
  if (!reply.trim()) throw new Error('Agent37 completed without a text reply.');
  const { text, plan, invalid } = extractPlan(reply);
  return { source: 'agent37-cloud', reply: text || reply, plan, planInvalid: invalid, sessionId: nextSessionId };
}
