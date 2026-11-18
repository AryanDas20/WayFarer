import { CONFIG } from './config.js';
import { initFirebase, onAuthChange, signInEmail, signUpEmail, signInGoogle, signOutFirebase, firebaseStatus } from './firebase.js';
import { seedDemoData, setCurrentUser, getCurrentUser, saveItem, listItems, deleteItem, saveProfile, getProfile } from './store.js';
import { agent37ConnectionStatus, sendToAgent37 } from './agent37Adapter.js';
import { TravelProvider, DEMO_IMAGES } from './providers.js';
import { uploadPrivateFile, getPrivateFileUrl } from './storage.js';
import { AGENT37_TOOL_NAMES, normalizeAgentAction } from './agent37Tools.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const content = $('#pageContent');
const modal = $('#modal');
let currentRoute = 'dashboard';
let pendingTask = null;
let activeTrip = null;
let plannerMessages = [];
let helpMessages = [];
let profile = null;
let firebaseReady = false;

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: CONFIG.currency || 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const dateFmt = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be decided';
const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentUser = () => getCurrentUser();

function toast(message, type = 'success') {
  const el = document.createElement('div'); el.className = `toast ${type === 'error' ? 'error' : ''}`; el.textContent = message;
  $('#toastRegion').append(el); setTimeout(() => el.remove(), 3200);
}
function showModal({ eyebrow = 'WAYFARER AI', title, body, actions = [] }) {
  $('#modalEyebrow').textContent = eyebrow; $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body;
  const wrap = $('#modalActions'); wrap.innerHTML = '';
  actions.forEach(action => { const b = document.createElement('button'); b.className = `btn ${action.class || 'btn-outline'}`; b.textContent = action.label; b.addEventListener('click', () => action.onClick?.()); wrap.append(b); });
  modal.showModal();
}
function closeModal() { modal.close(); }
function setAgentState() {
  const status = agent37ConnectionStatus();
  $('#agentStatusMini').textContent = status.connected ? 'Bridge configured · verifying on use' : 'Built-in demo planner';
  $('#agentDot').style.background = status.connected ? '#9A6718' : '#87934c';
}
function pageHead(kicker, title, desc, action = '') {
  return `<div class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p><div class="title-underline"></div></div>${action}</div>`;
}
function explainer(title, text) { return `<div class="explain"><span class="info">i</span><div><b>${title}</b><p>${text}</p></div></div>`; }
function emptyState(icon, title, desc, button = '') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${desc}</p>${button}</div>`; }
function routeTo(route) {
  currentRoute = route; closeMobileNav();
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  const names = { dashboard:'Overview', explore:'Explore destinations', planner:'Trip planner', workspace:'AI Workspace', trips:'My trips', flights:'Flights', hotels:'Stays', experiences:'Experiences', budget:'Budget planner', bookings:'Bookings & vouchers', history:'AI history', wishlist:'Wishlist', support:'Travel support', settings:'Settings' };
  $('#breadcrumbCurrent').textContent = names[route] || 'Overview';
  renderRoute(route); content.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function closeMobileNav() { $('#sidebar').classList.remove('open'); }

async function renderRoute(route) {
  switch (route) {
    case 'dashboard': return renderDashboard();
    case 'explore': return renderExplore();
    case 'planner': return renderPlanner();
    case 'workspace': return renderWorkspace();
    case 'trips': return renderTrips();
    case 'flights': return renderCatalog('flights');
    case 'hotels': return renderCatalog('hotels');
    case 'experiences': return renderCatalog('experiences');
    case 'budget': return renderBudget();
    case 'bookings': return renderBookings();
    case 'history': return renderHistory();
    case 'wishlist': return renderWishlist();
    case 'support': return renderSupport();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

function startVoiceInput(target) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { toast('Voice input is not supported in this browser. Try a recent Chrome browser.', 'error'); return; }
  const recognition = new SpeechRecognition(); recognition.lang = 'en-IN'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onresult = event => { const transcript = event.results?.[0]?.[0]?.transcript || ''; target.value = `${target.value ? target.value + ' ' : ''}${transcript}`; target.focus(); };
  recognition.onerror = () => toast('Voice capture was not completed. Please try again.', 'error');
  recognition.start(); toast('Listening… speak your instruction.');
}

async function renderDashboard() {
  const trips = await listItems('trips'); const tasks = await listItems('tasks');
  const upcoming = trips.filter(t => !['cancelled','completed'].includes(t.status));
  const total = upcoming.reduce((s,t) => s + Number(t.estimatedCost || 0), 0);
  const top = upcoming[0];
  content.innerHTML = `${`<section class="dash-hero"><div><p class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2>Travel a little more<br>like you mean it.</h2><p>Thoughtful journeys, better decisions and a capable travel companion — all in one place.</p><div class="hero-actions"><button class="btn btn-tan" data-route="planner">✳ Plan a journey</button><button class="btn" style="border:1px solid rgba(255,255,255,.5);color:#fff;background:transparent" data-route="explore">Explore places ↗</button></div></div><div class="hero-visual"><div class="hero-globe">⌖</div></div></section>`}
    <div class="grid grid-4">
      <div class="card stat-card"><span class="stat-icon">▤</span><div><small>Trips in your space</small><strong>${trips.length}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">✳</span><div><small>AI tasks completed</small><strong>${tasks.filter(t=>t.status==='completed').length}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">◎</span><div><small>Planned trip budget</small><strong>${money(total)}</strong></div></div>
      <div class="card stat-card"><span class="stat-icon">♡</span><div><small>Saved ideas</small><strong>${(await listItems('wishlist')).length}</strong></div></div>
    </div>
    <div class="section-head"><div><h2>Your journeys</h2><p>A quick look at what is taking shape.</p></div><button class="btn btn-outline btn-small" data-route="trips">View all trips ↗</button></div>
    ${top ? `<div class="card trip-card"><div class="trip-cover image-cover" style="background-image:url('${escapeHTML(top.cover || DEMO_IMAGES[0].image)}')"></div><div class="trip-data"><span class="pill">${escapeHTML(top.status || 'draft')}</span><h3>${escapeHTML(top.title || top.destination)}</h3><p>${escapeHTML(top.destination)} · ${dateFmt(top.startDate)} — ${dateFmt(top.endDate)}</p><div class="trip-stats"><span>♙ ${top.travellers || 1} travellers</span><span>◎ ${money(top.estimatedCost)} estimated</span><span>◷ ${top.days?.length || 0} itinerary stops</span></div></div><button class="btn btn-primary btn-small" data-open-trip="${top.id}">Open trip ↗</button></div>` : emptyState('⌖','A new journey awaits','Start with a destination or ask your AI travel companion to shape a trip.','<button class="btn btn-primary" data-route="planner">Plan your first trip</button>')}
    <div class="section-head"><div><h2>Picked for your curiosity</h2><p>Ideas matched to a love of culture, food and the outdoors.</p></div><button class="btn btn-outline btn-small" data-route="explore">Explore more ↗</button></div>
    <div class="grid grid-3">${(await TravelProvider.searchDestinations()).slice(0,3).map(destinationCard).join('')}</div>
    <div class="section-head"><div><h2>Make the most of WAYFARER</h2><p>Three useful ways to start.</p></div></div>
    <div class="grid grid-3"><button class="quick-link" data-route="workspace"><div><strong>Give AI a task</strong><small>Ask it to compare, organize or update a trip.</small></div><span>✣</span></button><button class="quick-link" data-route="budget"><div><strong>Keep your budget clear</strong><small>See the moving parts behind your trip cost.</small></div><span>◎</span></button><button class="quick-link" data-route="bookings"><div><strong>Keep travel details together</strong><small>Review bookings, vouchers and confirmations.</small></div><span>▣</span></button></div>`;
}

function destinationCard(d) {
  return `<article class="card destination-card"><div class="destination-img" style="background-image:url('${escapeHTML(d.image)}')"><span class="match-pill">${d.score}% match</span></div><div class="destination-info"><h3>${escapeHTML(d.name)}</h3><p>${escapeHTML(d.tag)} · ${escapeHTML(d.country)}</p><div class="meta-row"><span>◎ ${escapeHTML(d.budget)}</span><span>◷ ${escapeHTML(d.days)}</span><span>✧ ${escapeHTML(d.season)}</span></div><p style="margin-top:10px">${escapeHTML(d.reason)}</p><div class="card-actions"><button class="btn btn-outline btn-small" data-save-destination="${d.id}">♡ Save idea</button><button class="btn btn-primary btn-small" data-plan-destination="${d.id}">Plan this ↗</button></div></div></article>`;
}
async function renderExplore() {
  const dests = await TravelProvider.searchDestinations();
  content.innerHTML = `${pageHead('FIND YOUR SOMEWHERE','A world of possibilities.','Explore places that fit your pace, interests and budget. Every price shown here is illustrative demo guidance.','<button class="btn btn-primary" data-route="planner">✳ Plan with AI</button>')}
    ${explainer('A more personal kind of discovery','Destination match scores and budgets are sample recommendations. Adjust your interests in Settings to shape what appears here.')}
    <div class="card" style="margin-bottom:16px"><div class="form-grid"><div class="field"><label for="destinationSearch">Search a place or feeling</label><input class="input" id="destinationSearch" placeholder="Try mountains, food, Japan..." /></div><div class="field"><label for="destinationFilter">Travel mood</label><select class="select" id="destinationFilter"><option value="">All travel moods</option><option>Culture</option><option>Adventure</option><option>Beach</option><option>Nature</option><option>Food</option></select></div></div></div>
    <div class="grid grid-3" id="destinationGrid">${dests.map(destinationCard).join('')}</div>`;
  $('#destinationSearch').addEventListener('input', filterDestinations);
  $('#destinationFilter').addEventListener('change', filterDestinations);
}
async function filterDestinations() {
  const q = $('#destinationSearch').value.toLowerCase(); const mood = $('#destinationFilter').value.toLowerCase();
  const rows = await TravelProvider.searchDestinations();
  const filtered = rows.filter(d => (!q || `${d.name} ${d.country} ${d.tag} ${d.reason}`.toLowerCase().includes(q)) && (!mood || `${d.tag} ${d.reason}`.toLowerCase().includes(mood)));
  $('#destinationGrid').innerHTML = filtered.length ? filtered.map(destinationCard).join('') : emptyState('⌕','No matching places','Try a broader search or another travel mood.');
}

async function renderPlanner() {
  const status = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('THE CONVERSATIONAL PLANNER','A trip that feels like yours.','Tell us what you have in mind. Your travel companion will help turn the idea into a clear, practical plan.')}
  <div class="chat-layout"><section class="card chat-panel"><div class="chat-panel-head"><div class="assistant-avatar">✳</div><div><h3>Travel Concierge</h3><small>${status.connected ? 'Agent37 bridge configured · verify on first message' : 'Built-in demo planner · Agent37 not connected'}</small></div><span class="pill demo">${status.connected ? 'BRIDGE CONFIGURED' : 'DEMO MODE'}</span></div>
    <div class="chat-scroll" id="plannerMessages">${plannerMessages.length ? plannerMessages.map(m=>`<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join('') : `<div class="chat-bubble assistant">Hello ${escapeHTML(profile?.name || currentUser().displayName)}. Tell me where you dream of going, when you would like to travel and what matters most. I can help shape a route, compare sample options and estimate a budget.</div>`}</div>
    <div class="suggestions"><button data-planner-prompt="Plan a 5-day Goa trip for two under ₹40,000 with beaches and great food.">A Goa escape</button><button data-planner-prompt="Suggest a peaceful 4-day mountain trip from Delhi under ₹25,000.">Mountain reset</button><button data-planner-prompt="Plan a culture and food trip to Jaipur for a long weekend.">Culture weekend</button></div>
    <form class="chat-compose" id="plannerForm"><button class="icon-btn voice-btn" id="plannerVoice" type="button" aria-label="Use voice input">⌁</button><input id="plannerInput" placeholder="Tell me about the trip you imagine..." autocomplete="off"><button type="submit" aria-label="Send message">↑</button></form>
  </section><aside class="grid"><div class="card"><p class="eyebrow">YOUR TRAVEL DNA</p><h3>Designed around you</h3><p class="card-sub">A little context helps the planner make better suggestions.</p><div class="divider"></div><div class="budget-row"><span>Home airport</span><strong>${escapeHTML(profile?.homeAirport || 'Delhi (DEL)')}</strong></div><div class="budget-row"><span>Currency</span><strong>${escapeHTML(profile?.currency || 'INR')}</strong></div><div class="budget-row"><span>Interests</span><strong>${escapeHTML((profile?.interests || ['Culture','Food','Nature']).join(', '))}</strong></div><button class="btn btn-outline btn-small" style="margin-top:12px" data-route="settings">Edit preferences ↗</button></div>
  <div class="card"><p class="eyebrow">HOW IT WORKS</p><h3>From idea to itinerary</h3><div class="timeline" style="margin-top:17px"><div class="timeline-item"><strong>Share your intent</strong><small>Dates, budget, people and interests.</small></div><div class="timeline-item"><strong>Shape the options</strong><small>Compare illustrative routes and stays.</small></div><div class="timeline-item"><strong>Review your plan</strong><small>Approve changes before they are saved.</small></div></div></div></aside></div>`;
  $('#plannerForm').addEventListener('submit', e => { e.preventDefault(); sendPlannerMessage($('#plannerInput').value); });
  $('#plannerVoice').addEventListener('click', () => startVoiceInput($('#plannerInput')));
}
async function sendPlannerMessage(text) {
  const message = text.trim(); if (!message) return;
  plannerMessages.push({ role: 'user', text: message });
  const input = $('#plannerInput'); if (input) input.value = '';
  await renderPlanner();
  const scroll = $('#plannerMessages'); if (scroll) scroll.scrollTop = scroll.scrollHeight;
  const status = agent37ConnectionStatus();
  let reply;
  if (status.connected) {
    try {
      const agent = await sendToAgent37({ message, conversation: plannerMessages.slice(-12), profile, tools: ['search_destinations','search_flights','search_hotels','build_itinerary','estimate_trip_cost'] });
      reply = agent.reply;
    } catch (error) { reply = `I couldn't reach the configured Agent37 bridge (${error.message}). I'm switching to the clearly labelled built-in demo planner for this reply.`; }
  }
  if (!reply) reply = builtInTravelReply(message);
  plannerMessages.push({ role: 'assistant', text: reply });
  await renderPlanner();
  const after = $('#plannerMessages'); if (after) after.scrollTop = after.scrollHeight;
}
function builtInTravelReply(message) {
  const lower = message.toLowerCase();
  if (/(plan|create|build|itinerary|trip)/.test(lower)) {
    const destination = /jaipur/.test(lower) ? 'Jaipur, India' : /bali/.test(lower) ? 'Bali, Indonesia' : /japan|kyoto/.test(lower) ? 'Kyoto, Japan' : /sikkim|mountain/.test(lower) ? 'Sikkim, India' : 'Goa, India';
    const budgetMatch = message.match(/(?:under|budget(?: of)?|₹|rs\.?\s*)(?:₹\s*)?([\d,]+)/i);
    const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g,'')) : 40000;
    const travelersMatch = message.match(/(\d+)\s*(?:people|persons|travellers|travelers|adults)/i);
    const travellers = travelersMatch ? Number(travelersMatch[1]) : 2;
    const trip = makeTripDraft({ destination, budget, travellers, title: `${destination.split(',')[0]} escape` });
    return `Here's a first-pass ${trip.days.length}-day idea for ${destination}, for ${travellers} traveller(s), with a working budget of ${money(budget)}.\n\nI'd start with a slower first day, group nearby sights together, and keep one flexible block for weather or local discoveries. The sample itinerary and provider catalogue are demo data, not live inventory.\n\nI've prepared a draft trip. Open AI Workspace to review and approve saving it, or ask me to adjust the budget, pace or interests.\n\nBuilt-in demo planner · not a live Agent37 response.`;
  }
  if (/(check.?in|booking|voucher|reservation)/.test(lower)) return 'I can answer reservation questions from the booking details saved in My Trips. Open Bookings & Vouchers to review your demo reservation, reference and cancellation policy. I will not invent details that are not in your saved booking.\n\nBuilt-in demo planner.';
  if (/(budget|cost|price)/.test(lower)) return 'I can estimate flights, stays, transfers, activities and daily spending from the local demo catalogue. These are illustrative prices only. Open Budget Planner to review an itemized estimate.\n\nBuilt-in demo planner.';
  return 'I can help you shape a destination idea, draft a sample itinerary, estimate a budget or find saved trip information. Share your dates, origin, budget and interests to get started.\n\nBuilt-in demo planner · Agent37 is not connected.';
}

function makeTripDraft({ destination = 'Goa, India', budget = 40000, travellers = 2, title = 'A thoughtful escape' }) {
  const dest = DEMO_IMAGES.find(d => destination.toLowerCase().includes(d.name.toLowerCase())) || DEMO_IMAGES[0];
  const start = new Date(); start.setDate(start.getDate()+30); const end = new Date(start); end.setDate(end.getDate()+4);
  const date = d => d.toISOString().slice(0,10);
  return { id: id('trip'), title, destination, origin: profile?.homeAirport || 'Delhi, India', startDate: date(start), endDate: date(end), travellers, budget, estimatedCost: Math.min(budget, Math.round(budget*.88)), status: 'draft', interests: profile?.interests || ['Culture','Food','Nature'], cover: dest.image, days: [
    { day: 1, date: date(start), morning: 'Arrival and check-in', afternoon: `Easy introduction to ${dest.name}`, evening: 'Local dinner and an early night', cost: Math.round(budget*.15) },
    { day: 2, date: date(new Date(start.getTime()+86400000)), morning: 'Signature local experience', afternoon: 'Explore a nearby neighbourhood', evening: 'Food walk or relaxed evening', cost: Math.round(budget*.2) },
    { day: 3, date: date(new Date(start.getTime()+2*86400000)), morning: 'Nature or cultural excursion', afternoon: 'Free time and a local café', evening: 'Sunset viewpoint', cost: Math.round(budget*.2) },
    { day: 4, date: date(new Date(start.getTime()+3*86400000)), morning: 'Slow breakfast', afternoon: 'Last-minute discoveries', evening: 'Departure', cost: Math.round(budget*.15) }
  ], bookings: [], createdAt: new Date().toISOString() };
}

async function renderWorkspace() {
  const tasks = await listItems('tasks'); const latest = tasks.slice(0,4); const status = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('YOUR AI COMMAND CENTRE','Give the work a direction.','Describe an outcome, not a sequence of clicks. The agent can prepare a plan, show what it intends to change and wait for your approval.')}
  <div class="grid grid-2" style="margin-bottom:16px"><div class="card"><p class="eyebrow">AGENT STATUS</p><h3>${status.connected ? 'Bridge configured' : 'Demo planner ready'}</h3><p class="card-sub">${escapeHTML(status.detail)}</p><div class="divider"></div><div style="display:flex;justify-content:space-between;align-items:center"><span class="pill ${status.connected?'':'demo'}">${status.connected ? 'CONNECTION NOT YET VERIFIED' : 'BUILT-IN DEMO PLANNER'}</span><button class="btn btn-outline btn-small" data-route="settings">Integration settings ↗</button></div></div><div class="card"><p class="eyebrow">THE APPROVAL PROMISE</p><h3>You stay in control.</h3><p class="card-sub">Every website change is prepared as a draft. Saving, editing, deleting, booking, cancelling or rebooking waits for your explicit approval.</p><div class="divider"></div><span class="pill">Preview → Approve → Verify → Record</span></div></div>
  <section class="workspace-panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><p class="eyebrow">WHAT WOULD YOU LIKE DONE?</p><h3 style="font:600 27px 'Cormorant Garamond',serif;color:var(--brown);margin:0">Your travel operations desk</h3></div><span class="pill">✳ Agent workspace</span></div>
    <form id="workspaceForm"><div class="workspace-composer"><textarea id="workspaceInput" placeholder="Example: Compare three hotels for my Goa trip, choose the best value, update my draft and recalculate the budget..." aria-label="Describe a task"></textarea><div style="display:grid;gap:6px"><button class="icon-btn voice-btn" id="workspaceVoice" type="button" aria-label="Use voice input">⌁</button><button class="btn btn-primary" type="submit">Create task ↗</button></div></div><div class="workspace-tools"><label class="muted" style="font-size:9px">Natural language · task planning · approval checkpoints</label><span class="muted" style="font-size:9px">Voice input where supported</span></div></form>
    <div class="suggestions" style="padding:14px 0 0"><button data-work-prompt="Create a 4-day Jaipur trip under ₹25,000 for two and prepare it for approval.">Create a trip</button><button data-work-prompt="Compare three hotels for my Goa trip and propose the best-value replacement.">Compare stays</button><button data-work-prompt="Review my current trip budget and suggest ways to reduce the cost by 15%.">Optimize budget</button><button data-work-prompt="Create a packing checklist for my next trip and prepare it to save.">Packing checklist</button><button data-work-prompt="Simulate a flight delay and prepare a recovery plan for my trip.">Disruption drill</button></div>
  </section>
  <div class="section-head"><div><h2>Recent task activity</h2><p>Inspect the actual plan and outcome of each workspace task.</p></div><button class="btn btn-outline btn-small" data-route="history">Full history ↗</button></div>
  ${latest.length ? `<div class="grid">${latest.map(taskCard).join('')}</div>` : emptyState('✣','Your task history starts here','Ask the workspace to plan, compare or organize something. Its proposed changes will appear here.')}`;
  $('#workspaceForm').addEventListener('submit', e => { e.preventDefault(); createWorkspaceTask($('#workspaceInput').value); });
  $('#workspaceVoice').addEventListener('click', () => startVoiceInput($('#workspaceInput')));
}
function taskCard(task) {
  const statusClass = task.status === 'completed' ? '' : 'demo';
  return `<article class="card" style="padding:15px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="pill ${statusClass}">${escapeHTML(task.status || 'pending')}</span><h3 style="margin-top:8px">${escapeHTML(task.title)}</h3><p class="card-sub">${escapeHTML(task.instruction)}</p><p class="card-sub">${new Date(task.createdAt).toLocaleString('en-IN')}</p></div><button class="btn btn-outline btn-small" data-open-task="${task.id}">Inspect ↗</button></div></article>`;
}
function buildTaskProposal(instruction) {
  const lower = instruction.toLowerCase(); const trips = JSON.parse(localStorage.getItem('wayfarer.v1.trips') || '[]');
  const currentTripItem = trips.find(t => t.status !== 'cancelled') || trips[0];
  if (/(disruption|flight delay|flight cancellation|cancelled flight|delayed flight)/.test(lower) && currentTripItem) {
    const proposed = { ...currentTripItem, disruption: { id: id('disruption'), type: 'simulated-flight-disruption', status: 'simulated', message: 'Sample flight delay / cancellation alert. This is a training simulation, not a live airline alert.', proposedAlternative: 'Alternative demo flight · departure 16:40 · ₹6,750', createdAt: new Date().toISOString() } };
    return { title: 'Review a disruption recovery plan', plan: ['Mark a clearly labelled simulated flight disruption on the selected trip.','Identify itinerary components that may need attention.','Prepare a sample alternative flight and updated cost estimate.','Apply the recovery note only after your confirmation.'], summary: 'Simulate a flight disruption and prepare a recovery option for review.', change: { type: 'report-disruption', tripId: proposed.id, trip: proposed }, before: 'Original itinerary unchanged', after: 'Disruption note + alternative demo flight prepared', total: Number(currentTripItem.estimatedCost || 0) + 6750, policy: 'Training simulation only. No airline status is checked and no real ticket is changed.' };
  }
  if (/\b(book|reserve)\b/.test(lower) && currentTripItem) {
    const priceMatch = instruction.match(/(?:₹|rs\.?\s*)([\d,]+)/i);
    const amount = priceMatch ? Number(priceMatch[1].replace(/,/g,'')) : 0;
    const nameMatch = instruction.match(/book\s+(?:demo\s+)?(.+?)\s+for\s+(?:₹|rs\.?\s*)[\d,]+/i);
    const bookingName = nameMatch ? nameMatch[1].trim() : 'Selected travel option (DEMO)';
    const booking = { id: id('booking'), type: lower.includes('flight') ? 'flight' : lower.includes('hotel') || lower.includes('stay') ? 'hotel' : 'experience', name: bookingName, reference: `WAY-DEMO-${Math.random().toString(36).slice(2,8).toUpperCase()}`, status: 'confirmed-demo', amount, policy: 'Demo booking only. No supplier reservation, payment or ticket is created.', createdAt: new Date().toISOString() };
    return { title: 'Review simulated booking', plan: ['Attach the selected demo option to the current trip.','Show the sample amount and booking policy.','Save a demo reservation record only after your confirmation.'], summary: `Prepare a simulated booking for ${bookingName}.`, change: { type: 'create-demo-booking', tripId: currentTripItem.id, booking }, before: 'No booking record added', after: `Demo booking · ${money(amount)} · ${booking.reference}`, total: amount, policy: booking.policy };
  }
  const bookingTrip = trips.find(t => (t.bookings || []).length) || currentTripItem;
  if (/(cancel|refund)/.test(lower) && bookingTrip?.bookings?.length) {
    const booking = bookingTrip.bookings[0];
    return { title: 'Review a cancellation request', plan: ['Retrieve the selected booking and its stored policy.','Calculate the demo refund and any stated fee.','Show affected trip components and request approval.'], summary: `Prepare cancellation review for ${booking.name}.`, change: { type: 'cancel-booking', tripId: bookingTrip.id, bookingId: booking.id }, before: booking.status, after: 'Cancellation pending approval', total: booking.amount, policy: booking.policy || 'Policy not stored — check provider directly.' };
  }
  if (/(pack|packing)/.test(lower)) {
    const list = ['Travel ID and booking documents','Weather-appropriate clothing','Comfortable walking shoes','Chargers and power bank','Essential medication and personal items','Reusable water bottle'];
    return { title: 'Prepare a packing checklist', plan: ['Read the current trip context where available.','Create a destination-neutral checklist.','Preview the checklist before saving it.'], summary: 'A practical starter checklist is ready.', change: { type: 'create-checklist', items: list }, before: 'No checklist saved', after: `${list.length} checklist items`, total: 0, policy: 'Checklist is a draft until approved.' };
  }
  if (/(update|change|extend|replace|move|shorten|adjust|hotel|budget|itinerary)/.test(lower) && currentTripItem) {
    const proposed = { ...currentTripItem, days: [...(currentTripItem.days || [])] };
    let description = 'Refresh the draft itinerary and budget estimate.';
    if (/(extend|more days|seven days|7 days)/.test(lower)) {
      const next = new Date(`${proposed.endDate}T00:00:00`); next.setDate(next.getDate()+2); proposed.endDate = next.toISOString().slice(0,10);
      proposed.days.push({ day: proposed.days.length+1, date: next.toISOString().slice(0,10), morning: 'Additional local discovery', afternoon: 'Flexible activity', evening: 'Dinner near your stay', cost: 2800 }, { day: proposed.days.length+2, date: new Date(next.getTime()+86400000).toISOString().slice(0,10), morning: 'Slow morning', afternoon: 'Departure preparation', evening: 'Departure', cost: 1800 });
      description = 'Extend the trip by two days and add two flexible activity blocks.';
    } else if (/(15%|reduce|cheaper|lower|save money|less expensive)/.test(lower)) {
      proposed.estimatedCost = Math.round(Number(proposed.estimatedCost || 0)*.85); description = 'Prepare a 15% cost-reduction draft while preserving the trip dates.';
    } else if (/hotel|stay/.test(lower)) {
      description = 'Compare sample stays and prepare a recommended replacement in the trip draft.';
      proposed.hotelSuggestion = { name: 'The Palm House (DEMO)', nightlyRate: 3600, source: 'DEMO' };
    } else if (/move|reorder/.test(lower) && proposed.days.length > 1) {
      const [first, second] = proposed.days; proposed.days[0] = second; proposed.days[1] = first; proposed.days.forEach((d,i)=>d.day=i+1); description = 'Prepare a revised order for the first two itinerary days.';
    }
    return { title: 'Review proposed trip changes', plan: ['Load the selected saved trip and its current itinerary.','Prepare the requested itinerary or budget changes.','Recalculate the estimated trip cost.','Show the before-and-after view for approval.'], summary: description, change: { type: 'update-trip', tripId: proposed.id, trip: proposed }, before: `${currentTripItem.days?.length || 0} itinerary days · ${money(currentTripItem.estimatedCost)}`, after: `${proposed.days.length} itinerary days · ${money(proposed.estimatedCost)}`, total: proposed.estimatedCost, policy: 'This updates your saved trip only after you press Confirm and apply.' };
  }
  const destination = /jaipur/.test(lower) ? 'Jaipur, India' : /bali/.test(lower) ? 'Bali, Indonesia' : /japan|kyoto/.test(lower) ? 'Kyoto, Japan' : /sikkim|mountain/.test(lower) ? 'Sikkim, India' : 'Goa, India';
  const budgetMatch = instruction.match(/(?:under|budget(?: of)?|₹|rs\.?\s*)(?:₹\s*)?([\d,]+)/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g,'')) : 40000;
  const travellersMatch = instruction.match(/(\d+)\s*(?:people|persons|travellers|travelers|adults)/i);
  const trip = makeTripDraft({ destination, budget, travellers: travellersMatch ? Number(travellersMatch[1]) : 2, title: `${destination.split(',')[0]} escape` });
  return { title: `Plan a trip to ${destination}`, plan: ['Understand the destination, budget and traveller count from the request.','Create a day-by-day sample itinerary.','Estimate a trip budget from the demo planning model.','Preview the new trip before saving it.'], summary: `Create a ${trip.days.length}-day ${destination} draft for ${trip.travellers} traveller(s).`, change: { type: 'create-trip', trip }, before: 'No new trip saved', after: `${trip.days.length} days · ${money(trip.estimatedCost)} estimated`, total: trip.estimatedCost, policy: 'This is an itinerary draft using demo data. It is not a live booking or verified quote.' };
}
async function createWorkspaceTask(instruction) {
  const requestText = instruction.trim(); if (!requestText) return;
  let actionInstruction = requestText;
  let source = 'built-in-demo-planner';
  let agentReply = '';
  let agentAction = null;
  const connection = agent37ConnectionStatus();
  if (connection.connected) {
    try {
      const trips = await listItems('trips');
      const contextTrip = trips.find(t => t.status !== 'cancelled') || trips[0] || null;
      const response = await sendToAgent37({
        message: `Plan this WAYFARER website task. Choose at most one write tool from the allowed list and return it in actions as {name, arguments}. Do not claim to have executed anything. All writes require user approval. User request: ${requestText}`,
        conversation: [], profile, trip: contextTrip, tools: AGENT37_TOOL_NAMES
      });
      source = 'agent37-personal-bridge';
      agentReply = response.reply;
      for (const rawAction of response.actions) {
        const normalized = normalizeAgentAction(rawAction);
        if (normalized) { agentAction = rawAction; actionInstruction = normalized; break; }
      }
    } catch (error) {
      source = 'built-in-demo-planner';
      agentReply = `Agent37 bridge unavailable for this task: ${error.message}. The built-in demo planner prepared the proposal instead.`;
    }
  }
  const taskId = id('task');
  const proposal = buildTaskProposal(actionInstruction);
  if (agentReply) proposal.agentReply = agentReply;
  if (agentAction) proposal.agentAction = agentAction;
  const task = { id: taskId, title: proposal.title, instruction: requestText, status: 'awaiting-approval', source, plan: proposal.plan, proposal, createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: source === 'agent37-personal-bridge' ? 'Agent37 bridge returned a plan; application allowlist validated the proposed action.' : 'Built-in demo planner prepared a bounded proposal.' }] };
  await saveItem('tasks', task); pendingTask = task;
  renderTaskApproval(task);
}
function renderTaskApproval(task) {
  const p = task.proposal;
  showModal({ eyebrow: 'TASK PREVIEW · AWAITING YOUR APPROVAL', title: task.title, body: `
    <p style="color:var(--muted);margin:0 0 12px">${escapeHTML(p.summary)}</p>
    <div class="card" style="padding:12px;background:var(--panel2)"><p class="eyebrow">EXECUTION PLAN</p>${p.plan.map((s,i)=>`<div class="task-step"><span class="step-number">${i+1}</span><div><strong>${escapeHTML(s)}</strong></div></div>`).join('')}</div>
    ${p.agentReply ? `<div class="explain"><span class="info">✳</span><div><b>Agent response</b><p>${escapeHTML(p.agentReply)}</p></div></div>` : ''}
    <div class="approval-card"><div style="display:flex;justify-content:space-between;gap:12px"><div><p class="eyebrow">CURRENT STATE</p><strong>${escapeHTML(p.before)}</strong></div><div><p class="eyebrow">PROPOSED STATE</p><strong>${escapeHTML(p.after)}</strong></div></div><div class="divider"></div><div class="eyebrow">ESTIMATED TRIP COST / VALUE</div><div class="approval-total">${money(p.total)}</div><p class="card-sub">${escapeHTML(p.policy)}</p></div>
    <p class="card-sub" style="margin-top:12px">Nothing has been changed yet. Confirming applies this proposal to your demo workspace and records the result in AI History.</p>
  `, actions: [
    { label: 'Reject proposal', class: 'btn-outline', onClick: async () => { await finishTask(task, 'cancelled', 'User rejected the proposed changes.'); closeModal(); toast('Proposal rejected. No changes were applied.'); if (currentRoute==='workspace') renderWorkspace(); } },
    { label: 'Confirm and apply', class: 'btn-primary', onClick: async () => { await applyTask(task); closeModal(); } }
  ]});
}
async function finishTask(task, status, event) {
  task.status = status; task.completedAt = new Date().toISOString(); task.log = [...(task.log||[]), { at: new Date().toISOString(), event }]; await saveItem('tasks', task);
}
async function applyTask(task) {
  const p = task.proposal; let result = '';
  try {
    if (p.change.type === 'create-trip') { await saveItem('trips', p.change.trip); result = `Created draft trip ${p.change.trip.title}.`; }
    else if (p.change.type === 'update-trip') { await saveItem('trips', p.change.trip); result = `Updated ${p.change.trip.title}.`; }
    else if (p.change.type === 'report-disruption') {
      await saveItem('trips', p.change.trip);
      await saveItem('notifications', { id: id('notice'), title: 'Simulated travel disruption', body: 'A demo flight disruption and recovery option were added to your trip for rehearsal.', type: 'warning', read: false, createdAt: new Date().toISOString() });
      result = 'A simulated disruption and recovery option were saved to the trip. No real airline information was checked.';
    }
    else if (p.change.type === 'create-demo-booking') {
      const trip = (await listItems('trips')).find(t=>t.id===p.change.tripId);
      if (!trip) throw new Error('Trip not found.');
      trip.bookings = [...(trip.bookings || []), p.change.booking];
      trip.estimatedCost = Number(trip.estimatedCost || 0) + Number(p.change.booking.amount || 0);
      await saveItem('trips', trip); result = `Saved demo booking ${p.change.booking.reference}. No real supplier booking or payment was made.`;
    }
    else if (p.change.type === 'cancel-booking') {
      const trip = (await listItems('trips')).find(t=>t.id===p.change.tripId); const booking = trip?.bookings?.find(b=>b.id===p.change.bookingId);
      if (!booking) throw new Error('Booking not found in your trip.');
      booking.status = 'cancellation-requested-demo'; booking.cancellationRequestedAt = new Date().toISOString(); await saveItem('trips', trip); result = 'Demo cancellation request recorded. This does not cancel a real reservation.';
    } else if (p.change.type === 'create-checklist') {
      await saveItem('documents', { id: id('checklist'), title: 'Travel packing checklist', kind: 'checklist', items: p.change.items.map(text=>({ text, done:false })), createdAt: new Date().toISOString() }); result = 'Saved the packing checklist.';
    }
    await finishTask(task, 'completed', result);
    await saveItem('notifications', { id: id('notice'), title: 'AI task completed', body: result, type: 'success', read: false, createdAt: new Date().toISOString() });
    toast(result);
    if (currentRoute === 'workspace') renderWorkspace();
  } catch (error) { await finishTask(task, 'failed', error.message); toast(`Task failed: ${error.message}`, 'error'); }
}

async function renderTrips() {
  const trips = await listItems('trips');
  content.innerHTML = `${pageHead('YOUR TRAVEL COLLECTION','Journeys, gathered in one place.','Keep drafts, upcoming escapes and completed journeys organized.','<button class="btn btn-primary" data-route="planner">＋ New trip</button>')}
    ${explainer('One clear trip record','Each trip keeps its dates, daily plan, bookings, costs and activity together. Demo reservations are labelled and are not connected to travel suppliers.')}
    <div class="grid">${trips.length ? trips.map(t=>`<article class="card trip-card"><div class="trip-cover" style="background-image:url('${escapeHTML(t.cover || DEMO_IMAGES[0].image)}')"></div><div class="trip-data"><span class="pill ${t.status==='cancelled'?'demo':''}">${escapeHTML(t.status || 'draft')}</span><h3>${escapeHTML(t.title || t.destination)}</h3><p>${escapeHTML(t.destination)} · ${dateFmt(t.startDate)} — ${dateFmt(t.endDate)}</p><div class="trip-stats"><span>♙ ${t.travellers || 1} travellers</span><span>◎ ${money(t.estimatedCost)} estimated</span><span>▤ ${t.days?.length || 0} day blocks</span></div></div><button class="btn btn-primary btn-small" data-open-trip="${t.id}">View trip ↗</button></article>`).join('') : emptyState('▤','No journeys yet','Create a trip with the planner or give AI Workspace a task.','<button class="btn btn-primary" data-route="planner">Start planning</button>')}</div>`;
}
async function openTrip(tripId) {
  const trip = (await listItems('trips')).find(t=>t.id===tripId); if (!trip) return toast('Trip not found.', 'error');
  activeTrip = trip;
  showModal({ eyebrow: 'TRIP DETAIL · DEMO AWARE', title: trip.title || trip.destination, body: `
    <span class="pill">${escapeHTML(trip.status || 'draft')}</span><p>${escapeHTML(trip.destination)} · ${dateFmt(trip.startDate)} — ${dateFmt(trip.endDate)}</p>
    <div class="grid grid-2"><div class="card"><p class="eyebrow">ESTIMATED COST</p><h3>${money(trip.estimatedCost)}</h3></div><div class="card"><p class="eyebrow">TRAVELLERS</p><h3>${trip.travellers || 1}</h3></div></div>
    <h3 style="margin:16px 0 8px">Day-by-day itinerary</h3>${(trip.days||[]).map(d=>`<div class="task-step"><span class="step-number">${d.day}</span><div><strong>${dateFmt(d.date)}</strong><p>Morning: ${escapeHTML(d.morning)}<br>Afternoon: ${escapeHTML(d.afternoon)}<br>Evening: ${escapeHTML(d.evening)}<br>Estimated day cost: ${money(d.cost)}</p></div></div>`).join('')}
    <h3 style="margin:16px 0 8px">Bookings</h3>${(trip.bookings||[]).length ? trip.bookings.map(b=>`<div class="budget-row"><span>${escapeHTML(b.name)} · ${escapeHTML(b.reference)}</span><strong>${money(b.amount)} <small class="muted">${escapeHTML(b.status)}</small></strong></div>`).join('') : '<p class="card-sub">No bookings saved for this trip.</p>'}
    ${trip.disruption?`<div class="approval-card"><span class="pill demo">SIMULATED DISRUPTION</span><h4 style="margin-top:8px">Recovery note</h4><p class="card-sub">${escapeHTML(trip.disruption.message)}<br>${escapeHTML(trip.disruption.proposedAlternative)}</p></div>`:''}
    <div class="explain"><span class="info">i</span><div><b>Demo trip record</b><p>Any prices, bookings or availability in this prototype are simulated unless explicitly connected to a live provider.</p></div></div>
  `, actions: [
    { label: 'Open map', class: 'btn-outline', onClick: () => window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(trip.destination)}`, '_blank', 'noopener') },
    { label: 'Calendar export', class: 'btn-outline', onClick: () => downloadTripCalendar(trip) },
    { label: 'Simulate disruption', class: 'btn-outline', onClick: () => { closeModal(); createWorkspaceTask('Simulate a flight delay or cancellation and prepare a recovery plan for my trip.'); } },
    { label: 'Ask AI to update', class: 'btn-outline', onClick: () => { closeModal(); routeTo('workspace'); $('#workspaceInput')?.focus(); } },
    { label: 'Open bookings', class: 'btn-primary', onClick: () => { closeModal(); routeTo('bookings'); } }
  ]});
}

function downloadTripCalendar(trip) {
  const escapeIcs = value => String(value || '').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const events = (trip.days || []).map(day => {
    const start = String(day.date || trip.startDate).replace(/-/g,'');
    const endDate = new Date(`${day.date || trip.startDate}T00:00:00`); endDate.setDate(endDate.getDate()+1);
    const end = endDate.toISOString().slice(0,10).replace(/-/g,'');
    return `BEGIN:VEVENT\r\nUID:${escapeIcs(trip.id)}-${day.day}@wayfarer.ai\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${escapeIcs(`${trip.title || trip.destination} · Day ${day.day}`)}\r\nDESCRIPTION:${escapeIcs(`${day.morning}; ${day.afternoon}; ${day.evening}`)}\r\nEND:VEVENT`;
  }).join('\r\n');
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WAYFARER AI//Trip Calendar//EN\r\n${events}\r\nEND:VCALENDAR`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${String(trip.title || 'wayfarer-trip').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.ics`; a.click(); URL.revokeObjectURL(url); toast('Trip calendar exported.');
}

async function renderCatalog(kind) {
  let rows = kind==='flights' ? await TravelProvider.searchFlights() : kind==='hotels' ? await TravelProvider.searchHotels() : await TravelProvider.searchActivities();
  const title = kind==='flights' ? ['COMPARE FLIGHT OPTIONS','The route, your way.','Compare illustrative flight options by price, time and convenience.'] : kind==='hotels' ? ['FIND YOUR STAY','A good place to land.','Explore sample stays with a little more context than just a nightly rate.'] : ['MAKE THE JOURNEY MATTER','Experiences worth the detour.','Discover sample activities and local moments to shape your itinerary.'];
  content.innerHTML = `${pageHead(...title,'<span class="pill demo">SIMULATED DEMO INVENTORY</span>')}
    ${explainer('About these options','These listings and prices are local demo data. No live availability, reservation or supplier price is being checked. Connect a real provider adapter before using this for real travel decisions.')}
    <div class="card" style="margin-bottom:14px"><div class="form-grid"><div class="field"><label for="catalogSearch">Search options</label><input class="input" id="catalogSearch" placeholder="Search by name, location or route..."></div><div class="field"><label for="catalogSort">Sort by</label><select class="select" id="catalogSort"><option value="recommended">Recommended</option><option value="price">Lowest price</option>${kind==='flights'?'<option value="duration">Shortest duration</option>':''}</select></div></div></div><div id="catalogList" class="grid">${rows.map(r=>catalogCard(r,kind)).join('')}</div>`;
  const apply = () => {
    const q=$('#catalogSearch').value.toLowerCase(), sort=$('#catalogSort').value;
    let filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
    if(sort==='price') filtered.sort((a,b)=>a.price-b.price);
    if(sort==='duration') filtered.sort((a,b)=>parseInt(a.duration)-parseInt(b.duration));
    $('#catalogList').innerHTML=filtered.length?filtered.map(r=>catalogCard(r,kind)).join(''):emptyState('⌕','No results','Try a different search.');
  };
  $('#catalogSearch').addEventListener('input',apply); $('#catalogSort').addEventListener('change',apply);
}
function catalogCard(row,kind) {
  const title=kind==='flights'?row.airline:row.name; const sub=kind==='flights'?`${row.route} · ${row.depart}–${row.arrive} · ${row.duration} · ${row.stops}`:kind==='hotels'?`${row.area} · ${row.type} · ★ ${row.rating}`:`${row.category} · ${row.duration}`;
  return `<article class="card catalog-card"><div><span class="pill demo">DEMO</span><h4>${escapeHTML(title)}</h4><p>${escapeHTML(sub)}</p><small class="muted">${escapeHTML(row.tag || row.perk || 'Sample travel option')}</small></div><div class="right"><div class="catalog-price">${money(row.price)}${kind==='hotels'?'<small style="font:9px Poppins;color:var(--muted)"> / night</small>':''}</div><button class="btn btn-outline btn-small" style="margin-top:7px" data-option-detail="${row.id}" data-kind="${kind}">Review option</button></div></article>`;
}
async function showOptionDetail(optionId, kind) {
  const rows=kind==='flights'?await TravelProvider.searchFlights():kind==='hotels'?await TravelProvider.searchHotels():await TravelProvider.searchActivities(); const item=rows.find(x=>x.id===optionId); if(!item)return;
  const validation=await TravelProvider.validatePrice(item);
  showModal({eyebrow:'DEMO OPTION · NOT LIVE INVENTORY',title:kind==='flights'?item.airline:item.name,body:`<p>${escapeHTML(kind==='flights'?item.route:item.area || item.category)}</p><div class="approval-card"><div class="eyebrow">SAMPLE PRICE</div><div class="approval-total">${money(item.price)}</div><p class="card-sub">${escapeHTML(validation.message)}</p></div><p class="card-sub">${escapeHTML(item.perk || item.duration || item.tag || '')}</p>`,actions:[{label:'Close',class:'btn-outline',onClick:closeModal},{label:'Prepare demo booking',class:'btn-primary',onClick:()=>{closeModal();createWorkspaceTask(`Book DEMO ${kind==='flights'?item.airline: item.name} for ₹${item.price} as a ${kind==='flights'?'flight':kind==='hotels'?'hotel':'experience'} in my current trip.`);}}]});
}

async function renderBudget() {
  const trips=await listItems('trips'); const trip=trips.find(t=>t.status!=='cancelled')||trips[0];
  if(!trip){content.innerHTML=`${pageHead('TRAVEL COST CLARITY','Know what the journey adds up to.','Estimate each part of your trip and keep the total aligned with your comfort zone.')}${emptyState('◎','No trip to budget yet','Create a trip first to see its cost breakdown.','<button class="btn btn-primary" data-route="planner">Plan a trip</button>')}`;return;}
  const breakdown=[['Flights',Math.round(trip.estimatedCost*.28)],['Accommodation',Math.round(trip.estimatedCost*.38)],['Transfers',Math.round(trip.estimatedCost*.09)],['Experiences',Math.round(trip.estimatedCost*.14)],['Food & flexibility',Math.round(trip.estimatedCost*.11)]];
  const budget=Number(trip.budget||1), pct=Math.min(100,Math.round(trip.estimatedCost/budget*100));
  content.innerHTML=`${pageHead('THE BUDGET PICTURE','Spend with intention.','A living estimate for your selected trip. These figures are planning estimates, not supplier-confirmed prices.')}
    <div class="grid grid-2"><div class="card"><p class="eyebrow">ESTIMATED TOTAL</p><h3 style="font-size:42px">${money(trip.estimatedCost)}</h3><p class="card-sub">Working budget: ${money(budget)}</p><div class="budget-track"><span style="width:${pct}%"></span></div><div class="budget-row"><span>Budget used</span><strong>${pct}%</strong></div><div class="budget-row"><span>Estimated headroom</span><strong>${money(Math.max(0,budget-trip.estimatedCost))}</strong></div><button class="btn btn-primary" style="margin-top:13px" data-route="workspace">Ask AI to optimize ↗</button></div>
    <div class="card"><p class="eyebrow">COST BREAKDOWN</p><h3>Where it goes</h3>${breakdown.map(([name,value])=>`<div class="budget-row"><span>${name}</span><strong>${money(value)}</strong></div>`).join('')}<div class="divider"></div><p class="card-sub">Category allocation is illustrative and derived from the trip's estimated total.</p></div></div>
    ${explainer('Need to bring the total down?','Ask AI Workspace to compare lower-cost stays, reduce paid activities or adjust the itinerary. It will show proposed changes before applying them.')}`;
}

async function renderBookings() {
  const trips=await listItems('trips'); const bookings=trips.flatMap(t=>(t.bookings||[]).map(b=>({...b,tripTitle:t.title||t.destination,tripId:t.id})));
  content.innerHTML=`${pageHead('YOUR TRAVEL PAPERWORK','The details you need, together.','Review saved booking records and demo vouchers. Real supplier confirmations are not generated by this prototype.')}
    ${explainer('Reservation truth matters','A booking marked DEMO is a local simulation only. It is not a ticket, hotel reservation or proof of payment.')}
    ${bookings.length?`<div class="grid">${bookings.map(b=>`<article class="card catalog-card"><div><span class="pill demo">${escapeHTML(b.status)}</span><h4>${escapeHTML(b.name)}</h4><p>${escapeHTML(b.tripTitle)} · Ref ${escapeHTML(b.reference)}</p><p>Check-in: ${dateFmt(b.checkIn)} · Check-out: ${dateFmt(b.checkOut)}</p><small class="muted">${escapeHTML(b.policy||'No policy stored')}</small></div><div class="right"><div class="catalog-price">${money(b.amount)}</div><button class="btn btn-outline btn-small" style="margin-top:8px" data-booking-detail="${b.id}" data-trip="${b.tripId}">View details</button></div></article>`).join('')}</div>`:emptyState('▣','No booking records yet','When you make a simulated booking in a demo trip, the record will appear here.')}
    <div class="section-head"><div><h2>Documents</h2><p>Your checklists and document records.</p></div><button class="btn btn-outline btn-small" data-route="settings">Storage setup ↗</button></div>
    <form class="card" id="documentUploadForm" style="margin-bottom:13px"><p class="eyebrow">PRIVATE DOCUMENT STORAGE</p><div class="form-grid"><div class="field"><label for="travelFile">Choose a PDF or image (max 10 MB)</label><input class="input" id="travelFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div><div class="field" style="align-self:end"><button class="btn btn-primary" type="submit">Upload document securely</button></div></div><p class="card-sub">Requires Firebase sign-in and the private Supabase Storage signing function. Files are not uploaded in demo-only mode.</p></form>
    <div id="documentList" class="grid">${(await listItems('documents')).map(d=>`<div class="card"><h3>${escapeHTML(d.title || d.name || 'Travel document')}</h3><p class="card-sub">${d.items?.length||0} checklist items · ${new Date(d.createdAt || d.uploadedAt || Date.now()).toLocaleDateString('en-IN')}</p>${d.path?`<button class="btn btn-outline btn-small" data-download-file="${escapeHTML(d.path)}">Open secure file ↗</button>`:''}</div>`).join('')||'<div class="card card-sub">No documents or checklists saved yet.</div>'}</div>`;
  $('#documentUploadForm').addEventListener('submit', async e=>{e.preventDefault();const file=$('#travelFile').files?.[0];if(!file)return toast('Choose a file first.','error');try{const uploaded=await uploadPrivateFile(file);await saveItem('documents',{id:id('file'),title:file.name,kind:'upload',...uploaded,createdAt:new Date().toISOString()});toast('Document uploaded to your private storage.');renderBookings();}catch(error){toast(error.message,'error');}});
}
async function showBookingDetail(bookingId, tripId) {
  const trip=(await listItems('trips')).find(t=>t.id===tripId); const b=trip?.bookings?.find(x=>x.id===bookingId); if(!b)return;
  showModal({eyebrow:'RESERVATION RECORD · DEMO',title:b.name,body:`<div class="grid grid-2"><div class="card"><p class="eyebrow">REFERENCE</p><h3>${escapeHTML(b.reference)}</h3></div><div class="card"><p class="eyebrow">AMOUNT</p><h3>${money(b.amount)}</h3></div></div><div class="budget-row"><span>Check-in</span><strong>${dateFmt(b.checkIn)}</strong></div><div class="budget-row"><span>Check-out</span><strong>${dateFmt(b.checkOut)}</strong></div><div class="budget-row"><span>Status</span><strong>${escapeHTML(b.status)}</strong></div><p>${escapeHTML(b.policy||'No cancellation policy stored.')}</p><div class="explain"><span class="info">i</span><div><b>Demo confirmation</b><p>This record does not represent a real booking. Cancellation below updates only the local demo record.</p></div></div>`,actions:[{label:'Close',class:'btn-outline',onClick:closeModal},{label:'Review demo cancellation',class:'btn-danger',onClick:()=>{closeModal();createWorkspaceTask(`Cancel booking ${b.reference} from my trip and show the policy and refund implications.`);}}]});
}

async function renderHistory() {
  const tasks=await listItems('tasks');
  content.innerHTML=`${pageHead('TRANSPARENT AI ACTIVITY','Every task has a trail.','Review what was requested, proposed, approved, rejected and completed. This history records actions taken inside this prototype.')}
  ${tasks.length?`<div class="grid">${tasks.map(t=>`<article class="card"><div style="display:flex;justify-content:space-between;gap:15px"><div><span class="pill ${t.status==='completed'?'':'demo'}">${escapeHTML(t.status)}</span><h3 style="margin-top:9px">${escapeHTML(t.title)}</h3><p class="card-sub">${escapeHTML(t.instruction)}</p><p class="card-sub">Created ${new Date(t.createdAt).toLocaleString('en-IN')} · Source: ${escapeHTML(t.source)}</p></div><button class="btn btn-outline btn-small" data-open-task="${t.id}">Inspect task</button></div><div class="divider"></div><div class="timeline">${(t.log||[]).map(l=>`<div class="timeline-item"><strong>${escapeHTML(l.event)}</strong><small>${new Date(l.at).toLocaleString('en-IN')}</small></div>`).join('')}</div></article>`).join('')}</div>`:emptyState('◷','No AI activity yet','Your task plans and approvals will be collected here.')}`;
}
async function inspectTask(taskId) {
  const task=(await listItems('tasks')).find(t=>t.id===taskId);if(!task)return;
  if(task.status==='awaiting-approval') return renderTaskApproval(task);
  showModal({eyebrow:'AI TASK HISTORY',title:task.title,body:`<span class="pill">${escapeHTML(task.status)}</span><p>${escapeHTML(task.instruction)}</p><h3>Plan</h3>${(task.plan||[]).map((p,i)=>`<div class="task-step"><span class="step-number">${i+1}</span><div><strong>${escapeHTML(p)}</strong></div></div>`).join('')}<h3 style="margin-top:15px">Execution log</h3>${(task.log||[]).map(l=>`<div class="budget-row"><span>${escapeHTML(l.event)}</span><small>${new Date(l.at).toLocaleString('en-IN')}</small></div>`).join('')}`,actions:[{label:'Close',class:'btn-primary',onClick:closeModal}]});
}

async function renderWishlist() {
  const saved=await listItems('wishlist');
  content.innerHTML=`${pageHead('IDEAS TO RETURN TO','Keep a little inspiration close.','Save places and ideas that you would like to explore later.')}${saved.length?`<div class="grid grid-3">${saved.map(d=>destinationCard(d)).join('')}</div>`:emptyState('♡','Your wishlist is waiting','Save destinations from Explore to collect your next possibilities.','<button class="btn btn-primary" data-route="explore">Explore destinations</button>')}`;
}
async function renderSupport() {
  const requests=await listItems('supportRequests');
  content.innerHTML=`${pageHead('A HUMAN WHEN YOU NEED ONE','Let’s talk through the details.','Send a request for a human travel consultant. This prototype records your request locally or in your configured Firestore account.')}
  <div class="grid grid-2"><form class="card" id="supportForm"><p class="eyebrow">CONSULTANT REQUEST</p><h3>How can we help?</h3><div class="field" style="margin-top:15px"><label for="supportTopic">Topic</label><select class="select" id="supportTopic"><option>Trip planning</option><option>Booking question</option><option>Disruption support</option><option>Accessibility request</option><option>Other</option></select></div><div class="field" style="margin-top:12px"><label for="supportMessage">Tell us what you need</label><textarea class="textarea" id="supportMessage" required placeholder="Share a few details..."></textarea></div><button class="btn btn-primary" type="submit" style="margin-top:13px">Submit request</button></form>
  <div class="card"><p class="eyebrow">WHAT HAPPENS NEXT</p><h3>Your request, clearly tracked.</h3><div class="timeline" style="margin-top:18px"><div class="timeline-item"><strong>Request recorded</strong><small>Your message is saved with a timestamp.</small></div><div class="timeline-item"><strong>Review requested</strong><small>A real consultant is not automatically contacted in this demo.</small></div><div class="timeline-item"><strong>Status visible</strong><small>Follow progress from this page.</small></div></div></div></div>
  <div class="section-head"><div><h2>Previous requests</h2><p>Requests saved in this workspace.</p></div></div>
  <div class="grid">${requests.map(r=>`<div class="card"><span class="pill">${escapeHTML(r.status)}</span><h3>${escapeHTML(r.topic)}</h3><p class="card-sub">${escapeHTML(r.message)}</p><small class="muted">${new Date(r.createdAt).toLocaleString('en-IN')}</small></div>`).join('')||'<div class="card card-sub">No support requests yet.</div>'}</div>`;
  $('#supportForm').addEventListener('submit',async e=>{e.preventDefault();await saveItem('supportRequests',{id:id('support'),topic:$('#supportTopic').value,message:$('#supportMessage').value.trim(),status:'received · demo',createdAt:new Date().toISOString()});toast('Your demo support request has been recorded.');renderSupport();});
}

async function renderSettings() {
  const user=currentUser(); profile=await getProfile(); const fb=firebaseStatus(); const ag=agent37ConnectionStatus();
  content.innerHTML=`${pageHead('YOUR ACCOUNT & PREFERENCES','Make the journey feel personal.','Manage the preferences that shape your recommendations, account and connected services.')}
  <div class="grid grid-2"><form class="card" id="profileForm"><p class="eyebrow">TRAVELLER PROFILE</p><h3>Your travel DNA</h3><div class="form-grid" style="margin-top:15px"><div class="field"><label for="profileName">Display name</label><input class="input" id="profileName" value="${escapeHTML(profile.name||user.displayName)}"></div><div class="field"><label for="profileHome">Home airport / city</label><input class="input" id="profileHome" value="${escapeHTML(profile.homeAirport||'Delhi (DEL)')}"></div><div class="field"><label for="profileCurrency">Preferred currency</label><select class="select" id="profileCurrency"><option value="INR" ${profile.currency==='INR'?'selected':''}>INR · Indian Rupee</option><option value="USD" ${profile.currency==='USD'?'selected':''}>USD · US Dollar</option><option value="EUR" ${profile.currency==='EUR'?'selected':''}>EUR · Euro</option></select></div><div class="field"><label for="profilePace">Travel pace</label><select class="select" id="profilePace"><option>Balanced</option><option>Slow and relaxed</option><option>See it all</option><option>Adventure-led</option></select></div></div><div class="field" style="margin-top:13px"><label for="profileInterests">Interests (comma separated)</label><input class="input" id="profileInterests" value="${escapeHTML((profile.interests||['Culture','Food','Nature']).join(', '))}"></div><button class="btn btn-primary" style="margin-top:15px" type="submit">Save preferences</button></form>
  <div class="grid"><div class="card"><p class="eyebrow">FIREBASE</p><h3>${fb.enabled?'Firebase connected':'Demo storage active'}</h3><p class="card-sub">${fb.enabled?'Authentication and Firestore modules initialized.':'Add your Firebase web app settings to enable email/Google authentication and Firestore sync.'}</p><span class="pill ${fb.enabled?'':'demo'}">${fb.enabled?'CONFIGURED':'NOT CONFIGURED'}</span><div class="divider"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-small" id="loginBtn">Sign in / create account</button><button class="btn btn-outline btn-small" id="signOutBtn">Sign out</button></div></div>
  <div class="card"><p class="eyebrow">AGENT37 PERSONAL</p><h3>${ag.connected?'Bridge configured':'Not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p><span class="pill demo">${ag.connected?'NOT YET VERIFIED':'INSTANCE ID ALONE IS NOT AN API'}</span><div class="divider"></div><p class="card-sub">Agent37 Personal is a hosted personal agent. This project does not use the Cloud API. Add a secure bridge only if you have a documented Personal connection method.</p><button class="btn btn-outline btn-small" id="agentHelp">Integration notes ↗</button></div>
  <div class="card"><p class="eyebrow">SUPABASE FILE STORAGE</p><h3>${CONFIG.storage?.signingEndpoint?'Signing endpoint configured':'Secure storage not configured'}</h3><p class="card-sub">The app expects a Firebase-authenticated server endpoint that creates signed upload/download URLs. The Supabase service-role key must stay server-side.</p><span class="pill demo">FILES DISABLED UNTIL CONFIGURED</span></div>
  <div class="card"><p class="eyebrow">APPEARANCE</p><h3>Set your atmosphere</h3><p class="card-sub">Choose a quiet light or dark interface.</p><button class="btn btn-outline btn-small" id="settingsTheme">Toggle light / dark mode</button></div></div></div>`;
  $('#profileForm').addEventListener('submit',async e=>{e.preventDefault();profile=await saveProfile({name:$('#profileName').value.trim(),homeAirport:$('#profileHome').value.trim(),currency:$('#profileCurrency').value,pace:$('#profilePace').value,interests:$('#profileInterests').value.split(',').map(x=>x.trim()).filter(Boolean)});updateUserChrome();toast('Traveller preferences saved.');});
  $('#loginBtn').addEventListener('click',showLoginModal);$('#signOutBtn').addEventListener('click',async()=>{try{await signOutFirebase();setCurrentUser(null);updateUserChrome();toast('Signed out to demo guest mode.');renderSettings();}catch(e){toast(e.message,'error');}});
  $('#agentHelp').addEventListener('click',()=>showModal({eyebrow:'AGENT37 PERSONAL CONNECTION',title:'What is needed to connect?',body:`<p>Agent37 Personal hosts a personal agent with its own workspace, task board and tools. The instance ID identifies the agent, but it is not itself a public chat URL or browser credential.</p><p>To enable embedded chat safely, provide a documented integration method supported by your Personal agent, or deploy a secure bridge that you control. Configure its URL in <code>js/config.js</code>. Do not use a Cloud API key, and do not expose secrets in frontend code.</p><p>This build intentionally does not invent an Agent37 endpoint or claim a connection that it cannot verify.</p>`,actions:[{label:'Understood',class:'btn-primary',onClick:closeModal}]}));
  $('#settingsTheme').addEventListener('click',toggleTheme);
}

async function showLoginModal() {
  showModal({eyebrow:'YOUR WAYFARER ACCOUNT',title:'Sign in or create an account',body:`<form id="authForm"><div class="field"><label for="authEmail">Email</label><input class="input" id="authEmail" type="email" required placeholder="you@example.com"></div><div class="field" style="margin-top:10px"><label for="authPassword">Password</label><input class="input" id="authPassword" type="password" minlength="6" required placeholder="At least 6 characters"></div><p class="card-sub" style="margin-top:10px">Firebase must be configured in js/config.js. For a quick product demo, choose Explore as guest in the sample app.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary" type="submit" data-auth-mode="signin">Sign in</button><button class="btn btn-outline" type="submit" data-auth-mode="signup">Create account</button></div></form>`,actions:[{label:'Close',class:'btn-outline',onClick:closeModal}]});
  $('#authForm').addEventListener('submit',async e=>{e.preventDefault();const mode=e.submitter?.dataset.authMode||'signin';try{const email=$('#authEmail').value,password=$('#authPassword').value;const result=mode==='signup'?await signUpEmail(email,password):await signInEmail(email,password);setCurrentUser(result.user);closeModal();updateUserChrome();toast('You are signed in.');routeTo('dashboard');}catch(error){toast(error.message,'error');}});
}

async function handleDestinationSave(destinationId) {
  const dest=DEMO_IMAGES.find(d=>d.id===destinationId);if(!dest)return;
  const saved=await listItems('wishlist');if(saved.some(s=>s.id===dest.id)){toast('This destination is already saved.');return;}
  await saveItem('wishlist',{...dest,id:dest.id,savedAt:new Date().toISOString()});toast(`${dest.name} added to your wishlist.`);
}
function planDestination(destinationId) {
  const dest=DEMO_IMAGES.find(d=>d.id===destinationId);if(!dest)return;
  routeTo('planner');plannerMessages=[{role:'assistant',text:`Let's shape a journey to ${dest.name}. The sample match score is ${dest.score}% because ${dest.reason.toLowerCase()} What dates and budget should I work with?`}];renderPlanner();
}

async function sendHelpMessage(message) {
  const text=message.trim();if(!text)return;
  helpMessages.push({role:'user',text});renderHelpMessages();$('#helpInput').value='';
  let answer;
  if (agent37ConnectionStatus().connected) {
    try {
      const response = await sendToAgent37({ message: `Answer this question about the WAYFARER AI website. Current page: ${currentRoute}. Explain only features that exist in this application. Do not claim an action has been performed. User question: ${text}`, conversation: helpMessages.slice(-10), profile, tools: ['get_trip','get_booking','search_destinations'] });
      answer = response.reply;
    } catch (error) { answer = `Agent37 was not available (${error.message}). Built-in website guide: ${helpAnswer(text)}`; }
  } else {
    answer = `${helpAnswer(text)}\n\nBuilt-in website guide · Agent37 is not connected.`;
  }
  helpMessages.push({role:'assistant',text:answer});renderHelpMessages();
}
function helpAnswer(message) {
  const q=message.toLowerCase();
  if(/workspace|agent|do the work|automation/.test(q))return 'Open AI Workspace from the left navigation. Describe the outcome you want, review the proposed execution plan and before/after view, then choose Confirm and apply. Rejected proposals do not change your saved trip. The demo planner is not Agent37.';
  if(/create|new trip|plan a trip|planner/.test(q))return 'Choose Trip Planner to describe your dates, budget, destination and interests. You can also ask AI Workspace to create a trip draft, then approve saving it.';
  if(/voucher|document|confirmation|booking/.test(q))return 'Open Bookings & Vouchers. Select a booking record to inspect its reference, dates and stored policy. Sample bookings are marked DEMO and are not real reservations.';
  if(/history|previous task|what did ai do/.test(q))return 'Open AI History to inspect each task, the original instruction, execution plan, approval status and recorded result.';
  if(/budget|cost|expense/.test(q))return 'Open Budget Planner to see the selected trip’s estimated cost by category. Ask AI Workspace to prepare a cost-optimization proposal.';
  if(/hotel|flight|experience|activity/.test(q))return 'Use Flights, Stays or Experiences from the left navigation to compare sample provider options. Every result is clearly marked DEMO until a live provider is configured.';
  if(/cancel|modify|refund/.test(q))return 'Open your booking record and choose Review demo cancellation, or ask AI Workspace to prepare a cancellation proposal. The prototype will not contact a real travel supplier.';
  if(/dark|theme|setting|profile/.test(q))return 'Open Settings to update your traveller profile, interests, home airport and currency. Use the sun/moon icon in the top bar to switch themes.';
  return 'I can guide you around Explore, Trip Planner, AI Workspace, My Trips, Budget Planner, Bookings, AI History and Settings. Tell me what you are trying to do and I will point you to the right place.';
}
function renderHelpMessages() {
  $('#helpMessages').innerHTML=helpMessages.map(m=>`<div class="chat-bubble ${m.role}">${escapeHTML(m.text)}</div>`).join('');$('#helpMessages').scrollTop=$('#helpMessages').scrollHeight;
}

function updateUserChrome() {
  const u=currentUser();const initial=(u.displayName||'G').trim()[0].toUpperCase();$('#sideUserName').textContent=u.displayName;$('#sideUserEmail').textContent=u.isDemo?'Demo account':u.email;$('#sideAvatar').textContent=initial;$('#topAvatar').textContent=initial;setAgentState();
}
function toggleTheme() {
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('wayfarer.theme',next);}catch{};$('#themeToggle').textContent=next==='dark'?'☾':'☼';
}

// Delegated interactions: every visible action is wired here.
document.addEventListener('click', async e => {
  const route=e.target.closest('[data-route]');if(route){e.preventDefault();routeTo(route.dataset.route);return;}
  const save=e.target.closest('[data-save-destination]');if(save){handleDestinationSave(save.dataset.saveDestination);return;}
  const plan=e.target.closest('[data-plan-destination]');if(plan){planDestination(plan.dataset.planDestination);return;}
  const openTripBtn=e.target.closest('[data-open-trip]');if(openTripBtn){openTrip(openTripBtn.dataset.openTrip);return;}
  const option=e.target.closest('[data-option-detail]');if(option){showOptionDetail(option.dataset.optionDetail,option.dataset.kind);return;}
  const booking=e.target.closest('[data-booking-detail]');if(booking){showBookingDetail(booking.dataset.bookingDetail,booking.dataset.trip);return;}
  const openTask=e.target.closest('[data-open-task]');if(openTask){inspectTask(openTask.dataset.openTask);return;}
  const download=e.target.closest('[data-download-file]');if(download){try{const url=await getPrivateFileUrl(download.dataset.downloadFile);window.open(url,'_blank','noopener');}catch(error){toast(error.message,'error');}return;}
  const pPrompt=e.target.closest('[data-planner-prompt]');if(pPrompt){sendPlannerMessage(pPrompt.dataset.plannerPrompt);return;}
  const wPrompt=e.target.closest('[data-work-prompt]');if(wPrompt){createWorkspaceTask(wPrompt.dataset.workPrompt);return;}
  const hPrompt=e.target.closest('[data-help]');if(hPrompt){sendHelpMessage(hPrompt.dataset.help);return;}
});

$('#modalClose').addEventListener('click',closeModal);
$('#themeToggle').addEventListener('click',toggleTheme);
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#helpAssistant').addEventListener('click',()=>{$('#helpDrawer').classList.add('open');$('#helpDrawer').setAttribute('aria-hidden','false');$('#helpInput').focus();});
$('#closeHelp').addEventListener('click',()=>{$('#helpDrawer').classList.remove('open');$('#helpDrawer').setAttribute('aria-hidden','true');});
$('#helpForm').addEventListener('submit',e=>{e.preventDefault();sendHelpMessage($('#helpInput').value);});
$('#notificationBtn').addEventListener('click',async()=>{const items=await listItems('notifications');showModal({eyebrow:'YOUR NOTIFICATION CENTRE',title:'A few things to know',body:items.length?items.map(n=>`<div class="budget-row"><span><strong>${escapeHTML(n.title)}</strong><br><small>${escapeHTML(n.body)}</small></span><small>${new Date(n.createdAt).toLocaleDateString('en-IN')}</small></div>`).join(''):'<p>No notifications yet.</p>',actions:[{label:'Close',class:'btn-primary',onClick:closeModal}]});});
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.toLowerCase();const routes=[['trip','trips'],['flight','flights'],['hotel','hotels'],['stay','hotels'],['experience','experiences'],['budget','budget'],['booking','bookings'],['workspace','workspace'],['destination','explore']];const found=routes.find(([term])=>q.includes(term));routeTo(found?found[1]:'explore');if(currentRoute==='explore'){$('#destinationSearch').value=q;filterDestinations();}}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();}if(e.key==='Escape')closeMobileNav();});

async function boot() {
  try {
    seedDemoData();
    const fb=await initFirebase();firebaseReady=fb.enabled;
    if(firebaseReady){onAuthChange(user=>{if(user){setCurrentUser(user);updateUserChrome();}else{setCurrentUser(null);updateUserChrome();}});}
    profile=await getProfile();updateUserChrome();
    routeTo('dashboard');
    if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  } catch(error) { console.error(error);toast('The app started with limited data. Check the console for details.','error'); }
}
boot();
