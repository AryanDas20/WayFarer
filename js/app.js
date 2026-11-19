import { CONFIG } from './config.js';
import { initFirebase, onAuthChange, signInEmail, signUpEmail, signInGoogle, signOutFirebase, firebaseStatus } from './firebase.js';
import { purgeLegacyDemoRecords, setCurrentUser, getCurrentUser, saveItem, listItems, deleteItem, saveProfile, getProfile } from './store.js';
import { agent37ConnectionStatus, sendToAgent37 } from './agent37Adapter.js';
import { TravelProvider } from './providers.js';
import { uploadPrivateFile, getPrivateFileUrl } from './storage.js';
import { normalizeAgentAction, AGENT37_TOOL_NAMES } from './agent37Tools.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const content = $('#pageContent');
const modal = $('#modal');
let currentRoute = 'dashboard';
let profile = null;
let firebaseReady = false;
let livePlaces = [];
let helpMessages = [];
let plannerMessages = [];
let pendingTask = null;

const money = (n, currency = CONFIG.currency || 'INR') => Number.isFinite(Number(n))
  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(n))
  : 'Price not provided';
const dateFmt = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentUser = () => getCurrentUser();

function toast(message, type = 'success') {
  const el = document.createElement('div'); el.className = `toast ${type === 'error' ? 'error' : ''}`; el.textContent = message;
  $('#toastRegion').append(el); setTimeout(() => el.remove(), 4000);
}
function showModal({ eyebrow = 'WAYFARER AI', title, body, actions = [] }) {
  $('#modalEyebrow').textContent = eyebrow; $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body;
  const wrap = $('#modalActions'); wrap.innerHTML = '';
  actions.forEach(action => { const b = document.createElement('button'); b.className = `btn ${action.class || 'btn-outline'}`; b.textContent = action.label; b.addEventListener('click', () => action.onClick?.()); wrap.append(b); });
  modal.showModal();
}
function closeModal() { if (modal.open) modal.close(); }
function pageHead(kicker, title, desc, action = '') { return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p><div class="title-underline"></div></div>${action}</div>`; }
function explainer(title, text) { return `<div class="explain"><span class="info">i</span><div><b>${title}</b><p>${text}</p></div></div>`; }
function emptyState(icon, title, desc, button = '') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${desc}</p>${button}</div>`; }
function statusPill(text, positive = false) { return `<span class="pill ${positive ? '' : 'demo'}">${escapeHTML(text)}</span>`; }
function openExternal(url) { if (!url) return; try { const u = new URL(url); if (u.protocol === 'https:') window.open(u.href, '_blank', 'noopener,noreferrer'); } catch { /* invalid/untrusted URL */ } }
function closeMobileNav() { $('#sidebar').classList.remove('open'); }

function routeTo(route) {
  currentRoute = route; closeMobileNav();
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  const names = { dashboard:'Overview', explore:'Explore destinations', planner:'Trip planner', workspace:'AI Workspace', trips:'My trips', flights:'Flights', hotels:'Stays', experiences:'Experiences', budget:'Budget planner', bookings:'Bookings & documents', history:'AI history', wishlist:'Wishlist', support:'Travel support', settings:'Settings' };
  $('#breadcrumbCurrent').textContent = names[route] || 'Overview';
  renderRoute(route); content.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function renderRoute(route) {
  try {
    switch (route) {
      case 'dashboard': return await renderDashboard();
      case 'explore': return await renderExplore();
      case 'planner': return await renderPlanner();
      case 'workspace': return await renderWorkspace();
      case 'trips': return await renderTrips();
      case 'flights': return await renderCatalog('flights');
      case 'hotels': return await renderCatalog('hotels');
      case 'experiences': return await renderCatalog('experiences');
      case 'budget': return await renderBudget();
      case 'bookings': return await renderBookings();
      case 'history': return await renderHistory();
      case 'wishlist': return await renderWishlist();
      case 'support': return await renderSupport();
      case 'settings': return await renderSettings();
      default: return await renderDashboard();
    }
  } catch (error) {
    console.error(error);
    content.innerHTML = `${pageHead('SOMETHING NEEDS ATTENTION','This page could not load.','No sample results have been substituted.')} ${emptyState('!','Live information unavailable',escapeHTML(error.message))}`;
  }
}

function startVoiceInput(target) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast('Voice input is not supported in this browser.', 'error');
  const recognition = new SpeechRecognition(); recognition.lang = 'en-IN'; recognition.interimResults = false;
  recognition.onresult = event => { target.value = `${target.value ? `${target.value} ` : ''}${event.results?.[0]?.[0]?.transcript || ''}`; target.focus(); };
  recognition.onerror = () => toast('Voice capture did not complete.', 'error'); recognition.start();
}

async function renderDashboard() {
  const [trips, tasks, wishlist] = await Promise.all([listItems('trips'), listItems('tasks'), listItems('wishlist')]);
  const currentTrips = trips.filter(t => !['cancelled','completed'].includes(t.status));
  const budgetTotal = currentTrips.reduce((sum, trip) => sum + Number(trip.budget || 0), 0);
  const ag = agent37ConnectionStatus();
  content.innerHTML = `<section class="dash-hero"><div><p class="eyebrow">YOUR TRAVEL COMMAND CENTRE</p><h2>Travel a little more<br>like you mean it.</h2><p>Live public destination and weather information, external travel search links, and your own plans in one calm workspace.</p><div class="hero-actions"><button class="btn btn-tan" data-route="planner">✳ Plan a journey</button><button class="btn" style="border:1px solid rgba(255,255,255,.5);color:#fff;background:transparent" data-route="explore">Find a destination ↗</button></div></div><div class="hero-visual"><div class="hero-globe">⌖</div></div></section>
    <div class="grid grid-4">
      <div class="card stat-card"><span class="stat-icon">▤</span><div><small>Your trips</small><strong>${trips.length}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">✳</span><div><small>Completed AI tasks</small><strong>${tasks.filter(t=>t.status==='completed').length}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">◎</span><div><small>Trip budgets you set</small><strong>${money(budgetTotal)}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">♡</span><div><small>Saved places</small><strong>${wishlist.length}</strong></div></div>
    </div>
    <div class="section-head"><div><h2>Your journeys</h2><p>Only trips you have created or saved are shown here.</p></div><button class="btn btn-outline btn-small" data-route="trips">View trips ↗</button></div>
    ${currentTrips.length ? `<div class="grid">${currentTrips.slice(0,3).map(tripCard).join('')}</div>` : emptyState('⌖','No trips saved yet','Create a trip with your own dates and destination. The app will not prefill sample itineraries.','<button class="btn btn-primary" data-action="new-trip">Create a trip</button>')}
    <div class="section-head"><div><h2>Travel search partners</h2><p>Open external providers to check current prices and availability.</p></div></div>
    <div class="grid grid-3"><button class="quick-link" data-route="flights"><div><strong>Search flights</strong><small>Opens external flight search providers.</small></div><span>✈</span></button><button class="quick-link" data-route="hotels"><div><strong>Search stays</strong><small>Compare stays on external provider sites.</small></div><span>⌂</span></button><button class="quick-link" data-route="experiences"><div><strong>Find experiences</strong><small>Find activities on external search sites.</small></div><span>◇</span></button></div>
    <div class="grid grid-2" style="margin-top:16px"><div class="card"><p class="eyebrow">AGENT STATUS</p><h3>${ag.connected ? 'Agent bridge configured' : 'Agent37 not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p><button class="btn btn-outline btn-small" data-route="settings">Integration settings ↗</button></div><div class="card"><p class="eyebrow">DATA POLICY</p><h3>No invented travel results</h3><p class="card-sub">WAYFARER never invents fares or hotel prices. External providers show their own live availability and final terms.</p></div></div>`;
}
function tripCard(trip) {
  return `<article class="card trip-card"><div class="trip-cover"></div><div class="trip-data"><span class="pill">${escapeHTML(trip.status || 'draft')}</span><h3>${escapeHTML(trip.title || trip.destination)}</h3><p>${escapeHTML(trip.destination)} · ${dateFmt(trip.startDate)} — ${dateFmt(trip.endDate)}</p><div class="trip-stats"><span>♙ ${Number(trip.travellers || 1)} travellers</span><span>◎ Budget ${trip.budget ? money(trip.budget) : 'not set'}</span><span>◷ ${trip.days?.length || 0} itinerary days</span></div></div><button class="btn btn-primary btn-small" data-open-trip="${escapeHTML(trip.id)}">Open trip ↗</button></article>`;
}

async function renderExplore() {
  content.innerHTML = `${pageHead('LIVE DESTINATION SEARCH','Find your somewhere.','Search real city and place records. This search does not invent prices, match scores or availability.')}
  ${explainer('Where the information comes from','City, country, coordinates and population are retrieved from Open-Meteo Geocoding. No sample destination catalogue is bundled. Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.')}
  <form class="card" id="destinationForm" style="margin-bottom:16px"><div class="form-grid"><div class="field"><label for="destinationSearch">City or destination</label><input class="input" id="destinationSearch" required minlength="2" placeholder="Enter a city name" /></div><div class="field" style="align-self:end"><button class="btn btn-primary" type="submit">Search live places ↗</button></div></div></form>
  <div id="destinationGrid">${emptyState('⌕','Search for a destination','Enter at least two characters to retrieve real place matches.')}</div>`;
  $('#destinationForm').addEventListener('submit', async e => { e.preventDefault(); await searchDestinations($('#destinationSearch').value); });
}
async function searchDestinations(query) {
  const grid = $('#destinationGrid'); if (!grid) return;
  grid.innerHTML = `<div class="card">Searching live place data…</div>`;
  try {
    livePlaces = await TravelProvider.searchDestinations(query);
    grid.innerHTML = livePlaces.length ? `<div class="grid grid-3">${livePlaces.map(destinationCard).join('')}</div>` : emptyState('⌕','No live matches','Try another spelling or a larger city.');
  } catch (error) { grid.innerHTML = emptyState('!','Place search unavailable',escapeHTML(error.message)); }
}
function destinationCard(place) {
  return `<article class="card destination-card"><div class="destination-img"><span class="match-pill">LIVE PLACE DATA</span></div><div class="destination-info"><h3>${escapeHTML(place.name)}</h3><p>${escapeHTML([place.admin1, place.country].filter(Boolean).join(', '))}</p><div class="meta-row"><span>Latitude ${Number(place.latitude).toFixed(3)}</span><span>Longitude ${Number(place.longitude).toFixed(3)}</span></div><p style="margin-top:10px">${place.population ? `Population: ${Number(place.population).toLocaleString('en-IN')}` : 'Population not supplied by source'}</p><small class="muted">Source: ${escapeHTML(place.source)}</small><div class="card-actions"><button class="btn btn-outline btn-small" data-save-place="${escapeHTML(place.id)}">♡ Save place</button><button class="btn btn-primary btn-small" data-plan-place="${escapeHTML(place.id)}">Use in trip ↗</button><button class="btn btn-outline btn-small" data-weather-place="${escapeHTML(place.id)}">Weather</button></div></div></article>`;
}

async function renderPlanner() {
  const status = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('CONVERSATIONAL TRIP PLANNER','Start with what matters.','Talk naturally about your trip. The Agent37 connection is used only when an actual supported bridge is configured.')}
  <div class="chat-layout"><section class="card chat-panel"><div class="chat-panel-head"><div class="assistant-avatar">✳</div><div><h3>Travel Concierge</h3><small>${status.connected ? 'Agent37 bridge configured · connection verified on request' : 'Agent37 Personal not connected to this website'}</small></div>${statusPill(status.connected ? 'BRIDGE CONFIGURED' : 'NOT CONNECTED', false)}</div>
  <div class="chat-scroll" id="plannerMessages">${plannerMessages.map(m=>`<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join('') || `<div class="chat-bubble assistant">I can help organise travel details. You can search live city data and weather, then open external websites to compare flights, stays and activities.</div>`}</div>
  <div class="suggestions"><button data-planner-prompt="What information do you need to plan a trip for me?">What do you need?</button><button data-planner-prompt="Help me compare live flight and hotel options.">Compare travel options</button><button data-planner-prompt="Explain how to save a trip in WAYFARER AI.">How do I save a trip?</button></div>
  <form class="chat-compose" id="plannerForm"><button class="icon-btn" id="plannerVoice" type="button" aria-label="Use voice input">⌁</button><input id="plannerInput" placeholder="Ask your travel concierge…" autocomplete="off"><button type="submit" aria-label="Send message">↑</button></form></section>
  <aside class="grid"><div class="card"><p class="eyebrow">YOUR TRAVEL PROFILE</p><h3>Personal travel preferences</h3><p class="card-sub">Only preferences you provide are stored.</p><div class="divider"></div><div class="budget-row"><span>Home city / airport</span><strong>${escapeHTML(profile?.homeAirport || 'Not provided')}</strong></div><div class="budget-row"><span>Currency</span><strong>${escapeHTML(profile?.currency || 'INR')}</strong></div><div class="budget-row"><span>Interests</span><strong>${escapeHTML((profile?.interests || []).join(', ') || 'Not provided')}</strong></div><button class="btn btn-outline btn-small" style="margin-top:12px" data-route="settings">Edit profile ↗</button></div>
  <div class="card"><p class="eyebrow">TRAVEL DATA</p><h3>Source transparency</h3><p class="card-sub">City and weather information use public data services. Flights, stays and activities open external travel search websites; this app does not show made-up offers or prices.</p></div></aside></div>`;
  $('#plannerForm').addEventListener('submit', async e => { e.preventDefault(); await sendAgentMessage($('#plannerInput').value, 'planner'); });
  $('#plannerVoice').addEventListener('click', () => startVoiceInput($('#plannerInput')));
}
async function sendAgentMessage(message, mode = 'planner') {
  const text = String(message || '').trim(); if (!text) return;
  const state = mode === 'planner' ? plannerMessages : helpMessages;
  state.push({ role: 'user', text });
  const messagesEl = mode === 'planner' ? $('#plannerMessages') : $('#helpMessages');
  if (messagesEl) { messagesEl.innerHTML = state.map(m => `<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join(''); }
  const input = mode === 'planner' ? $('#plannerInput') : $('#helpInput'); if (input) input.value = '';
  if (!agent37ConnectionStatus().connected) {
    const msg = 'Agent37 Personal is not connected to this website yet. The instance ID alone is not an embeddable chat connection. Open Settings → Agent37 Personal and follow the documented integration steps. I have not generated a fake AI response.';
    state.push({ role: 'assistant', text: msg });
  } else {
    try {
      const trips = await listItems('trips');
      const response = await sendToAgent37({ message: text, conversation: state.slice(-12), profile, trip: trips[0] || null, tools: AGENT37_TOOL_NAMES });
      state.push({ role: 'assistant', text: response.reply });
      for (const proposed of response.actions || []) {
        const safe = normalizeAgentAction(proposed);
        if (safe) { await createApprovedAgentTask(text, response.reply, safe); break; }
      }
    } catch (error) {
      state.push({ role: 'assistant', text: `Agent37 request failed: ${error.message}. No AI-generated result or action has been substituted.` });
    }
  }
  const fresh = mode === 'planner' ? $('#plannerMessages') : $('#helpMessages');
  if (fresh) { fresh.innerHTML = state.map(m => `<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join(''); fresh.scrollTop = fresh.scrollHeight; }
}

async function renderWorkspace() {
  const tasks = await listItems('tasks'); const ag = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('YOUR AI COMMAND CENTRE','Tell your agent what to do.','The workspace sends your instruction to the connected Agent37 Personal bridge. Website changes require your approval.')}
  <div class="grid grid-2" style="margin-bottom:16px"><div class="card"><p class="eyebrow">AGENT STATUS</p><h3>${ag.connected ? 'Agent37 bridge configured' : 'Agent37 is not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p>${statusPill(ag.connected ? 'VERIFY ON FIRST REQUEST' : 'NO FAKE FALLBACK', false)} <button class="btn btn-outline btn-small" data-route="settings">Settings ↗</button></div><div class="card"><p class="eyebrow">APPROVAL POLICY</p><h3>You stay in control.</h3><p class="card-sub">Trip creation, trip edits and checklist creation are previewed before the site saves them. This website cannot book or cancel travel inventory without an actual supplier booking integration.</p></div></div>
  <section class="workspace-panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><p class="eyebrow">NATURAL LANGUAGE TASKS</p><h3 style="font:600 27px 'Cormorant Garamond',serif;color:var(--brown);margin:0">Your travel operations desk</h3></div><span class="pill">✳ Agent Workspace</span></div>
  <form id="workspaceForm"><div class="workspace-composer"><textarea id="workspaceInput" placeholder="Example: Create a trip for my chosen destination using the dates and budget I provide…" aria-label="Describe a task"></textarea><div style="display:grid;gap:6px"><button class="icon-btn" id="workspaceVoice" type="button" aria-label="Use voice input">⌁</button><button class="btn btn-primary" type="submit">Send to Agent37 ↗</button></div></div><div class="workspace-tools"><span class="muted" style="font-size:10px">No local demo agent · no simulated tool results</span><span class="muted" style="font-size:10px">Voice input where supported</span></div></form></section>
  <div class="section-head"><div><h2>Execution history</h2><p>Only real messages and user-approved website actions are recorded.</p></div><button class="btn btn-outline btn-small" data-route="history">Full history ↗</button></div>
  ${tasks.length ? `<div class="grid">${tasks.map(taskCard).join('')}</div>` : emptyState('✣','No AI tasks yet','Connect Agent37 Personal and send your first task.')}`;
  $('#workspaceForm').addEventListener('submit', async e => { e.preventDefault(); await createWorkspaceTask($('#workspaceInput').value); });
  $('#workspaceVoice').addEventListener('click', () => startVoiceInput($('#workspaceInput')));
}
function taskCard(task) {
  return `<article class="card" style="padding:15px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="pill">${escapeHTML(task.status)}</span><h3 style="margin-top:8px">${escapeHTML(task.title)}</h3><p class="card-sub">${escapeHTML(task.instruction)}</p><p class="card-sub">${new Date(task.createdAt).toLocaleString('en-IN')}</p></div><button class="btn btn-outline btn-small" data-open-task="${escapeHTML(task.id)}">Inspect ↗</button></div></article>`;
}
async function createWorkspaceTask(instruction) {
  const text = String(instruction || '').trim(); if (!text) return;
  if (!agent37ConnectionStatus().connected) return toast('Agent37 Personal is not connected. No task was fabricated.', 'error');
  try {
    const trips = await listItems('trips');
    const response = await sendToAgent37({ message: `Plan this WAYFARER task. Return at most one structured action from the allowed tools. Do not claim it was executed. User request: ${text}`, conversation: [], profile, trip: trips[0] || null, tools: AGENT37_TOOL_NAMES });
    const normalized = (response.actions || []).map(normalizeAgentAction).find(Boolean) || null;
    const task = { id: id('task'), title: normalized ? `Review ${normalized.name.replaceAll('_',' ')}` : 'Agent37 response', instruction: text, reply: response.reply, status: normalized ? 'awaiting-approval' : 'completed', action: normalized, source: 'Agent37 Personal bridge', createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: normalized ? 'Agent37 proposed an allowlisted action; waiting for your approval.' : 'Agent37 replied; no website changes were proposed.' }] };
    await saveItem('tasks', task);
    if (normalized) { pendingTask = task; showTaskApproval(task); }
    else showModal({ eyebrow: 'AGENT37 RESPONSE', title: 'Your agent replied', body: `<p>${escapeHTML(response.reply)}</p><p class="card-sub">No website action was requested or executed.</p>`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] });
    if (currentRoute === 'workspace') renderWorkspace();
  } catch (error) { toast(`Agent task failed: ${error.message}`, 'error'); }
}
async function createApprovedAgentTask(instruction, reply, action) {
  const task = { id: id('task'), title: `Review ${action.name.replaceAll('_',' ')}`, instruction, reply, status: 'awaiting-approval', action, source: 'Agent37 Personal bridge', createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: 'Agent37 proposed an allowlisted action; waiting for user approval.' }] };
  await saveItem('tasks', task); pendingTask = task; showTaskApproval(task);
}
function showTaskApproval(task) {
  const action = task.action;
  let summary = '', before = 'No change applied', after = '';
  if (action.name === 'create_trip') { summary = `Create a trip to ${action.args.destination} for ${action.args.travelers} traveller(s).`; after = `${action.args.startDate} to ${action.args.endDate} · ${action.args.budget === null ? 'Budget not set' : money(action.args.budget)}`; }
  if (action.name === 'update_trip') { summary = `Update trip ${action.args.tripId} with the proposed fields.`; after = JSON.stringify(action.args.changes, null, 2); }
  if (action.name === 'create_packing_checklist') { summary = `Create a checklist with ${action.args.items.length} AI-suggested items.`; after = action.args.items.join('\n'); }
  showModal({ eyebrow: 'AI PROPOSAL · APPROVAL REQUIRED', title: task.title, body: `<p>${escapeHTML(task.reply)}</p><div class="approval-card"><p class="eyebrow">PROPOSED ACTION</p><p>${escapeHTML(summary)}</p><p class="eyebrow">CURRENT STATE</p><p>${escapeHTML(before)}</p><p class="eyebrow">PROPOSED STATE</p><pre style="white-space:pre-wrap;font:12px Poppins">${escapeHTML(after)}</pre><p class="card-sub">Nothing has been changed. Only this listed action will run if you confirm.</p></div>`, actions: [
    { label: 'Reject', class: 'btn-outline', onClick: async () => { await finishTask(task, 'rejected', 'User rejected the proposed action. No change applied.'); closeModal(); if (currentRoute === 'workspace') renderWorkspace(); } },
    { label: 'Confirm and apply', class: 'btn-primary', onClick: async () => { await applyAgentAction(task); closeModal(); } }
  ] });
}
async function finishTask(task, status, event) {
  task.status = status; task.completedAt = new Date().toISOString(); task.log = [...(task.log || []), { at: new Date().toISOString(), event }]; await saveItem('tasks', task);
}
async function applyAgentAction(task) {
  try {
    const { name, args } = task.action;
    if (name === 'create_trip') {
      const trip = { id: id('trip'), title: args.title || `Trip to ${args.destination}`, destination: args.destination, origin: args.origin, startDate: args.startDate, endDate: args.endDate, travellers: args.travelers, budget: args.budget, estimatedCost: null, status: 'draft', days: [], bookings: [], createdAt: new Date().toISOString() };
      await saveItem('trips', trip);
    } else if (name === 'update_trip') {
      const trips = await listItems('trips'); const trip = trips.find(t => t.id === args.tripId);
      if (!trip) throw new Error('The requested trip was not found in your account.');
      const updated = { ...trip, ...args.changes };
      if (updated.startDate && updated.endDate && updated.endDate < updated.startDate) throw new Error('The end date cannot be before the start date.');
      await saveItem('trips', updated);
    } else if (name === 'create_packing_checklist') {
      await saveItem('documents', { id: id('checklist'), title: args.title, kind: 'packing-checklist', aiSuggested: true, items: args.items.map(value => ({ text: value, done: false })), createdAt: new Date().toISOString() });
    }
    await finishTask(task, 'completed', `User approved ${name}; the website saved the change and recorded the result.`);
    await saveItem('notifications', { id: id('notification'), title: 'Approved AI action saved', body: task.title, type: 'success', createdAt: new Date().toISOString() });
    toast('Approved change saved.');
    if (currentRoute === 'workspace') renderWorkspace();
  } catch (error) { await finishTask(task, 'failed', error.message); toast(error.message, 'error'); }
}
async function renderTrips() {
  const trips = await listItems('trips');
  content.innerHTML = `${pageHead('YOUR TRAVEL COLLECTION','Your journeys, in one place.','Only trips you create or import are displayed. No example trips are inserted.','<button class="btn btn-primary" data-action="new-trip">＋ Create trip</button>')}
  ${trips.length ? `<div class="grid">${trips.map(tripCard).join('')}</div>` : emptyState('▤','No journeys yet','Create a trip using your real dates, destination and traveller details.','<button class="btn btn-primary" data-action="new-trip">Create your first trip</button>')}`;
}
function showNewTripForm() {
  showModal({ eyebrow: 'YOUR TRIP DETAILS', title: 'Create a trip', body: `<form id="newTripForm"><div class="field"><label for="newTripDestination">Destination</label><input class="input" id="newTripDestination" required placeholder="City, country"></div><div class="field" style="margin-top:10px"><label for="newTripOrigin">Departure city / airport</label><input class="input" id="newTripOrigin" placeholder="Optional"></div><div class="form-grid" style="margin-top:10px"><div class="field"><label for="newTripStart">Start date</label><input class="input" type="date" id="newTripStart" required></div><div class="field"><label for="newTripEnd">End date</label><input class="input" type="date" id="newTripEnd" required></div></div><div class="form-grid" style="margin-top:10px"><div class="field"><label for="newTripTravellers">Travellers</label><input class="input" type="number" id="newTripTravellers" min="1" max="20" value="1" required></div><div class="field"><label for="newTripBudget">Your total budget (optional)</label><input class="input" type="number" id="newTripBudget" min="0" step="1" placeholder="Leave blank if unknown"></div></div><p class="card-sub">This creates an empty trip record. No hotels, activities or costs are added unless they are retrieved from a live provider or entered by you.</p><button class="btn btn-primary" type="submit">Save trip</button></form>`, actions: [{ label: 'Cancel', class: 'btn-outline', onClick: closeModal }] });
  $('#newTripForm').addEventListener('submit', async e => {
    e.preventDefault();
    const startDate = $('#newTripStart').value, endDate = $('#newTripEnd').value;
    if (endDate < startDate) return toast('End date must be after start date.', 'error');
    const budgetValue = $('#newTripBudget').value;
    const trip = { id: id('trip'), title: `Trip to ${$('#newTripDestination').value.trim()}`, destination: $('#newTripDestination').value.trim(), origin: $('#newTripOrigin').value.trim(), startDate, endDate, travellers: Number($('#newTripTravellers').value), budget: budgetValue ? Number(budgetValue) : null, estimatedCost: null, status: 'draft', days: [], bookings: [], createdAt: new Date().toISOString() };
    await saveItem('trips', trip); closeModal(); toast('Your trip was saved.'); routeTo('trips');
  });
}
async function openTrip(tripId) {
  const trip = (await listItems('trips')).find(t => t.id === tripId); if (!trip) return toast('Trip not found.', 'error');
  const days = trip.days || [];
  showModal({ eyebrow: 'YOUR TRIP RECORD', title: trip.title || trip.destination, body: `<span class="pill">${escapeHTML(trip.status || 'draft')}</span><p>${escapeHTML(trip.origin || 'Origin not set')} → ${escapeHTML(trip.destination)} · ${dateFmt(trip.startDate)} — ${dateFmt(trip.endDate)}</p><div class="grid grid-2"><div class="card"><p class="eyebrow">YOUR BUDGET</p><h3>${trip.budget === null || trip.budget === undefined ? 'Not set' : money(trip.budget)}</h3></div><div class="card"><p class="eyebrow">TRAVELLERS</p><h3>${Number(trip.travellers || 1)}</h3></div></div><h3 style="margin:16px 0 8px">Itinerary</h3>${days.length ? days.map(day => `<div class="task-step"><span class="step-number">${Number(day.day || 1)}</span><div><strong>${dateFmt(day.date)}</strong><p>${escapeHTML(day.title || day.note || 'No activity details saved')}</p></div></div>`).join('') : '<p class="card-sub">No itinerary items have been saved. Use verified experience results or add your own notes.</p>'}<h3 style="margin:16px 0 8px">Bookings</h3>${(trip.bookings || []).length ? trip.bookings.map(b => `<div class="budget-row"><span>${escapeHTML(b.name || b.supplier)} · ${escapeHTML(b.reference || '')}</span><strong>${b.amount ? money(b.amount, b.currency || 'INR') : 'Amount not recorded'}</strong></div>`).join('') : '<p class="card-sub">No booking records linked to this trip.</p>'}`, actions: [
    { label: 'Open map', class: 'btn-outline', onClick: () => openExternal(`https://www.openstreetmap.org/search?query=${encodeURIComponent(trip.destination)}`) },
    { label: 'Calendar export', class: 'btn-outline', onClick: () => downloadTripCalendar(trip) },
    { label: 'Ask Agent37 to update', class: 'btn-outline', onClick: () => { closeModal(); routeTo('workspace'); $('#workspaceInput')?.focus(); } },
    { label: 'Close', class: 'btn-primary', onClick: closeModal }
  ] });
}
function downloadTripCalendar(trip) {
  const escapeIcs = value => String(value || '').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const events = (trip.days || []).filter(day => day.date).map(day => {
    const start = String(day.date).replace(/-/g,''); const endDate = new Date(`${day.date}T00:00:00`); endDate.setDate(endDate.getDate()+1);
    const end = endDate.toISOString().slice(0,10).replace(/-/g,'');
    return `BEGIN:VEVENT\r\nUID:${escapeIcs(trip.id)}-${day.day}@wayfarer.ai\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${escapeIcs(day.title || `${trip.destination} · Day ${day.day}`)}\r\nEND:VEVENT`;
  }).join('\r\n');
  if (!events) return toast('Add dated itinerary items before exporting a calendar.', 'error');
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WAYFARER AI//Trip Calendar//EN\r\n${events}\r\nEND:VCALENDAR`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${String(trip.title || 'wayfarer-trip').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.ics`; a.click(); URL.revokeObjectURL(url);
}

async function renderCatalog(kind) {
  const title = kind === 'flights'
    ? ['FLIGHT SEARCH','Compare routes on trusted travel sites.','WAYFARER prepares your search and opens an external travel provider. Prices and availability are shown by that provider, not inside this app.']
    : kind === 'hotels'
      ? ['STAY SEARCH','Find a place to stay.','Search external hotel providers with your destination, dates and traveller count. Check the final price and cancellation terms on the provider website.']
      : ['EXPERIENCE SEARCH','Find things to do at your destination.','Explore activities on external websites. WAYFARER does not claim these listings or prices are verified.'];
  let fields = '';
  if (kind === 'flights') fields = `<div class="form-grid"><div class="field"><label for="flightOrigin">From city / airport</label><input class="input" id="flightOrigin" required maxlength="80" placeholder="e.g. Delhi or DEL"></div><div class="field"><label for="flightDestination">To city / airport</label><input class="input" id="flightDestination" required maxlength="80" placeholder="e.g. Mumbai or BOM"></div><div class="field"><label for="flightDepart">Departure</label><input class="input" type="date" id="flightDepart" required></div><div class="field"><label for="flightReturn">Return (optional)</label><input class="input" type="date" id="flightReturn"></div><div class="field"><label for="flightAdults">Adults</label><input class="input" type="number" id="flightAdults" min="1" max="9" value="1" required></div></div>`;
  if (kind === 'hotels') fields = `<div class="form-grid"><div class="field"><label for="hotelCity">City or destination</label><input class="input" id="hotelCity" required maxlength="80" placeholder="e.g. Jaipur"></div><div class="field"><label for="hotelCheckin">Check-in</label><input class="input" type="date" id="hotelCheckin" required></div><div class="field"><label for="hotelCheckout">Check-out</label><input class="input" type="date" id="hotelCheckout" required></div><div class="field"><label for="hotelAdults">Adults</label><input class="input" type="number" id="hotelAdults" min="1" max="9" value="1" required></div></div>`;
  if (kind === 'experiences') fields = `<div class="form-grid"><div class="field"><label for="activityCity">City or destination</label><input class="input" id="activityCity" required maxlength="80" placeholder="e.g. Manali"></div><div class="field"><label for="activityType">What interests you?</label><select class="select" id="activityType"><option value="things to do">All experiences</option><option>adventure activities</option><option>guided tours</option><option>food experiences</option><option>museum and culture tours</option><option>family activities</option></select></div></div>`;
  content.innerHTML = `${pageHead(...title)}${explainer('How this search works','This free version does not have a connected airline or hotel inventory API. It builds useful search links to external providers. Open a provider to see its current availability, prices, taxes and policies. No fake offers or prices are generated.')}<form class="card" id="providerSearchForm" style="margin-bottom:14px">${fields}<button class="btn btn-primary" type="submit" style="margin-top:14px">Open travel search ↗</button></form><div id="catalogList">${emptyState('⌕','Ready to search','Enter your details above. Your search will open on an external travel website.')}</div>`;
  $('#providerSearchForm').addEventListener('submit', async e => { e.preventDefault(); runCatalogSearch(kind); });
  const minDate = new Date().toISOString().slice(0,10);
  content.querySelectorAll('input[type="date"]').forEach(input => { input.min = minDate; });
}

function externalSearchCard(title, description, url, provider) {
  return `<article class="card catalog-card"><div><span class="pill">EXTERNAL PROVIDER</span><h4>${escapeHTML(title)}</h4><p>${escapeHTML(description)}</p><small class="muted">Prices, availability and policies are controlled by ${escapeHTML(provider)}.</small></div><div class="right"><a class="btn btn-primary btn-small" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Open search ↗</a></div></article>`;
}

function runCatalogSearch(kind) {
  const list = $('#catalogList');
  const today = new Date().toISOString().slice(0,10);
  const results = [];
  if (kind === 'flights') {
    const origin = $('#flightOrigin').value.trim(); const destination = $('#flightDestination').value.trim();
    const depart = $('#flightDepart').value; const ret = $('#flightReturn').value; const adults = Number($('#flightAdults').value);
    if (!origin || !destination || !depart || depart < today || (ret && ret <= depart) || !Number.isInteger(adults) || adults < 1 || adults > 9) return toast('Check your cities, dates and traveller count.', 'error');
    const query = `Flights from ${origin} to ${destination} on ${depart}${ret ? ` returning ${ret}` : ''} for ${adults} adult${adults === 1 ? '' : 's'}`;
    results.push(externalSearchCard('Google Flights', query, `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`, 'Google Flights'));
    results.push(externalSearchCard('Search flights on Skyscanner', query, `https://www.skyscanner.co.in/transport/flights/${encodeURIComponent(origin.toLowerCase())}/${encodeURIComponent(destination.toLowerCase())}/${depart.replaceAll('-','').slice(2)}${ret ? `/${ret.replaceAll('-','').slice(2)}` : ''}/?adultsv2=${adults}&currency=INR`, 'Skyscanner'));
  } else if (kind === 'hotels') {
    const city = $('#hotelCity').value.trim(); const checkin = $('#hotelCheckin').value; const checkout = $('#hotelCheckout').value; const adults = Number($('#hotelAdults').value);
    if (!city || !checkin || !checkout || checkin < today || checkout <= checkin || !Number.isInteger(adults) || adults < 1 || adults > 9) return toast('Check the destination, stay dates and traveller count.', 'error');
    const query = `Hotels in ${city} from ${checkin} to ${checkout} for ${adults} adults`;
    const booking = new URL('https://www.booking.com/searchresults.html'); booking.search = new URLSearchParams({ ss: city, checkin, checkout, group_adults: String(adults), no_rooms: '1', group_children: '0' }).toString();
    results.push(externalSearchCard('Google hotel search', query, `https://www.google.com/travel/search?q=${encodeURIComponent(query)}`, 'Google'));
    results.push(externalSearchCard('Search on Booking.com', query, booking.href, 'Booking.com'));
  } else {
    const city = $('#activityCity').value.trim(); const type = $('#activityType').value;
    if (!city) return toast('Enter a destination first.', 'error');
    const query = `${type} in ${city}`;
    results.push(externalSearchCard('Search experiences on Google', query, `https://www.google.com/search?q=${encodeURIComponent(query)}`, 'Google'));
    results.push(externalSearchCard('Search activities on GetYourGuide', query, `https://www.getyourguide.com/s/?q=${encodeURIComponent(`${type} ${city}`)}`, 'GetYourGuide'));
  }
  list.innerHTML = `<div class="section-head"><div><h2>Choose a search provider</h2><p>Your search details have been added. Check final terms before booking.</p></div>${statusPill('EXTERNAL SEARCH', false)}</div><div class="grid">${results.join('')}</div><p class="card-sub" style="margin-top:12px">WAYFARER AI does not receive a live quote from these websites and cannot confirm, change or cancel reservations made there.</p>`;
}

async function renderBudget() {
  const trips = await listItems('trips'); const trip = trips.find(t => t.status !== 'cancelled') || trips[0];
  if (!trip) { content.innerHTML = `${pageHead('TRAVEL COST CLARITY','Know what is confirmed.','Budget values come from costs and estimates that you enter yourself.')}${emptyState('◎','No trip to review','Create a trip and record real costs to see a budget summary.','<button class="btn btn-primary" data-action="new-trip">Create a trip</button>')}`; return; }
  const costs = (trip.costs || []).filter(c => Number.isFinite(Number(c.amount)));
  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  content.innerHTML = `${pageHead('TRAVEL COST CLARITY','Your real trip costs.','This view totals only costs recorded by you or returned by a travel provider.')}
  <div class="grid grid-2"><div class="card"><p class="eyebrow">RECORDED COST TOTAL</p><h3 style="font-size:42px">${money(total)}</h3><p class="card-sub">${costs.length} recorded items · ${trip.budget ? `Your budget: ${money(trip.budget)}` : 'No budget entered'}</p>${trip.budget ? `<div class="budget-track"><span style="width:${Math.min(100, total / trip.budget * 100)}%"></span></div><div class="budget-row"><span>Recorded budget share</span><strong>${Math.round(total / trip.budget * 100)}%</strong></div>` : ''}</div><div class="card"><p class="eyebrow">COST BREAKDOWN</p>${costs.length ? costs.map(c => `<div class="budget-row"><span>${escapeHTML(c.label || c.type)}</span><strong>${money(c.amount, c.currency || 'INR')}</strong></div>`).join('') : '<p class="card-sub">No costs have been recorded. WAYFARER will not estimate category splits from fabricated percentages.</p>'}</div></div>`;
}

async function renderBookings() {
  const trips = await listItems('trips'); const bookings = trips.flatMap(t => (t.bookings || []).map(b => ({ ...b, tripTitle: t.title || t.destination, tripId: t.id })));
  const docs = (await listItems('documents')).filter(d => d.kind === 'upload');
  content.innerHTML = `${pageHead('YOUR TRAVEL PAPERWORK','Keep confirmations together.','This page contains only booking details you entered or documents you uploaded. WAYFARER does not pretend to book with a supplier.')}
  ${bookings.length ? `<div class="grid">${bookings.map(b => `<article class="card catalog-card"><div><span class="pill">USER-RECORDED</span><h4>${escapeHTML(b.name || b.supplier || 'Booking')}</h4><p>${escapeHTML(b.tripTitle)} · ${escapeHTML(b.reference || 'Reference not entered')}</p><small class="muted">${escapeHTML(b.type || 'Booking')} · ${escapeHTML(b.status || 'Recorded by user')}</small></div><div class="right">${b.amount ? money(b.amount, b.currency || 'INR') : 'Amount not entered'}</div></article>`).join('')}</div>` : emptyState('▣','No booking records','Enter information from a real confirmation or upload the supplier voucher.')}
  <div class="section-head"><div><h2>Documents</h2><p>Private vouchers and confirmations you upload.</p></div></div>
  <form class="card" id="documentUploadForm" style="margin-bottom:13px"><p class="eyebrow">PRIVATE DOCUMENT STORAGE</p><div class="form-grid"><div class="field"><label for="travelFile">Choose a PDF or image (max 10 MB)</label><input class="input" id="travelFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div><div class="field" style="align-self:end"><button class="btn btn-primary" type="submit">Upload securely</button></div></div><p class="card-sub">Requires Firebase sign-in and the private Supabase Storage signing function.</p></form>
  <div id="documentList" class="grid">${docs.map(d => `<div class="card"><h3>${escapeHTML(d.title || d.name || 'Travel document')}</h3><p class="card-sub">Uploaded ${new Date(d.uploadedAt || d.createdAt).toLocaleDateString('en-IN')}</p>${d.path ? `<button class="btn btn-outline btn-small" data-download-file="${escapeHTML(d.path)}">Open file ↗</button>` : ''}</div>`).join('') || '<div class="card card-sub">No uploaded documents.</div>'}</div>`;
  $('#documentUploadForm').addEventListener('submit', async e => { e.preventDefault(); const file = $('#travelFile').files?.[0]; if (!file) return toast('Choose a file first.', 'error'); try { const uploaded = await uploadPrivateFile(file); await saveItem('documents', { id: id('file'), title: file.name, kind: 'upload', ...uploaded, createdAt: new Date().toISOString() }); toast('Document uploaded.'); renderBookings(); } catch (error) { toast(error.message, 'error'); } });
}

async function renderHistory() {
  const tasks = await listItems('tasks');
  content.innerHTML = `${pageHead('TRANSPARENT AI ACTIVITY','A complete record of actual actions.','AI history is written only when an actual Agent37 response or approved website action is received.')}${tasks.length ? `<div class="grid">${tasks.map(taskCard).join('')}</div>` : emptyState('◷','No AI activity yet','Connect Agent37 and run a task. No placeholder history is generated.')}`;
}
async function inspectTask(taskId) {
  const task = (await listItems('tasks')).find(t => t.id === taskId); if (!task) return;
  if (task.status === 'awaiting-approval') return showTaskApproval(task);
  showModal({ eyebrow: 'AI TASK HISTORY', title: task.title, body: `<span class="pill">${escapeHTML(task.status)}</span><p>${escapeHTML(task.instruction)}</p>${task.reply ? `<h3>Agent reply</h3><p>${escapeHTML(task.reply)}</p>` : ''}<h3>Execution log</h3>${(task.log || []).map(log => `<div class="budget-row"><span>${escapeHTML(log.event)}</span><small>${new Date(log.at).toLocaleString('en-IN')}</small></div>`).join('')}`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] });
}
async function renderWishlist() {
  const saved = await listItems('wishlist');
  livePlaces = saved;
  content.innerHTML = `${pageHead('IDEAS TO RETURN TO','Your saved places.','Saved locations come from live place search results.')}${saved.length ? `<div class="grid grid-3">${saved.map(destinationCard).join('')}</div>` : emptyState('♡','No saved places yet','Search live destinations and save a place you are interested in.','<button class="btn btn-primary" data-route="explore">Search destinations</button>')}`;
}
async function renderSupport() {
  const requests = await listItems('supportRequests');
  content.innerHTML = `${pageHead('TRAVEL SUPPORT','Ask for help.','Submit a support note for your own records. This does not automatically contact a human travel consultant.')}
  <div class="grid grid-2"><form class="card" id="supportForm"><p class="eyebrow">SUPPORT NOTE</p><h3>What do you need help with?</h3><div class="field" style="margin-top:15px"><label for="supportTopic">Topic</label><select class="select" id="supportTopic"><option>Trip planning</option><option>Booking question</option><option>Travel disruption</option><option>Accessibility</option><option>Other</option></select></div><div class="field" style="margin-top:12px"><label for="supportMessage">Details</label><textarea class="textarea" id="supportMessage" required placeholder="Write your request..."></textarea></div><button class="btn btn-primary" type="submit" style="margin-top:13px">Save support note</button></form><div class="card"><p class="eyebrow">STATUS</p><h3>Saved to your account</h3><p class="card-sub">A saved request is not an active support ticket unless you connect a real support team or ticketing system.</p></div></div>
  <div class="section-head"><div><h2>Your saved requests</h2></div></div><div class="grid">${requests.map(r => `<div class="card"><span class="pill">Saved</span><h3>${escapeHTML(r.topic)}</h3><p class="card-sub">${escapeHTML(r.message)}</p><small class="muted">${new Date(r.createdAt).toLocaleString('en-IN')}</small></div>`).join('') || '<div class="card card-sub">No support notes saved.</div>'}</div>`;
  $('#supportForm').addEventListener('submit', async e => { e.preventDefault(); await saveItem('supportRequests', { id: id('support'), topic: $('#supportTopic').value, message: $('#supportMessage').value.trim(), status: 'saved', createdAt: new Date().toISOString() }); toast('Support note saved.'); renderSupport(); });
}

async function renderSettings() {
  const user = currentUser(); profile = await getProfile(); const fb = firebaseStatus(); const ag = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('YOUR ACCOUNT & INTEGRATIONS','Set up your travel workspace.','Connect your own services. Private API secrets never belong in browser configuration.')}
  <div class="grid grid-2"><form class="card" id="profileForm"><p class="eyebrow">TRAVELLER PROFILE</p><h3>Your preferences</h3><div class="form-grid" style="margin-top:15px"><div class="field"><label for="profileName">Display name</label><input class="input" id="profileName" value="${escapeHTML(profile.name || user.displayName)}"></div><div class="field"><label for="profileHome">Home city / airport</label><input class="input" id="profileHome" value="${escapeHTML(profile.homeAirport || '')}" placeholder="Enter your own home city"></div><div class="field"><label for="profileCurrency">Preferred currency</label><select class="select" id="profileCurrency"><option value="INR" ${profile.currency === 'INR' ? 'selected' : ''}>INR</option><option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD</option><option value="EUR" ${profile.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></div><div class="field"><label for="profilePace">Travel pace</label><select class="select" id="profilePace"><option ${profile.pace === 'Balanced' ? 'selected' : ''}>Balanced</option><option ${profile.pace === 'Slow and relaxed' ? 'selected' : ''}>Slow and relaxed</option><option ${profile.pace === 'See it all' ? 'selected' : ''}>See it all</option><option ${profile.pace === 'Adventure-led' ? 'selected' : ''}>Adventure-led</option></select></div></div><div class="field" style="margin-top:13px"><label for="profileInterests">Interests (comma separated)</label><input class="input" id="profileInterests" value="${escapeHTML((profile.interests || []).join(', '))}" placeholder="Enter your interests"></div><button class="btn btn-primary" style="margin-top:15px" type="submit">Save preferences</button></form>
  <div class="grid"><div class="card"><p class="eyebrow">FIREBASE</p><h3>${fb.enabled ? 'Firebase initialized' : 'Firebase not configured'}</h3><p class="card-sub">${fb.enabled ? 'Authentication and Firestore SDK are ready.' : 'Add your Firebase web app configuration to js/config.js.'}</p>${statusPill(fb.enabled ? 'CONFIGURED' : 'NOT CONFIGURED', fb.enabled)}<div class="divider"></div><button class="btn btn-outline btn-small" id="loginBtn">Sign in / create account</button> <button class="btn btn-outline btn-small" id="signOutBtn">Sign out</button></div>
  <div class="card"><p class="eyebrow">FLIGHTS, STAYS & EXPERIENCES</p><h3>External provider search</h3><p class="card-sub">No airline or hotel API key is required. WAYFARER builds search links for Google Flights, Skyscanner, Google Hotels, Booking.com and activity search sites. Prices and availability are checked on those provider websites.</p>${statusPill('NO API KEY REQUIRED', true)}</div>
  <div class="card"><p class="eyebrow">AGENT37 PERSONAL</p><h3>${ag.connected ? 'Bridge configured' : 'Not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p>${statusPill(ag.connected ? 'VERIFY ON USE' : 'INSTANCE ID IS NOT AN API', ag.connected)}<div class="divider"></div><p class="card-sub">Agent37 Personal is a hosted agent. Use only a documented integration method supplied by Agent37. Do not use the Cloud Sandbox API for the Hackyard Personal challenge.</p><button class="btn btn-outline btn-small" id="agentHelp">Integration explanation</button></div>
  <div class="card"><p class="eyebrow">SUPABASE PRIVATE STORAGE</p><h3>${CONFIG.storage?.signingEndpoint ? 'Signing URL configured' : 'File upload not configured'}</h3><p class="card-sub">Optional. Uses a Firebase-verified server function and a private bucket. Firebase Functions deployment may require a billing-enabled plan.</p></div>
  <div class="card"><p class="eyebrow">PUBLIC LIVE DATA</p><h3>Weather and exchange reference</h3><p class="card-sub">Open-Meteo provides forecast data without a key for non-commercial use. Frankfurter provides reference exchange rates, not instant card/cash quotes.</p><button class="btn btn-outline btn-small" data-action="test-public-apis">Test public data sources</button><div id="publicApiTest" class="card-sub" style="margin-top:8px"></div></div></div></div>`;
  $('#profileForm').addEventListener('submit', async e => { e.preventDefault(); profile = await saveProfile({ name: $('#profileName').value.trim(), homeAirport: $('#profileHome').value.trim(), currency: $('#profileCurrency').value, pace: $('#profilePace').value, interests: $('#profileInterests').value.split(',').map(x => x.trim()).filter(Boolean) }); updateUserChrome(); toast('Preferences saved.'); });
  $('#loginBtn').addEventListener('click', showLoginModal);
  $('#signOutBtn').addEventListener('click', async () => { await signOutFirebase(); setCurrentUser(null); updateUserChrome(); toast('Signed out.'); renderSettings(); });
  $('#agentHelp').addEventListener('click', () => showModal({ eyebrow: 'AGENT37 PERSONAL', title: 'What is needed to connect?', body: `<p>Your Agent37 Personal instance name/ID is not enough to connect a third-party web app. The public Personal product describes a hosted agent with its own computer, workspace and task board, but this build has not been given a supported embeddable chat URL or API contract.</p><p>Ask Agent37 support or check your Personal dashboard for an official external integration or webhook. Only then configure the documented endpoint through a secure server bridge.</p><p>Never paste an API secret into js/config.js. This app will keep showing Agent37 as not connected until a real request succeeds.</p>`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] }));
}

async function showLoginModal() {
  showModal({ eyebrow: 'YOUR WAYFARER ACCOUNT', title: 'Sign in or create an account', body: `<form id="authForm"><div class="field"><label for="authEmail">Email</label><input class="input" id="authEmail" type="email" required placeholder="you@example.com"></div><div class="field" style="margin-top:10px"><label for="authPassword">Password</label><input class="input" id="authPassword" type="password" minlength="6" required placeholder="At least 6 characters"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary" type="submit" data-auth-mode="signin">Sign in</button><button class="btn btn-outline" type="submit" data-auth-mode="signup">Create account</button><button class="btn btn-outline" id="googleLogin" type="button">Continue with Google</button></div></form>`, actions: [{ label: 'Close', class: 'btn-outline', onClick: closeModal }] });
  $('#authForm').addEventListener('submit', async e => { e.preventDefault(); const mode = e.submitter?.dataset.authMode || 'signin'; try { const email = $('#authEmail').value, password = $('#authPassword').value; const result = mode === 'signup' ? await signUpEmail(email, password) : await signInEmail(email, password); setCurrentUser(result.user); closeModal(); updateUserChrome(); toast('Signed in.'); routeTo('dashboard'); } catch (error) { toast(error.message, 'error'); } });
  $('#googleLogin').addEventListener('click', async () => { try { const result = await signInGoogle(); setCurrentUser(result.user); closeModal(); updateUserChrome(); routeTo('dashboard'); } catch (error) { toast(error.message, 'error'); } });
}

async function handleDestinationSave(placeId) {
  const place = livePlaces.find(p => p.id === placeId); if (!place) return toast('Live place result is no longer available. Search again.', 'error');
  const saved = await listItems('wishlist'); if (saved.some(s => s.id === place.id)) return toast('This place is already saved.');
  await saveItem('wishlist', { ...place, savedAt: new Date().toISOString() }); toast('Place saved.');
}
function planDestination(placeId) {
  const place = livePlaces.find(p => p.id === placeId); if (!place) return;
  routeTo('trips'); showNewTripForm();
  setTimeout(() => { const field = $('#newTripDestination'); if (field) field.value = `${place.name}, ${place.country}`; }, 0);
}
async function showPlaceWeather(placeId) {
  const place = livePlaces.find(p => p.id === placeId) || (await listItems('wishlist')).find(p => p.id === placeId);
  if (!place) return toast('Place details not found.', 'error');
  try {
    const weather = await TravelProvider.weather(place.latitude, place.longitude);
    const current = weather.current || {};
    const daily = weather.daily || {};
    showModal({ eyebrow: 'LIVE WEATHER', title: `${place.name} weather`, body: `<div class="approval-card"><h3>${current.temperature_2m ?? '—'}°C</h3><p>Feels like ${current.apparent_temperature ?? '—'}°C · Wind ${current.wind_speed_10m ?? '—'} km/h · Humidity ${current.relative_humidity_2m ?? '—'}%</p></div><p class="card-sub">Forecast for ${daily.time?.[0] || ''} onward. Source: Open-Meteo. Weather can change; re-check before travel.</p><small class="muted">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> · CC BY 4.0</small>`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] });
  } catch (error) { toast(error.message, 'error'); }
}

async function sendHelpMessage(message) {
  const text = String(message || '').trim(); if (!text) return;
  helpMessages.push({ role: 'user', text }); $('#helpInput').value = ''; renderHelpMessages();
  if (agent37ConnectionStatus().connected) {
    try { const reply = await sendToAgent37({ message: `Answer this question about the WAYFARER AI website. Current page: ${currentRoute}. Do not claim an action was performed. Question: ${text}`, conversation: helpMessages.slice(-10), profile, tools: [] }); helpMessages.push({ role: 'assistant', text: reply.reply }); }
    catch (error) { helpMessages.push({ role: 'assistant', text: `Agent37 is unavailable: ${error.message}. No generated response was substituted. You can use the navigation menu or the setup guide in Settings.` }); }
  } else helpMessages.push({ role: 'assistant', text: websiteHelp(text) });
  renderHelpMessages();
}
function websiteHelp(message) {
  const q = message.toLowerCase();
  if (/workspace|agent|automation/.test(q)) return 'Open AI Workspace in the sidebar. It sends your instruction to Agent37 Personal when a verified bridge is configured. Any website changes must be reviewed and approved before they are saved.';
  if (/trip|itinerary|planner/.test(q)) return 'Open My Trips to create a trip record with your own destination and dates. The Trip Planner page can send natural-language questions to Agent37 when connected.';
  if (/flight/.test(q)) return 'Open Flights, enter origin, destination, dates and traveller count, then choose an external provider. WAYFARER does not fetch or guarantee live fares; check the final price and rules on the provider website.';
  if (/hotel|stay/.test(q)) return 'Open Stays, enter a city and check-in/check-out dates, then open Google Hotels or Booking.com to check current prices and availability.';
  if (/activity|experience/.test(q)) return 'Open Experiences and search by city. Activity listings and available supplier links are returned by the connected provider.';
  if (/voucher|document|booking/.test(q)) return 'Open Bookings & Documents to upload real confirmations and vouchers. WAYFARER does not fabricate booking references or claim that it booked with a supplier.';
  if (/weather/.test(q)) return 'Search a destination in Explore and select Weather. The app retrieves a current forecast from Open-Meteo.';
  if (/currency|exchange/.test(q)) return 'Currency reference rates are available through the Frankfurter public service. These are reference rates, not live bank/card exchange quotes.';
  if (/history/.test(q)) return 'Open AI History to view actual Agent37 responses and approved website actions.';
  if (/setting|login|account/.test(q)) return 'Open Settings to edit your preferences, create or sign into a Firebase account, and review the status of travel data and Agent37 integrations.';
  return 'I can explain Explore, Trip Planner, AI Workspace, My Trips, Flights, Stays, Experiences, Budget, Documents, History and Settings. This built-in help guide does not invent an AI reply.';
}
function renderHelpMessages() { $('#helpMessages').innerHTML = helpMessages.map(m => `<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join(''); $('#helpMessages').scrollTop = $('#helpMessages').scrollHeight; }
function updateUserChrome() {
  const user = currentUser(); const initial = (user.displayName || 'T').trim()[0].toUpperCase();
  $('#sideUserName').textContent = user.displayName || 'Traveller'; $('#sideUserEmail').textContent = user.isGuest ? 'Local workspace · not signed in' : user.email; $('#sideAvatar').textContent = initial; $('#topAvatar').textContent = initial;
  const status = agent37ConnectionStatus(); $('#agentStatusMini').textContent = status.connected ? 'Bridge configured · verify on use' : 'Agent37 not connected'; $('#agentDot').style.background = status.connected ? '#9A6718' : '#87934c';
}
function toggleTheme() { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; try { localStorage.setItem('wayfarer.theme', next); } catch { /* ignore */ } $('#themeToggle').textContent = next === 'dark' ? '☾' : '☼'; }

// Delegated page actions.
document.addEventListener('click', async event => {
  const route = event.target.closest('[data-route]'); if (route) { event.preventDefault(); routeTo(route.dataset.route); return; }
  const save = event.target.closest('[data-save-place]'); if (save) { handleDestinationSave(save.dataset.savePlace); return; }
  const plan = event.target.closest('[data-plan-place]'); if (plan) { planDestination(plan.dataset.planPlace); return; }
  const weather = event.target.closest('[data-weather-place]'); if (weather) { showPlaceWeather(weather.dataset.weatherPlace); return; }
  const openTripButton = event.target.closest('[data-open-trip]'); if (openTripButton) { openTrip(openTripButton.dataset.openTrip); return; }
  const openTask = event.target.closest('[data-open-task]'); if (openTask) { inspectTask(openTask.dataset.openTask); return; }
  const download = event.target.closest('[data-download-file]'); if (download) { try { openExternal(await getPrivateFileUrl(download.dataset.downloadFile)); } catch (error) { toast(error.message, 'error'); } return; }
  const plannerPrompt = event.target.closest('[data-planner-prompt]'); if (plannerPrompt) { sendAgentMessage(plannerPrompt.dataset.plannerPrompt, 'planner'); return; }
  const helpPrompt = event.target.closest('[data-help]'); if (helpPrompt) { sendHelpMessage(helpPrompt.dataset.help); return; }
  const newTrip = event.target.closest('[data-action="new-trip"]'); if (newTrip) { showNewTripForm(); return; }
  const apiTest = event.target.closest('[data-action="test-public-apis"]'); if (apiTest) {
    const target = $('#publicApiTest'); target.textContent = 'Testing public data sources…';
    try { const [fx, places] = await Promise.all([TravelProvider.exchangeRate('USD','INR'), TravelProvider.searchDestinations('London')]); target.textContent = `Frankfurter OK · USD/INR ${fx.rate} (${fx.date}); Open-Meteo Geocoding OK · ${places.length} live city match(es).`; }
    catch (error) { target.textContent = error.message; }
  }
});

$('#modalClose').addEventListener('click', closeModal);
$('#themeToggle').addEventListener('click', toggleTheme);
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#helpAssistant').addEventListener('click', () => { $('#helpDrawer').classList.add('open'); $('#helpDrawer').setAttribute('aria-hidden','false'); $('#helpInput').focus(); });
$('#closeHelp').addEventListener('click', () => { $('#helpDrawer').classList.remove('open'); $('#helpDrawer').setAttribute('aria-hidden','true'); });
$('#helpForm').addEventListener('submit', e => { e.preventDefault(); sendHelpMessage($('#helpInput').value); });
$('#notificationBtn').addEventListener('click', async () => { const items = await listItems('notifications'); showModal({ eyebrow: 'YOUR NOTIFICATIONS', title: 'Recent updates', body: items.length ? items.map(n => `<div class="budget-row"><span><strong>${escapeHTML(n.title)}</strong><br><small>${escapeHTML(n.body)}</small></span><small>${new Date(n.createdAt).toLocaleDateString('en-IN')}</small></div>`).join('') : '<p>No notifications yet.</p>', actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] }); });
$('#globalSearch').addEventListener('keydown', event => { if (event.key === 'Enter') { const query = event.target.value.toLowerCase(); const routes = [['trip','trips'],['flight','flights'],['hotel','hotels'],['stay','hotels'],['experience','experiences'],['budget','budget'],['booking','bookings'],['workspace','workspace'],['destination','explore']]; const found = routes.find(([term]) => query.includes(term)); routeTo(found ? found[1] : 'explore'); if (currentRoute === 'explore' && query.length >= 2) { $('#destinationSearch').value = event.target.value; searchDestinations(event.target.value); } } });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); } if (event.key === 'Escape') closeMobileNav(); });

async function boot() {
  try {
    purgeLegacyDemoRecords();
    const fb = await initFirebase();
    firebaseReady = fb.enabled;
    if (firebaseReady) {
      // Wait for Firebase's initial auth state before selecting the user's data namespace.
      await new Promise(resolve => {
        let firstState = true;
        onAuthChange(user => {
          setCurrentUser(user || null);
          updateUserChrome();
          if (user) getProfile().then(value => { profile = value; }).catch(console.error);
          if (firstState) { firstState = false; resolve(); }
        });
      });
    } else {
      // Do not trust a stale localStorage UID when Firebase is not configured.
      setCurrentUser(null);
    }
    profile = await getProfile();
    updateUserChrome();
    routeTo('dashboard');
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  } catch (error) { console.error(error); toast(`Startup issue: ${error.message}`, 'error'); }
}
boot();
