import { CONFIG } from './config.js';
import { initFirebase, onAuthChange, signInEmail, signUpEmail, signInGoogle, signOutFirebase, firebaseStatus } from './firebase.js';
import { purgeLegacyDemoRecords, setCurrentUser, getCurrentUser, saveItem, listItems, deleteItem, saveProfile, getProfile } from './store.js';
import { agent37ConnectionStatus, refreshAgent37Status, sendToAgent37, clearAgent37Session } from './agent37Adapter.js';
import { BUDGET_KEYS, budgetTotal, addDays } from './plan.js';
import { TravelProvider, weatherForDates, WMO } from './providers.js';
import { uploadPrivateFile, getPrivateFileUrl } from './storage.js';


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
let currentTripId = null, plannerTripId = null, plannerDraft = '', catalogPrefill = null, budgetTripId = null, agentBusy = false;

const money = (n, currency = CONFIG.currency || 'INR') => Number.isFinite(Number(n))
  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(n))
  : 'Price not provided';
const dateFmt = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentUser = () => getCurrentUser();
async function recordHistory(entry) {
  if (currentUser().isGuest) return; // Guest actions work; history is intentionally not retained.
  try { await saveItem('history', { id: id('history'), createdAt: new Date().toISOString(), ...entry }); } catch (error) { console.warn('History could not be saved', error); }
}

const FEATURE_DETAILS = {
  discovery: { title: 'Explore destinations', route: 'explore', intro: 'Discover real places and make more informed choices before you commit to a destination.', paragraphs: ['Search city and place records using Open-Meteo Geocoding. Results can include the destination name, country, administrative area, coordinates and population when the source provides it.', 'Open a result to check its current weather, save it to your wishlist for later, or use it as the starting point for a trip. The page is designed to make discovery a useful first step rather than a static gallery.', 'Because results come from a live source, availability and detail can vary by spelling and location coverage. WAYFARER does not invent ratings, prices or recommendations.'], note: 'Best for: comparing destination ideas, collecting places and checking basic location context.' },
  planner: { title: 'AI trip planner', route: 'planner', intro: 'Describe the journey in everyday language and shape it into a day-by-day plan.', paragraphs: ['You can include the origin, destination, dates, number of travellers, budget and the kind of activities you enjoy. The planner sends the request to your configured Agent37 Cloud assistant and displays the response in a conversation.', 'When the assistant returns a structured itinerary, WAYFARER can display each day with morning, afternoon and evening activities, travel notes and an estimated budget breakdown. You can review the proposal before choosing to save it as a trip.', 'Saved plans remain editable. Estimates are not supplier quotes, and the AI never silently books travel or changes a saved trip without your confirmation.'], note: 'Requires a signed-in Firebase account and a correctly configured, running Agent37 instance for AI responses. Guests can still use the rest of the planner workspace and local trip tools.' },
  workspace: { title: 'AI workspace', route: 'workspace', intro: 'A focused command area for sending travel-related instructions to your connected Agent37 assistant.', paragraphs: ['Use natural language to ask for planning help or a structured travel task. The workspace sends the instruction through the website server to your Agent37 Cloud Hermes instance, then records real responses and user-approved actions in its history.', 'Your browser does not contain the Agent37 API key. The server verifies a Firebase ID token before forwarding an authenticated request. If the instance or model provider is unavailable, the website shows the actual error instead of fabricating a result.', 'Review the execution history to understand what was requested and what response was received. Website changes and bookings are not performed automatically.'], note: 'Requires Firebase sign-in plus a configured Agent37 Cloud key, instance ID, base URL and usable model/provider.' },
  trips: { title: 'My trips', route: 'trips', intro: 'Keep the details of every journey together, from an early idea to a trip you have completed.', paragraphs: ['Create a trip record with its title, destination, origin, travel dates, traveller count, budget and status. Open a trip to review its itinerary, edit details, add costs or export a calendar file where supported.', 'Trip records are stored in the current guest workspace on this browser or in your signed-in account when Firebase and Firestore are configured. Guest records stay local to the device until you choose to sign in; they are not automatically uploaded or merged.', 'The trip dashboard only displays records that you or the assistant have actually saved. It does not create sample journeys or pretend that a booking exists.'], note: 'Best for: keeping each journey organised and returning to your decisions later.' },
  budget: { title: 'Budget planner', route: 'budget', intro: 'Understand the money you plan to spend and compare your estimates with costs you record.', paragraphs: ['The budget view separates an estimated trip budget from actual expenses that you enter. It can show a total and a per-person figure based on traveller count, as well as category-level amounts when an itinerary estimate includes them.', 'Add a real cost such as a train ticket, stay or activity as you go. WAYFARER updates the recorded-spend total and compares it with the budget you set, helping you see where your plan stands.', 'AI-generated numbers are clearly estimates, not live quotes. Actual supplier prices, taxes, exchange rates and fees should be checked before purchase.'], note: 'Best for: planning a realistic spending limit and tracking the costs you choose to enter.' },
  'travel-search': { title: 'Flights, stays & experiences', route: 'flights', intro: 'Prepare travel searches using the trip details you already know, then compare options directly with providers.', paragraphs: ['Flight, accommodation and activity forms collect useful search details such as route, city, dates, traveller count and interests. WAYFARER uses those details to open contextual searches on external provider websites.', 'The application does not currently fetch airline or hotel inventory itself. Final prices, availability, baggage, cancellation rules, taxes and booking terms are controlled by the provider and must be verified there.', 'When a trip already has dates and destinations, planner actions can prefill parts of the external search form so you do not have to enter the same details repeatedly.'], note: 'Best for: moving from a plan to a real-world comparison. WAYFARER does not make payments or bookings.' },
  documents: { title: 'Bookings & travel documents', route: 'bookings', intro: 'Keep your own booking details and travel documents together for easier reference.', paragraphs: ['Add booking information from a real supplier confirmation or upload supported PDF and image files when private file storage has been configured. Records can be associated with a trip and reviewed from the documents area.', 'The page only displays details you enter or files you actually upload. It does not generate booking references, claim a reservation has been made, or contact a supplier on your behalf.', 'Secure private uploads depend on the Firebase-verified signing function and storage configuration. Guests can use local trip notes and records, but private cloud file upload requires sign-in and the relevant backend setup.'], note: 'Best for: organising confirmations after you have booked directly with a travel provider.' },
  profile: { title: 'Personal travel profile', route: 'settings', intro: 'Set your travel preferences once so your workspace has useful context.', paragraphs: ['Your profile can hold a display name, home city or airport, preferred currency, travel pace and interests. You can update these details at any time from Settings.', 'Only preferences you provide are used as context for the travel assistant. They are not a substitute for trip dates, traveller counts or other information that changes from one journey to another.', 'In guest mode your profile is saved in this browser. After sign-in, profile information is saved within your account when Firebase storage is available.'], note: 'Best for: reducing repeated setup and keeping your planning preferences consistent.' },
  flights: { title: 'Flight search', route: 'flights', intro: 'Prepare flight searches with a route, dates and traveller count.', paragraphs: ['Enter an origin, destination, departure date, optional return date and adult count. WAYFARER builds a search link for an external flight provider so you can check the current options.', 'Supplier websites control current schedules, fare rules, baggage, taxes, seats and availability. Review all final terms before purchase.'], note: 'WAYFARER does not sell tickets, guarantee fares or complete flight bookings.' },
  stays: { title: 'Stays search', route: 'hotels', intro: 'Compare accommodation options using the city, stay dates and number of adults.', paragraphs: ['The stay form prepares searches for external accommodation providers. Use it to continue from a trip plan or enter a new destination and dates.', 'Check total price, local taxes, cancellation policy, room details and property terms on the provider site before booking.'], note: 'No hotel inventory or live room pricing is hosted by WAYFARER.' },
  experiences: { title: 'Experiences', route: 'experiences', intro: 'Find activity ideas and continue to external experience search providers.', paragraphs: ['Choose a destination and the kind of experience you are interested in, such as adventure, guided tours, food or culture. WAYFARER prepares a contextual search for you.', 'Listings, suitability, availability and prices are controlled by the external sites. Check age, accessibility, safety and cancellation information before you book.'], note: 'Best for: adding activities to a journey after you have chosen where to go.' },
  history: { title: 'AI history', route: 'history', intro: 'Review records of actual assistant responses and approved actions.', paragraphs: ['The history area lists completed tasks and responses that were genuinely received. Open a record to inspect its instruction, reply and execution log.', 'It is intentionally transparent: the app does not pre-populate the history with demo tasks or claim that an action ran when it did not.'], note: 'AI history is most useful when you want to review previous planning requests.' },
  wishlist: { title: 'Wishlist', route: 'wishlist', intro: 'Collect destination ideas and return to them when you are ready to plan.', paragraphs: ['Save a place from destination search and it appears in your wishlist. Reopen its location details, check weather or use it to start a new trip.', 'Saved places live in your guest browser workspace or signed-in account depending on the current session and available cloud sync.'], note: 'Best for: building a shortlist before choosing your next destination.' },
  support: { title: 'Travel support notes', route: 'support', intro: 'Record a travel question or issue so you can keep the context with your workspace.', paragraphs: ['Choose a topic and write the details of a question, disruption, accessibility need or other travel concern. The note is saved for your own reference.', 'This is not a live helpdesk or an active supplier ticket. It does not automatically send the request to a human support team or airline.'], note: 'Best for: keeping your own travel notes and follow-up context in one place.' },
  weather: { title: 'Weather context', route: 'explore', intro: 'Check forecast information for a destination before you decide what to do.', paragraphs: ['Select Weather on a destination result to request location-based weather from Open-Meteo. The result can include the current conditions and forecast data returned by that provider.', 'Weather is changeable and should be checked again close to departure. Use it as planning context, not a guarantee of conditions at your travel time.'], note: 'Weather coverage depends on the destination coordinates and provider response.' },
  currency: { title: 'Currency reference', route: 'settings', intro: 'Use public reference exchange-rate information as a planning aid.', paragraphs: ['The application can retrieve indicative exchange rates from Frankfurter for supported currency pairs. These reference rates can help you estimate a budget in another currency.', 'They are not live cash, card or bank rates and do not include your provider\'s spreads or fees. Check with your bank or payment provider before exchanging money.'], note: 'Reference information only; not a transaction or a guaranteed exchange quote.' }
};

const FEATURE_PREVIEWS = {
  discover: { icon: '⌖', kicker: 'THE FIRST STEP', title: 'Find a place that feels right.', body: 'Search real destinations, review the location context and check current weather. Save ideas to a wishlist so inspiration has somewhere to go.', cta: 'Explore destinations ↗', route: 'explore' },
  plan: { icon: '✳', kicker: 'MAKE IT YOURS', title: 'Shape the journey around you.', body: 'Describe dates, travellers, budget and interests. Review a structured day-by-day proposal, refine it and save only when you are ready.', cta: 'Open trip planner ↗', route: 'planner' },
  organise: { icon: '▤', kicker: 'KEEP IT TOGETHER', title: 'All the details have a home.', body: 'Keep trips, saved places, cost records, support notes and booking documents organised in a connected workspace.', cta: 'View my trips ↗', route: 'trips' },
  compare: { icon: '↗', kicker: 'YOUR CALL, ALWAYS', title: 'Compare options with clarity.', body: 'Use contextual links to open external flight, stay and activity searches. Check the provider\'s current prices and terms before you decide.', cta: 'Compare travel options ↗', route: 'flights' }
};

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
  const names = { dashboard:'Overview', explore:'Explore destinations', planner:'Trip planner', workspace:'AI Workspace', trips:'My trips', flights:'Flights', hotels:'Stays', experiences:'Experiences', budget:'Budget planner', trip:'Trip details', bookings:'Bookings & documents', history:'AI history', wishlist:'Wishlist', support:'Travel support', settings:'Settings' };
  $('#breadcrumbCurrent').textContent = names[route] || 'Overview';
  const pendingRender = renderRoute(route); content.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' });
  return pendingRender;
}
async function renderRoute(route) {
  try {
    switch (route) {
      case 'dashboard': return await renderDashboard();
      case 'explore': return await renderExplore();
      case 'planner': return await renderPlanner();
      case 'workspace': return await renderWorkspace();
      case 'trips': return await renderTrips();
      case 'trip': return await renderTripPage();
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
    <div class="grid grid-2" style="margin-top:16px"><div class="card"><p class="eyebrow">AGENT STATUS</p><h3>${ag.connected ? 'Agent37 Cloud configured' : 'Agent37 not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p><button class="btn btn-outline btn-small" data-route="settings">Integration settings ↗</button></div><div class="card"><p class="eyebrow">DATA POLICY</p><h3>No invented travel results</h3><p class="card-sub">WAYFARER never invents fares or hotel prices. External providers show their own live availability and final terms.</p></div></div>`;
  if (currentUser().isGuest) content.insertAdjacentHTML('afterbegin', `<div class="guest-banner"><p><strong>You're exploring as a guest.</strong> Your trips, saved places and preferences stay in this browser. Guest searches and planning activity are not saved to history. Sign in to sync account data across devices and unlock private AI requests.</p><button class="btn btn-primary btn-small" data-landing-login>Sign in / create account ↗</button></div>`);
  content.insertAdjacentHTML('beforeend', `<div class="section-head"><div><h2>Explore your workspace</h2><p>Choose a feature to understand what it does, or open the guided tour for a complete walkthrough.</p></div><button class="btn btn-outline btn-small" id="dashboardTourShortcut">✦ Start guided tour</button></div>
    <div class="feature-atlas">
      <button class="atlas-card" data-feature="discovery"><span>⌖</span><strong>Destination discovery</strong><small>Live place search, weather context and saved destination ideas.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="planner"><span>✳</span><strong>AI trip planner</strong><small>Conversational planning, editable day-by-day itineraries and review steps.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="trips"><span>▤</span><strong>My trips</strong><small>Dates, travellers, trip status, itinerary and personal records.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="budget"><span>◎</span><strong>Budget planner</strong><small>Estimate breakdowns, per-person totals and recorded expenses.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="travel-search"><span>✈</span><strong>Travel search</strong><small>Contextual links for flights, stays and activity providers.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="documents"><span>▣</span><strong>Documents</strong><small>Keep uploaded confirmations and your own booking records.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="workspace"><span>⌘</span><strong>AI workspace</strong><small>Agent37 requests, actual responses and transparent execution history.</small><em>Understand this feature ↗</em></button>
      <button class="atlas-card" data-feature="profile"><span>◉</span><strong>Travel profile</strong><small>Personal preferences, home airport, currency and travel pace.</small><em>Understand this feature ↗</em></button>
    </div>`);
  $('#dashboardTourShortcut')?.addEventListener('click', startWebsiteTour);
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
    await recordHistory({ kind: 'search', title: `Destination search: ${query}`, query, summary: `${livePlaces.length} live place result(s) returned.` });
    grid.innerHTML = livePlaces.length ? `<div class="grid grid-3">${livePlaces.map(destinationCard).join('')}</div>` : emptyState('⌕','No live matches','Try another spelling or a larger city.');
  } catch (error) { grid.innerHTML = emptyState('!','Place search unavailable',escapeHTML(error.message)); }
}
function destinationCard(place) {
  return `<article class="card destination-card"><div class="destination-img"><span class="match-pill">LIVE PLACE DATA</span></div><div class="destination-info"><h3>${escapeHTML(place.name)}</h3><p>${escapeHTML([place.admin1, place.country].filter(Boolean).join(', '))}</p><div class="meta-row"><span>Latitude ${Number(place.latitude).toFixed(3)}</span><span>Longitude ${Number(place.longitude).toFixed(3)}</span></div><p style="margin-top:10px">${place.population ? `Population: ${Number(place.population).toLocaleString('en-IN')}` : 'Population not supplied by source'}</p><small class="muted">Source: ${escapeHTML(place.source)}</small><div class="card-actions"><button class="btn btn-outline btn-small" data-save-place="${escapeHTML(place.id)}">♡ Save place</button><button class="btn btn-primary btn-small" data-plan-place="${escapeHTML(place.id)}">Use in trip ↗</button><button class="btn btn-outline btn-small" data-weather-place="${escapeHTML(place.id)}">Weather</button></div></div></article>`;
}

function planCard(plan, idx) {
  const total = budgetTotal(plan.budgetEstimate); const trav = Math.max(1, plan.travellers || 1);
  const rows = BUDGET_KEYS.filter(([k]) => plan.budgetEstimate[k] !== undefined).map(([k, label]) => `<div class="budget-row"><span>${label}</span><strong>${money(plan.budgetEstimate[k])}</strong></div>`).join('');
  const dates = plan.startDate ? `${dateFmt(plan.startDate)} — ${dateFmt(plan.endDate)}` : `${plan.days.length} days · dates not set`;
  const existing = plan.tripId ? 'update' : 'new';
  return `<article class="plan-card"><div class="plan-head"><div><span class="pill">AI PROPOSAL · NOT SAVED YET</span><h3>${escapeHTML(plan.title)}</h3><p>${escapeHTML(plan.origin ? `${plan.origin} → ` : '')}${escapeHTML(plan.destination)} · ${dates} · ${plan.travellers} traveller${plan.travellers === 1 ? '' : 's'}</p></div></div>
  ${plan.summary ? `<p class="plan-summary">${escapeHTML(plan.summary)}</p>` : ''}
  <div class="plan-days">${plan.days.map(d => itineraryDayHTML(d)).join('')}</div>
  ${rows ? `<div class="plan-budget"><p class="eyebrow">BUDGET ESTIMATE · NOT A QUOTE</p>${rows}<div class="budget-row total"><span>Estimated total</span><strong>${money(total)}</strong></div><div class="budget-row"><span>Per person (${trav})</span><strong>${money(total / trav)}</strong></div>${plan.budget ? `<div class="budget-row"><span>Your stated budget</span><strong>${money(plan.budget)}</strong></div>` : ''}</div>` : ''}
  ${plan.assumptions.length ? `<ul class="plan-assumptions">${plan.assumptions.map(a => `<li>${escapeHTML(a)}</li>`).join('')}</ul>` : ''}
  <div class="plan-actions"><button class="btn btn-primary btn-small" data-save-plan="${idx}">${existing === 'update' ? 'Review & update trip' : 'Review & save as trip'}</button><button class="btn btn-outline btn-small" data-plan-search="flights" data-plan-idx="${idx}">✈ Flights</button><button class="btn btn-outline btn-small" data-plan-search="hotels" data-plan-idx="${idx}">⌂ Stays</button><button class="btn btn-outline btn-small" data-plan-search="experiences" data-plan-idx="${idx}">◇ Activities</button></div>
  <p class="card-sub">Costs are AI estimates. Check real prices on provider sites; nothing here is booked.</p></article>`;
}
function itineraryDayHTML(d) {
  const slot = (label, v) => v ? `<div class="slot"><b>${label}</b><span>${escapeHTML(v)}</span></div>` : '';
  return `<div class="plan-day"><div class="plan-day-head"><span class="step-number">${d.day}</span><div><strong>${escapeHTML(d.title || `Day ${d.day}`)}</strong>${d.date ? `<small>${dateFmt(d.date)}</small>` : ''}</div>${d.estCost ? `<span class="pill">≈ ${money(d.estCost)}</span>` : ''}</div>${slot('Morning', d.morning)}${slot('Afternoon', d.afternoon)}${slot('Evening', d.evening)}${d.travel ? `<div class="slot"><b>Travel</b><span>${escapeHTML(d.travel)}</span></div>` : ''}</div>`;
}
function messageHTML(m, i) {
  const body = m.pending ? '<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>' : escapeHTML(m.text).replace(/\n/g, '<br>');
  return `<div class="chat-bubble ${m.role}${m.error ? ' error' : ''}">${body}</div>${m.plan ? planCard(m.plan, i) : ''}`;
}
function renderPlannerMessages() {
  const el = $('#plannerMessages'); if (!el) return;
  el.innerHTML = plannerMessages.map(messageHTML).join('') || `<div class="chat-bubble assistant">Hi! Tell me where you're going, for how long, your budget and what you enjoy — for example: “Delhi to Manali, 4 days, ₹15,000, mountains and adventure, budget hotels.” I'll ask for anything missing, then build a day-by-day plan you can review and save.</div>`;
  el.scrollTop = el.scrollHeight;
}
async function renderPlanner() {
  const status = agent37ConnectionStatus(); const user = currentUser();
  const trips = await listItems('trips'); const ctxTrip = trips.find(t => t.id === plannerTripId);
  if (plannerTripId && !ctxTrip) plannerTripId = null;
  content.innerHTML = `${pageHead('CONVERSATIONAL TRIP PLANNER','Start with what matters.','Describe your trip in plain language. Your Agent37 Cloud assistant asks follow-up questions, then proposes a plan you review before anything is saved.')}
  <div class="chat-layout"><section class="card chat-panel"><div class="chat-panel-head"><div class="assistant-avatar">✳</div><div><h3>Travel Concierge</h3><small>${status.connected ? 'Agent37 Cloud configured · connection verified when you send' : 'Agent37 Cloud not configured'}</small></div><button class="btn btn-outline btn-small" id="newConversation" type="button">New chat</button></div>
  ${user.isGuest ? `<div class="notice">Sign in to chat with the AI assistant. You can still create and edit trips on this device without an account. <button class="btn btn-primary btn-small" id="plannerSignIn" type="button">Sign in</button></div>` : ''}
  ${ctxTrip ? `<div class="notice">Editing <b>${escapeHTML(ctxTrip.title || ctxTrip.destination)}</b> — ask for changes like “make day 2 more relaxed”. <button class="btn btn-outline btn-small" id="clearPlannerTrip" type="button">Clear</button></div>` : ''}
  <div class="chat-scroll" id="plannerMessages" aria-live="polite"></div>
  <div class="suggestions"><button data-planner-fill="Plan a 4-day trip from Delhi to Manali for 2 people with a budget of ₹15,000. We like mountains, adventure activities and budget-friendly hotels.">Example: Delhi → Manali</button><button data-planner-fill="Suggest destinations for a 5-day relaxed beach holiday in December under ₹30,000 per person.">Suggest destinations</button><button data-planner-fill="What information do you need to plan a trip for me?">What do you need?</button></div>
  <form class="chat-compose" id="plannerForm"><button class="icon-btn" id="plannerVoice" type="button" aria-label="Use voice input">⌁</button><input id="plannerInput" placeholder="Describe your trip…" autocomplete="off" maxlength="2000" aria-label="Message to travel concierge"><button type="submit" id="plannerSend" aria-label="Send message">↑</button></form></section>
  <aside class="grid"><div class="card"><p class="eyebrow">YOUR TRAVEL PROFILE</p><h3>Personal travel preferences</h3><p class="card-sub">Only preferences you provide are shared with the AI.</p><div class="divider"></div><div class="budget-row"><span>Home city / airport</span><strong>${escapeHTML(profile?.homeAirport || 'Not provided')}</strong></div><div class="budget-row"><span>Currency</span><strong>${escapeHTML(profile?.currency || 'INR')}</strong></div><div class="budget-row"><span>Interests</span><strong>${escapeHTML((profile?.interests || []).join(', ') || 'Not provided')}</strong></div><button class="btn btn-outline btn-small" style="margin-top:12px" data-route="settings">Edit profile ↗</button></div>
  <div class="card"><p class="eyebrow">HOW IT WORKS</p><h3>You stay in control</h3><p class="card-sub">The AI proposes; you review and confirm before a trip is saved or changed. Flights, stays and activities open external search sites. WAYFARER never books or pays on your behalf.</p></div></aside></div>`;
  renderPlannerMessages();
  if (plannerDraft) { $('#plannerInput').value = plannerDraft; plannerDraft = ''; $('#plannerInput').focus(); }
  $('#plannerForm').addEventListener('submit', async e => { e.preventDefault(); await sendAgentMessage($('#plannerInput').value); });
  $('#plannerVoice').addEventListener('click', () => startVoiceInput($('#plannerInput')));
  $('#plannerSignIn')?.addEventListener('click', showLoginModal);
  $('#clearPlannerTrip')?.addEventListener('click', () => { plannerTripId = null; renderPlanner(); });
  $('#newConversation').addEventListener('click', () => { plannerMessages = []; clearAgent37Session(); renderPlannerMessages(); toast('Started a new conversation.'); });
}
async function sendAgentMessage(message) {
  const text = String(message || '').trim(); if (!text || agentBusy) return;
  const input = $('#plannerInput'); if (input) input.value = '';
  plannerMessages.push({ role: 'user', text });
  if (currentUser().isGuest) {
    plannerMessages.push({ role: 'assistant', error: true, text: 'Please sign in first — the AI assistant is only available to signed-in users so your usage stays private and protected.' });
    renderPlannerMessages(); showLoginModal(); return;
  }
  if (!agent37ConnectionStatus().connected) {
    plannerMessages.push({ role: 'assistant', error: true, text: 'Agent37 Cloud is not configured on the server. Check AGENT37_API_KEY, AGENT37_INSTANCE_ID and AGENT37_BASE_URL in Vercel, then redeploy. No fake response was generated.' });
    renderPlannerMessages(); return;
  }
  agentBusy = true; const sendBtn = $('#plannerSend'); if (sendBtn) sendBtn.disabled = true;
  const pending = { role: 'assistant', text: '', pending: true }; plannerMessages.push(pending); renderPlannerMessages();
  try {
    const trips = await listItems('trips');
    const response = await sendToAgent37({ message: text, profile, trip: trips.find(t => t.id === plannerTripId) || null });
    pending.pending = false; pending.text = response.reply; pending.plan = response.plan;
    if (response.plan) await recordHistory({ kind: 'plan', title: `Itinerary generated: ${response.plan.destination || 'travel plan'}`, query: response.plan.destination || text, summary: `${response.plan.days?.length || 0} day(s) proposed · not yet saved as a trip` });
    if (response.planInvalid) pending.text += '\n\n(The AI included a plan, but it could not be read safely, so no plan card was created. Try asking again.)';
  } catch (error) {
    pending.pending = false; pending.error = true; pending.text = `Agent37 request failed: ${error.message}`;
  } finally {
    agentBusy = false; const b = $('#plannerSend'); if (b) b.disabled = false;
  }
  if (currentRoute === 'planner') renderPlannerMessages();
}
async function confirmSavePlan(idx) {
  const plan = plannerMessages[idx]?.plan; if (!plan) return toast('That plan is no longer available.', 'error');
  const trips = await listItems('trips'); const existing = plan.tripId ? trips.find(t => t.id === plan.tripId) : null;
  const summary = existing ? `Replace the itinerary and budget estimate of “${existing.title || existing.destination}” (${(existing.days || []).length} current days → ${plan.days.length} days).` : `Create a new trip to ${plan.destination} with ${plan.days.length} itinerary days.`;
  showModal({ eyebrow: 'CONFIRM · NOTHING IS BOOKED', title: existing ? 'Update this trip?' : 'Save this trip?', body: `<p>${escapeHTML(summary)}</p><p class="card-sub">Only your WAYFARER trip record is changed. No bookings or payments are made, and costs stay marked as estimates.</p>`, actions: [
    { label: 'Cancel', class: 'btn-outline', onClick: closeModal },
    { label: existing ? 'Confirm update' : 'Confirm & save', class: 'btn-primary', onClick: async () => {
      try {
        const base = existing || { id: id('trip'), status: 'draft', bookings: [], costs: [], createdAt: new Date().toISOString() };
        const trip = { ...base, title: plan.title, destination: plan.destination, origin: plan.origin || base.origin || '', startDate: plan.startDate || base.startDate || '', endDate: plan.endDate || base.endDate || '', travellers: plan.travellers, budget: base.budget ?? plan.budget ?? null, days: plan.days, budgetEstimate: plan.budgetEstimate, summary: plan.summary, assumptions: plan.assumptions, source: 'agent37-proposal' };
        await saveItem('trips', trip); await recordHistory({ kind: 'plan', title: `AI itinerary saved: ${trip.destination}`, query: trip.destination, summary: `${trip.days.length} day(s) · ${dateFmt(trip.startDate)} — ${dateFmt(trip.endDate)}` });
        await saveItem('tasks', { id: id('task'), title: existing ? 'Itinerary updated' : 'Trip saved from AI plan', instruction: `Saved “${trip.title}” after your confirmation.`, status: 'completed', source: 'Agent37 Cloud', createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: `User confirmed; ${existing ? 'updated' : 'created'} trip record. Nothing was booked.` }] });
        closeModal(); toast('Trip saved.'); openTrip(trip.id);
      } catch (error) { toast(error.message, 'error'); }
    } }
  ] });
}
function openSearchFor(kind, t) {
  const today = new Date().toISOString().slice(0, 10);
  catalogPrefill = { kind, origin: t.origin || '', destination: t.destination || '', start: t.startDate >= today ? t.startDate : '', end: t.endDate >= today ? t.endDate : '', adults: Math.min(9, Math.max(1, Number(t.travellers) || 1)) };
  recordHistory({ kind: 'search', title: `${kind} search: ${t.destination || 'trip'}`, query: [t.origin, t.destination, catalogPrefill.start, catalogPrefill.end].filter(Boolean).join(' → '), summary: `Prepared ${kind} search from trip details.` });
  routeTo(kind);
}
function applyCatalogPrefill(kind) {
  const p = catalogPrefill; catalogPrefill = null; if (!p || p.kind !== kind) return;
  const set = (sel, v) => { const el = $(sel); if (el && v) el.value = v; };
  if (kind === 'flights') { set('#flightOrigin', p.origin); set('#flightDestination', p.destination); set('#flightDepart', p.start); set('#flightReturn', p.end); set('#flightAdults', p.adults); }
  if (kind === 'hotels') { set('#hotelCity', p.destination); set('#hotelCheckin', p.start); set('#hotelCheckout', p.end); set('#hotelAdults', p.adults); }
  if (kind === 'experiences') set('#activityCity', p.destination);
}

async function renderWorkspace() {
  const tasks = await listItems('tasks'); const ag = agent37ConnectionStatus();
  content.innerHTML = `${pageHead('YOUR AI COMMAND CENTRE','Tell your agent what to do.','The workspace sends your instruction to your Agent37 Cloud Hermes instance. Website changes are not applied automatically.')}
  ${currentUser().isGuest ? `<div class="guest-banner"><div><p><strong>Guest access is on.</strong> You can explore the workspace and review how it works. Sending private Agent37 requests requires a Firebase account so your requests stay authenticated.</p></div><button class="btn btn-primary btn-small" id="workspaceSignIn" type="button">Sign in to unlock AI ↗</button></div>` : ''}
  <div class="grid grid-2" style="margin-bottom:16px"><div class="card"><p class="eyebrow">AGENT STATUS</p><h3>${ag.connected ? 'Agent37 Cloud configured' : 'Agent37 is not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p>${statusPill(ag.connected ? 'VERIFY ON FIRST REQUEST' : 'NO FAKE FALLBACK', false)} <button class="btn btn-outline btn-small" data-route="settings">Settings ↗</button></div><div class="card"><p class="eyebrow">APPROVAL POLICY</p><h3>You stay in control.</h3><p class="card-sub">The AI can advise and plan in chat. It does not automatically modify saved trips or make bookings. This website cannot book or cancel travel inventory without a supplier booking integration.</p></div></div>
  <section class="workspace-panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><p class="eyebrow">NATURAL LANGUAGE TASKS</p><h3 style="font:600 27px 'Cormorant Garamond',serif;color:var(--brown);margin:0">Your travel operations desk</h3></div><span class="pill">✳ Agent Workspace</span></div>
  <form id="workspaceForm"><div class="workspace-composer"><textarea id="workspaceInput" placeholder="Example: Create a trip for my chosen destination using the dates and budget I provide…" aria-label="Describe a task"></textarea><div style="display:grid;gap:6px"><button class="icon-btn" id="workspaceVoice" type="button" aria-label="Use voice input">⌁</button><button class="btn btn-primary" type="submit">Send to Agent37 ↗</button></div></div><div class="workspace-tools"><span class="muted" style="font-size:10px">No local demo agent · no simulated tool results</span><span class="muted" style="font-size:10px">Voice input where supported</span></div></form></section>
  <div class="section-head"><div><h2>Execution history</h2><p>Only real Agent37 responses and user-created records are recorded.</p></div><button class="btn btn-outline btn-small" data-route="history">Full history ↗</button></div>
  ${tasks.length ? `<div class="grid">${tasks.map(taskCard).join('')}</div>` : emptyState('✣','No AI tasks yet','Sign in and send your first task to Agent37 Cloud.')}`;
  $('#workspaceSignIn')?.addEventListener('click', showLoginModal);
  $('#workspaceForm').addEventListener('submit', async e => { e.preventDefault(); await createWorkspaceTask($('#workspaceInput').value); });
  $('#workspaceVoice').addEventListener('click', () => startVoiceInput($('#workspaceInput')));
}
function taskCard(task) {
  return `<article class="card" style="padding:15px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><span class="pill">${escapeHTML(task.status)}</span><h3 style="margin-top:8px">${escapeHTML(task.title)}</h3><p class="card-sub">${escapeHTML(task.instruction)}</p><p class="card-sub">${new Date(task.createdAt).toLocaleString('en-IN')}</p></div><button class="btn btn-outline btn-small" data-open-task="${escapeHTML(task.id)}">Inspect ↗</button></div></article>`;
}
async function createWorkspaceTask(instruction) {
  const text = String(instruction || '').trim(); if (!text) return;
  if (!agent37ConnectionStatus().connected) return toast('Agent37 Cloud is not configured. Check Vercel environment variables.', 'error');
  try {
    const response = await sendToAgent37({ message: `Help me plan this WAYFARER task. Do not claim any website changes were made. Explain the recommended next steps and ask for approval before suggesting an action. User request: ${text}`, profile, trip: null });
    const task = { id: id('task'), title: 'Agent37 response', instruction: text, reply: response.reply, status: 'completed', action: null, source: 'Agent37 Cloud Hermes', createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: 'Agent37 returned a real response. No website action was automatically executed.' }] };
    await saveItem('tasks', task);
    showModal({ eyebrow: 'AGENT37 RESPONSE', title: 'Your agent replied', body: `<p>${escapeHTML(response.reply)}</p><p class="card-sub">No website changes were automatically executed.</p>`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] });
    if (currentRoute === 'workspace') renderWorkspace();
  } catch (error) { toast(`Agent task failed: ${error.message}`, 'error'); }
}
async function createApprovedAgentTask(instruction, reply, action) {
  const task = { id: id('task'), title: `Review ${action.name.replaceAll('_',' ')}`, instruction, reply, status: 'awaiting-approval', action, source: 'Agent37 Cloud Hermes', createdAt: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: 'Agent37 proposed an allowlisted action; waiting for user approval.' }] };
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
    await saveItem('trips', trip); await recordHistory({ kind: 'trip', title: `Trip planned: ${trip.destination}`, query: trip.destination, summary: `${dateFmt(startDate)} — ${dateFmt(endDate)} · ${trip.travellers} traveller(s)` }); closeModal(); toast('Your trip was saved.'); routeTo('trips');
  });
}
function openTrip(tripId) { currentTripId = tripId; routeTo('trip'); }
const TRIP_STATUSES = ['draft', 'planned', 'booked-elsewhere', 'completed', 'cancelled'];
function dayEditHTML(d, i) {
  return `<div class="day-edit" data-day-index="${i}"><div class="day-edit-head"><span class="step-number">${i + 1}</span><input class="input" data-f="title" maxlength="160" placeholder="Day title" value="${escapeHTML(d.title)}" aria-label="Day ${i + 1} title">${d.date ? `<small class="muted">${dateFmt(d.date)}</small>` : ''}<button class="btn btn-outline btn-small" type="button" data-remove-day="${i}" aria-label="Remove day ${i + 1}">Remove</button></div>
  <div class="form-grid"><div class="field"><label>Morning</label><textarea class="textarea" data-f="morning" maxlength="600">${escapeHTML(d.morning)}</textarea></div><div class="field"><label>Afternoon</label><textarea class="textarea" data-f="afternoon" maxlength="600">${escapeHTML(d.afternoon)}</textarea></div><div class="field"><label>Evening</label><textarea class="textarea" data-f="evening" maxlength="600">${escapeHTML(d.evening)}</textarea></div><div class="field"><label>Travel notes</label><textarea class="textarea" data-f="travel" maxlength="600">${escapeHTML(d.travel)}</textarea></div></div>
  <div class="field" style="max-width:220px"><label>Estimated cost for the day (₹)</label><input class="input" data-f="estCost" type="number" min="0" step="1" value="${d.estCost ?? ''}"></div></div>`;
}
function collectDays(trip) {
  return $$('.day-edit').map((el, i) => {
    const v = f => el.querySelector(`[data-f="${f}"]`).value.trim(); const cost = el.querySelector('[data-f="estCost"]').value;
    return { day: i + 1, date: trip.startDate ? addDays(trip.startDate, i) : '', title: v('title'), morning: v('morning'), afternoon: v('afternoon'), evening: v('evening'), travel: v('travel'), estCost: cost === '' ? null : Math.max(0, Number(cost) || 0) };
  });
}
async function shareTripCard(trip) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, '#244c5b'); gradient.addColorStop(.55, '#386c79'); gradient.addColorStop(1, '#829a98');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(229,239,235,.08)'; for (let y=24;y<630;y+=38) for (let x=24;x<1200;x+=38) { ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill(); }
  ctx.fillStyle='#d7e2d9';ctx.font='600 24px Arial';ctx.fillText('WAYFARER · TRAVEL CARD',70,82);
  ctx.fillStyle='#f4f3e8';ctx.font='bold 64px Georgia';ctx.fillText((trip.destination || 'Your journey').slice(0,32),70,210);
  ctx.fillStyle='#dbe8e1';ctx.font='28px Arial';ctx.fillText(`${trip.origin ? trip.origin + '  →  ' : ''}${trip.destination || ''}`.slice(0,56),70,270);
  ctx.font='24px Arial';ctx.fillText(`${trip.startDate ? dateFmt(trip.startDate) : 'Dates flexible'}${trip.endDate ? '  —  ' + dateFmt(trip.endDate) : ''}`,70,340);
  ctx.fillText(`${Number(trip.travellers || 1)} traveller(s)  ·  ${trip.days?.length || 0} planned day(s)`,70,400);
  if (trip.summary) { ctx.font='20px Arial'; const summary=trip.summary.slice(0,130);ctx.fillText(summary,70,470); }
  ctx.fillStyle='#d5e3d9';ctx.font='18px Arial';ctx.fillText('A journey planned with WAYFARER AI',70,570);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) return toast('Could not create travel card image.', 'error');
  const file = new File([blob], `${(trip.destination || 'travel').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-wayfarer-card.png`, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ title: `Trip to ${trip.destination}`, text: 'My travel plan created with WAYFARER AI', files: [file] }); return; } catch (error) { if (error.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Travel card image downloaded. Share it anywhere.');
}

async function renderTripPage() {
  const trips = await listItems('trips'); const trip = trips.find(t => t.id === currentTripId);
  if (!trip) { content.innerHTML = `${pageHead('TRIP NOT FOUND','This trip is not available.','It may have been deleted or belongs to another account.')}${emptyState('▤','Nothing to show','Go back to your trips.','<button class="btn btn-primary" data-route="trips">My trips</button>')}`; return; }
  const days = trip.days || []; const be = trip.budgetEstimate || {}; const est = budgetTotal(be); const trav = Math.max(1, Number(trip.travellers) || 1);
  content.innerHTML = `${pageHead('TRIP DETAILS', escapeHTML(trip.title || trip.destination), `${escapeHTML(trip.origin ? `${trip.origin} → ` : '')}${escapeHTML(trip.destination)} · ${dateFmt(trip.startDate)} — ${dateFmt(trip.endDate)}`, `<div class="head-actions"><button class="btn btn-outline btn-small" id="shareTripBtn">Share travel card ↗</button><button class="btn btn-outline btn-small" id="editTripBtn">Edit details</button><button class="btn btn-primary btn-small" id="askAiTripBtn">✳ Ask AI to modify</button></div>`)}
  <div class="grid grid-4"><div class="card stat-card"><div><small>Status</small><strong style="font-size:18px">${escapeHTML(trip.status || 'draft')}</strong></div></div><div class="card stat-card"><div><small>Travellers</small><strong>${trav}</strong></div></div><div class="card stat-card"><div><small>Your budget</small><strong style="font-size:20px">${trip.budget ? money(trip.budget) : 'Not set'}</strong></div></div><div class="card stat-card"><div><small>Estimated total</small><strong style="font-size:20px">${est ? money(est) : '—'}</strong></div></div></div>
  ${trip.summary ? `<div class="card" style="margin-top:16px"><p class="eyebrow">OVERVIEW</p><p>${escapeHTML(trip.summary)}</p>${(trip.assumptions || []).length ? `<ul class="plan-assumptions">${trip.assumptions.map(a => `<li>${escapeHTML(a)}</li>`).join('')}</ul>` : ''}</div>` : ''}
  <div class="section-head"><div><h2>Weather</h2><p>Forecast from Open-Meteo for the destination.</p></div></div><div class="card" id="tripWeather">Loading forecast…</div>
  <div class="section-head"><div><h2>Itinerary</h2><p>Edit anything, then save. Changes only affect your trip record.</p></div></div>
  <form id="itineraryForm">${days.length ? days.map(dayEditHTML).join('') : emptyState('◷','No itinerary yet','Ask the AI to draft one, or add days yourself.','<button class="btn btn-primary" type="button" id="askAiEmpty">✳ Ask AI to plan this trip</button>')}<div class="plan-actions" style="margin-top:12px"><button class="btn btn-outline btn-small" type="button" id="addDayBtn">＋ Add day</button>${days.length ? '<button class="btn btn-primary btn-small" type="submit">Save itinerary</button>' : ''}</div></form>
  <div class="section-head"><div><h2>Budget estimate</h2><p>Your own or AI estimates, clearly not confirmed prices.</p></div></div>
  <form class="card" id="budgetEstForm"><div class="form-grid">${BUDGET_KEYS.map(([k, label]) => `<div class="field"><label for="be-${k}">${label} (₹)</label><input class="input" id="be-${k}" data-be="${k}" type="number" min="0" step="1" value="${be[k] ?? ''}"></div>`).join('')}</div><div class="budget-row total" style="margin-top:12px"><span>Estimated total</span><strong>${money(est)}</strong></div><div class="budget-row"><span>Per person (${trav})</span><strong>${money(est / trav)}</strong></div>${trip.budget ? `<div class="budget-row"><span>${est > trip.budget ? 'Over your budget by' : 'Within your budget by'}</span><strong>${money(Math.abs(trip.budget - est))}</strong></div>` : ''}<button class="btn btn-primary btn-small" type="submit" style="margin-top:12px">Save estimate</button></form>
  <div class="section-head"><div><h2>Find transport, stays & activities</h2><p>Opens external providers with your trip details filled in. Nothing is booked here.</p></div></div>
  <div class="grid grid-3"><button class="quick-link" data-trip-search="flights"><div><strong>Search flights</strong><small>Google Flights · Skyscanner</small></div><span>✈</span></button><button class="quick-link" data-trip-search="hotels"><div><strong>Search stays</strong><small>Google Hotels · Booking.com</small></div><span>⌂</span></button><button class="quick-link" data-trip-search="experiences"><div><strong>Find activities</strong><small>Google · GetYourGuide</small></div><span>◇</span></button></div>
  <div class="plan-actions" style="margin-top:22px"><button class="btn btn-outline btn-small" id="calendarBtn">Export calendar</button><button class="btn btn-outline btn-small" data-route="trips">← All trips</button><button class="btn btn-outline btn-small danger" id="deleteTripBtn">Delete trip</button></div>`;
  const reload = async patch => { await saveItem('trips', { ...trip, ...patch }); renderTripPage(); };
  $('#shareTripBtn')?.addEventListener('click', () => shareTripCard(trip));
  $('#editTripBtn').addEventListener('click', () => showEditTripForm(trip));
  $('#askAiTripBtn').addEventListener('click', () => { plannerTripId = trip.id; routeTo('planner'); });
  $('#askAiEmpty')?.addEventListener('click', () => { plannerTripId = trip.id; plannerDraft = `Plan a day-by-day itinerary for my trip to ${trip.destination}${trip.startDate ? ` from ${trip.startDate} to ${trip.endDate}` : ''} for ${trav} traveller(s)${trip.budget ? ` with a budget of ₹${trip.budget}` : ''}.`; routeTo('planner'); });
  $('#addDayBtn').addEventListener('click', async () => { const cur = collectDays(trip); cur.push({ day: cur.length + 1, date: trip.startDate ? addDays(trip.startDate, cur.length) : '', title: '', morning: '', afternoon: '', evening: '', travel: '', estCost: null }); await reload({ days: cur }); });
  $$('[data-remove-day]').forEach(b => b.addEventListener('click', async () => { const cur = collectDays(trip); cur.splice(Number(b.dataset.removeDay), 1); await reload({ days: cur.map((d, i) => ({ ...d, day: i + 1, date: trip.startDate ? addDays(trip.startDate, i) : '' })) }); }));
  $('#itineraryForm').addEventListener('submit', async e => { e.preventDefault(); await reload({ days: collectDays(trip) }); toast('Itinerary saved.'); });
  $('#budgetEstForm').addEventListener('submit', async e => { e.preventDefault(); const next = {}; $$('[data-be]').forEach(i => { if (i.value !== '') next[i.dataset.be] = Math.max(0, Number(i.value) || 0); }); await reload({ budgetEstimate: next }); toast('Budget estimate saved.'); });
  $$('[data-trip-search]').forEach(b => b.addEventListener('click', () => openSearchFor(b.dataset.tripSearch, trip)));
  $('#calendarBtn').addEventListener('click', () => downloadTripCalendar(trip));
  $('#deleteTripBtn').addEventListener('click', () => showModal({ eyebrow: 'PERMANENT ACTION', title: 'Delete this trip?', body: `<p>“${escapeHTML(trip.title || trip.destination)}” and its itinerary will be removed from your account. This cannot be undone.</p>`, actions: [{ label: 'Cancel', class: 'btn-outline', onClick: closeModal }, { label: 'Delete trip', class: 'btn-primary', onClick: async () => { try { await deleteItem('trips', trip.id); closeModal(); toast('Trip deleted.'); routeTo('trips'); } catch (error) { toast(error.message, 'error'); } } }] }));
  loadTripWeather(trip);
}
async function loadTripWeather(trip) {
  const box = $('#tripWeather'); if (!box) return;
  try {
    const places = await TravelProvider.searchDestinations(String(trip.destination).split(',')[0].trim());
    const place = places[0]; if (!place) { box.innerHTML = '<p class="card-sub">Could not find this destination in the weather service. Try editing the destination to a city name.</p>'; return; }
    const w = await weatherForDates(place.latitude, place.longitude, trip.startDate, trip.endDate); const d = w.daily || {};
    if (currentRoute !== 'trip' || !$('#tripWeather')) return;
    const rows = (d.time || []).map((t, i) => `<tr><td>${dateFmt(t)}</td><td>${WMO(d.weather_code?.[i])}</td><td>${Math.round(d.temperature_2m_max?.[i])}° / ${Math.round(d.temperature_2m_min?.[i])}°C</td><td>${d.precipitation_probability_max?.[i] ?? '—'}%</td></tr>`).join('');
    box.innerHTML = `<p class="card-sub">Matched to <b>${escapeHTML([place.name, place.admin1, place.country].filter(Boolean).join(', '))}</b> — check this is the right place. ${w.matchesTripDates ? 'Forecast for your trip dates (available up to ~16 days ahead).' : 'Your dates are outside the ~16-day forecast window (or not set), so this is the current 7-day forecast, not your trip dates.'}</p><div class="table-wrap"><table class="wx"><thead><tr><th>Date</th><th>Conditions</th><th>High / Low</th><th>Rain chance</th></tr></thead><tbody>${rows}</tbody></table></div><small class="muted">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a></small>`;
  } catch (error) { if ($('#tripWeather')) $('#tripWeather').innerHTML = `<p class="card-sub">Weather is unavailable right now: ${escapeHTML(error.message)}</p>`; }
}
function showEditTripForm(trip) {
  showModal({ eyebrow: 'EDIT TRIP', title: 'Trip details', body: `<form id="editTripForm"><div class="field"><label for="etTitle">Title</label><input class="input" id="etTitle" required maxlength="120" value="${escapeHTML(trip.title || '')}"></div><div class="form-grid" style="margin-top:10px"><div class="field"><label for="etDest">Destination</label><input class="input" id="etDest" required maxlength="120" value="${escapeHTML(trip.destination || '')}"></div><div class="field"><label for="etOrigin">Departure city</label><input class="input" id="etOrigin" maxlength="120" value="${escapeHTML(trip.origin || '')}"></div><div class="field"><label for="etStart">Start date</label><input class="input" type="date" id="etStart" value="${escapeHTML(trip.startDate || '')}"></div><div class="field"><label for="etEnd">End date</label><input class="input" type="date" id="etEnd" value="${escapeHTML(trip.endDate || '')}"></div><div class="field"><label for="etTrav">Travellers</label><input class="input" type="number" id="etTrav" min="1" max="20" required value="${Number(trip.travellers) || 1}"></div><div class="field"><label for="etBudget">Your budget (₹)</label><input class="input" type="number" id="etBudget" min="0" value="${trip.budget ?? ''}"></div><div class="field"><label for="etStatus">Status</label><select class="select" id="etStatus">${TRIP_STATUSES.map(s => `<option ${trip.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div><button class="btn btn-primary" type="submit" style="margin-top:14px">Save changes</button></form>`, actions: [{ label: 'Cancel', class: 'btn-outline', onClick: closeModal }] });
  $('#editTripForm').addEventListener('submit', async e => {
    e.preventDefault(); const startDate = $('#etStart').value, endDate = $('#etEnd').value;
    if (startDate && endDate && endDate < startDate) return toast('End date cannot be before the start date.', 'error');
    const changed = startDate !== (trip.startDate || '');
    const days = changed && startDate ? (trip.days || []).map((d, i) => ({ ...d, date: addDays(startDate, i) })) : trip.days;
    await saveItem('trips', { ...trip, title: $('#etTitle').value.trim(), destination: $('#etDest').value.trim(), origin: $('#etOrigin').value.trim(), startDate, endDate, travellers: Number($('#etTrav').value), budget: $('#etBudget').value === '' ? null : Number($('#etBudget').value), status: $('#etStatus').value, days });
    closeModal(); toast('Trip updated.'); renderTripPage();
  });
}
function downloadTripCalendar(trip) {
  const escapeIcs = value => String(value || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = (trip.days || []).filter(day => day.date).map(day => {
    const start = String(day.date).replace(/-/g, ''); const end = addDays(day.date, 1).replace(/-/g, '');
    const desc = [day.morning && `Morning: ${day.morning}`, day.afternoon && `Afternoon: ${day.afternoon}`, day.evening && `Evening: ${day.evening}`].filter(Boolean).join('\n');
    return `BEGIN:VEVENT\r\nUID:${escapeIcs(trip.id)}-${day.day}@wayfarer.ai\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nSUMMARY:${escapeIcs(day.title || `${trip.destination} · Day ${day.day}`)}\r\nDESCRIPTION:${escapeIcs(desc)}\r\nEND:VEVENT`;
  }).join('\r\n');
  if (!events) return toast('Set a start date and add itinerary days before exporting a calendar.', 'error');
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WAYFARER AI//Trip Calendar//EN\r\n${events}\r\nEND:VCALENDAR`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${String(trip.title || 'wayfarer-trip').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`; a.click(); URL.revokeObjectURL(url);
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
  applyCatalogPrefill(kind);
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
  const trips = await listItems('trips');
  if (!trips.length) { content.innerHTML = `${pageHead('TRAVEL COST CLARITY','Know what is estimated and what is confirmed.','Estimates and your own recorded costs are kept separate.')}${emptyState('◎','No trip to review','Create a trip, or ask the AI planner for a plan with a budget estimate.','<button class="btn btn-primary" data-action="new-trip">Create a trip</button>')}`; return; }
  const trip = trips.find(t => t.id === budgetTripId) || trips.find(t => t.status !== 'cancelled') || trips[0]; budgetTripId = trip.id;
  const trav = Math.max(1, Number(trip.travellers) || 1); const be = trip.budgetEstimate || {}; const est = budgetTotal(be);
  const costs = (trip.costs || []).filter(c => Number.isFinite(Number(c.amount))); const spent = costs.reduce((s, c) => s + Number(c.amount), 0);
  const bar = (v, max) => max ? `<div class="budget-track"><span style="width:${Math.min(100, v / max * 100)}%"></span></div>` : '';
  content.innerHTML = `${pageHead('TRAVEL COST CLARITY','Estimates vs. real costs.','Estimates are rough guides. Recorded costs are amounts you entered from real receipts or confirmations.')}
  <div class="card" style="margin-bottom:16px"><div class="field" style="max-width:420px"><label for="budgetTrip">Trip</label><select class="select" id="budgetTrip">${trips.map(t => `<option value="${escapeHTML(t.id)}" ${t.id === trip.id ? 'selected' : ''}>${escapeHTML(t.title || t.destination)}</option>`).join('')}</select></div></div>
  <div class="grid grid-2"><div class="card"><p class="eyebrow">ESTIMATE · NOT A QUOTE</p><h3 style="font-size:38px">${est ? money(est) : '—'}</h3><p class="card-sub">${est ? `${money(est / trav)} per person · ${trav} traveller${trav === 1 ? '' : 's'}` : 'No estimate yet. Add one on the trip page or ask the AI planner.'}</p>${trip.budget && est ? `${bar(est, trip.budget)}<div class="budget-row"><span>Your budget ${money(trip.budget)}</span><strong>${Math.round(est / trip.budget * 100)}% used</strong></div>` : ''}${BUDGET_KEYS.filter(([k]) => be[k] !== undefined).map(([k, label]) => `<div class="budget-row"><span>${label}</span><strong>${money(be[k])}</strong></div>`).join('')}<button class="btn btn-outline btn-small" style="margin-top:12px" data-open-trip="${escapeHTML(trip.id)}">Edit estimate ↗</button></div>
  <div class="card"><p class="eyebrow">RECORDED COSTS · ENTERED BY YOU</p><h3 style="font-size:38px">${money(spent)}</h3><p class="card-sub">${costs.length} recorded item${costs.length === 1 ? '' : 's'}${trip.budget ? ` · budget ${money(trip.budget)}` : ''}</p>${trip.budget ? bar(spent, trip.budget) : ''}${costs.map(c => `<div class="budget-row"><span>${escapeHTML(c.label || 'Cost')}</span><strong>${money(c.amount)} <button class="link-btn" data-del-cost="${escapeHTML(c.id || '')}" aria-label="Remove cost">✕</button></strong></div>`).join('') || '<p class="card-sub">Nothing recorded yet.</p>'}
  <form id="costForm" class="form-grid" style="margin-top:14px"><div class="field"><label for="costLabel">What was it?</label><input class="input" id="costLabel" required maxlength="80" placeholder="e.g. Train ticket"></div><div class="field"><label for="costAmount">Amount (₹)</label><input class="input" id="costAmount" type="number" min="0" step="1" required></div><div class="field" style="align-self:end"><button class="btn btn-primary btn-small" type="submit">Add cost</button></div></form></div></div>`;
  $('#budgetTrip').addEventListener('change', e => { budgetTripId = e.target.value; renderBudget(); });
  $('#costForm').addEventListener('submit', async e => { e.preventDefault(); const next = [...(trip.costs || []), { id: id('cost'), label: $('#costLabel').value.trim(), amount: Number($('#costAmount').value), currency: 'INR', createdAt: new Date().toISOString() }]; await saveItem('trips', { ...trip, costs: next }); renderBudget(); });
  $$('[data-del-cost]').forEach(b => b.addEventListener('click', async () => { await saveItem('trips', { ...trip, costs: (trip.costs || []).filter(c => c.id !== b.dataset.delCost) }); renderBudget(); }));
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
  if (currentUser().isGuest) {
    content.innerHTML = `${pageHead('RECENT ACTIVITY','Guest history is private to this session.','Guest searches and planning actions are available, but history is intentionally not saved.')}<div class="guest-history-note card"><div class="guest-history-icon">◷</div><h3>Nothing is being recorded</h3><p>As a guest, you can use the website features. Search and planning activity is not added to a saved history. Sign in if you want a persistent activity record.</p><button class="btn btn-primary btn-small" data-landing-login>Sign in for saved history</button></div>`;
    return;
  }
  const [records, tasks] = await Promise.all([listItems('history'), listItems('tasks')]);
  const entries = [...records.map(r => ({ ...r, _history: true })), ...tasks.map(t => ({ ...t, _history: false }))].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const historyCards = records.map(r => `<article class="card history-card"><div class="history-card-top"><span class="history-kind">${escapeHTML((r.kind || 'activity').toUpperCase())}</span><small>${r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : ''}</small></div><h3>${escapeHTML(r.title || r.query || 'Travel activity')}</h3><p>${escapeHTML(r.summary || r.query || '')}</p>${r.query ? `<div class="history-query">${escapeHTML(r.query)}</div>` : ''}</article>`).join('');
  content.innerHTML = `${pageHead('TRAVEL ACTIVITY','Your search & planning history.','Searches, planned trips and confirmed AI actions that were saved while you were signed in.')}${entries.length ? `<div class="history-layout"><div><div class="history-section-title"><h2>Searches & trip plans</h2><span>${records.length} saved item(s)</span></div>${historyCards || '<div class="card card-sub">No searches or plans saved yet.</div>'}</div><div><div class="history-section-title"><h2>AI task activity</h2><span>${tasks.length} task(s)</span></div>${tasks.length ? `<div class="grid">${tasks.map(taskCard).join('')}</div>` : '<div class="card card-sub">No AI tasks saved yet.</div>'}</div></div>` : emptyState('◷','Your history is empty','Use destination search or save a trip. Signed-in activity will appear here.')}`;
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
  <div class="grid"><div class="card"><p class="eyebrow">FIREBASE</p><h3>${fb.enabled ? 'Firebase initialized' : 'Firebase not configured'}</h3><p class="card-sub">${fb.enabled ? 'Authentication and Firestore SDK are ready.' : 'Add the six FIREBASE_* variables in Vercel and redeploy.'}</p>${statusPill(fb.enabled ? 'CONFIGURED' : 'NOT CONFIGURED', fb.enabled)}<div class="divider"></div><button class="btn btn-outline btn-small" id="loginBtn">Sign in / create account</button> <button class="btn btn-outline btn-small" id="signOutBtn">${user.isGuest ? 'Return to home' : 'Sign out'}</button></div>
  <div class="card"><p class="eyebrow">FLIGHTS, STAYS & EXPERIENCES</p><h3>External provider search</h3><p class="card-sub">No airline or hotel API key is required. WAYFARER builds search links for Google Flights, Skyscanner, Google Hotels, Booking.com and activity search sites. Prices and availability are checked on those provider websites.</p>${statusPill('NO API KEY REQUIRED', true)}</div>
  <div class="card"><p class="eyebrow">AGENT37 CLOUD</p><h3>${ag.connected ? 'Cloud API configured' : 'Not connected'}</h3><p class="card-sub">${escapeHTML(ag.detail)}</p>${statusPill(ag.connected ? 'VERIFY ON USE' : 'INSTANCE ID IS NOT AN API', ag.connected)}<div class="divider"></div><p class="card-sub">This project connects server-side to your Agent37 Cloud Hermes instance through its documented /v1/responses endpoint. The sk_live key never reaches the browser. Requests require a signed-in Firebase user.</p><button class="btn btn-outline btn-small" id="agentHelp">Connection details</button></div>
  <div class="card"><p class="eyebrow">SUPABASE PRIVATE STORAGE</p><h3>${CONFIG.storage?.signingEndpoint ? 'Signing URL configured' : 'File upload not configured'}</h3><p class="card-sub">Optional. Uses a Firebase-verified server function and a private bucket. Firebase Functions deployment may require a billing-enabled plan.</p></div>
  <div class="card"><p class="eyebrow">PUBLIC LIVE DATA</p><h3>Weather and exchange reference</h3><p class="card-sub">Open-Meteo provides forecast data without a key for non-commercial use. Frankfurter provides reference exchange rates, not instant card/cash quotes.</p><button class="btn btn-outline btn-small" data-action="test-public-apis">Test public data sources</button><div id="publicApiTest" class="card-sub" style="margin-top:8px"></div></div></div></div>`;
  $('#profileForm').addEventListener('submit', async e => { e.preventDefault(); profile = await saveProfile({ name: $('#profileName').value.trim(), homeAirport: $('#profileHome').value.trim(), currency: $('#profileCurrency').value, pace: $('#profilePace').value, interests: $('#profileInterests').value.split(',').map(x => x.trim()).filter(Boolean) }); updateUserChrome(); toast('Preferences saved.'); });
  $('#loginBtn').addEventListener('click', showLoginModal);
  $('#signOutBtn').addEventListener('click', handleSignOut);
  $('#agentHelp').addEventListener('click', () => showModal({ eyebrow: 'AGENT37 CLOUD', title: 'How the secure connection works', body: `<p>Your browser sends a Firebase sign-in token to this website's server-side /api/agent37 route. The server verifies that token and calls your selected Hermes instance using the Agent37 Cloud API key stored in Vercel.</p><p>The Agent37 key is never sent to the browser. The instance must be running, its Hermes API gateway must be available, and its configured model/provider must be usable.</p><p>Do not paste the sk_live key into website code or chat messages.</p>`, actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] }));
}

function authMessage(error) {
  const map = { 'auth/invalid-credential': 'Email or password is incorrect.', 'auth/user-not-found': 'No account with that email. Choose “Create account”.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/email-already-in-use': 'That email already has an account. Use “Sign in”.', 'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.', 'auth/operation-not-allowed': 'Email/password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.', 'auth/unauthorized-domain': 'This website domain is not authorised in Firebase Console → Authentication → Settings → Authorized domains.', 'auth/popup-closed-by-user': 'Sign-in window was closed.', 'auth/network-request-failed': 'Network problem. Check your connection.' };
  return map[error?.code] || error?.message || 'Sign-in failed.';
}
async function finishFirebaseSignIn(result) {
  setCurrentUser(result.user);
  profile = await getProfile().catch(() => null);
  closeModal();
  updateUserChrome();
  enterApp();
  await routeTo('dashboard');
  toast("You're signed in. Your dashboard is ready.");
}
async function performGoogleSignIn() {
  try {
    const result = await signInGoogle();
    await finishFirebaseSignIn(result);
  } catch (error) { toast(authMessage(error), 'error'); }
}
async function showLoginModal() {
  showModal({ eyebrow: 'YOUR WAYFARER ACCOUNT', title: 'Welcome back, traveller.', body: `<p class="card-sub" style="margin:0 0 15px">Sign in to sync your trips across devices and use your private AI workspace. You can keep exploring as a guest without an account.</p><form id="authForm"><div class="field"><label for="authEmail">Email address</label><input class="input" id="authEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div><div class="field" style="margin-top:11px"><label for="authPassword">Password</label><input class="input" id="authPassword" type="password" autocomplete="current-password" minlength="6" required placeholder="At least 6 characters"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><button class="btn btn-primary" type="submit" data-auth-mode="signin">Sign in</button><button class="btn btn-outline" type="submit" data-auth-mode="signup">Create account</button></div><div class="auth-divider"><span>OR</span></div><button class="btn btn-google" id="googleLogin" type="button" style="width:100%;justify-content:center"><span class="google-g">G</span> Sign in with Google</button></form><div class="detail-note">Guest mode remains available. Your guest workspace is saved locally in this browser and is not automatically synced to a new account.</div>`, actions: [{ label: 'Continue as guest', class: 'btn-outline', onClick: () => { closeModal(); startGuestSession(); } }, { label: 'Close', class: 'btn-outline', onClick: closeModal }] });
  $('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const submitter = e.submitter; const mode = submitter?.dataset.authMode || 'signin';
    const buttons = $$('button', $('#authForm')); buttons.forEach(button => button.disabled = true);
    try {
      const email = $('#authEmail').value.trim(), password = $('#authPassword').value;
      const result = mode === 'signup' ? await signUpEmail(email, password) : await signInEmail(email, password);
      await finishFirebaseSignIn(result);
    } catch (error) { toast(authMessage(error), 'error'); }
    finally { buttons.forEach(button => button.disabled = false); }
  });
  $('#googleLogin').addEventListener('click', performGoogleSignIn);
}
async function startGuestSession() {
  if (!currentUser().isGuest) {
    try { await signOutFirebase(); } catch (error) { toast(authMessage(error), 'error'); return; }
  }
  setCurrentUser(null);
  profile = null;
  enterApp();
  await routeTo('dashboard');
  toast('Guest workspace opened. Your changes are saved in this browser.');
}
async function handleSignOut() {
  const wasGuest = currentUser().isGuest;
  try { if (!wasGuest) await signOutFirebase(); }
  catch (error) { toast(authMessage(error), 'error'); return; }
  setCurrentUser(null);
  profile = await getProfile().catch(() => null);
  updateUserChrome();
  location.hash = '#landing';
  syncView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(wasGuest ? 'Returned to the WAYFARER home page.' : 'Signed out. You are back on the WAYFARER home page.');
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
  // Website help is answered locally so it never spends Agent37 credits.
  helpMessages.push({ role: 'user', text }); $('#helpInput').value = '';
  helpMessages.push({ role: 'assistant', text: websiteHelp(text) });
  renderHelpMessages();
}
function websiteHelp(message) {
  const q = message.toLowerCase();
  if (/workspace|agent|automation/.test(q)) return 'Open AI Workspace in the sidebar. Sign in to WAYFARER and send your instruction to the connected Agent37 Cloud Hermes instance. Website changes are not applied automatically.';
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
  $('#sideUserName').textContent = user.displayName || 'Traveller'; $('#sideUserEmail').textContent = user.isGuest ? 'Guest workspace · saved locally' : user.email; $('#sideAvatar').textContent = initial; $('#topAvatar').textContent = initial;
  const signOut = $('#topSignOut'); if (signOut) signOut.textContent = user.isGuest ? 'Exit guest' : 'Sign out';
  const status = agent37ConnectionStatus(); $('#agentStatusMini').textContent = status.connected ? 'Bridge configured · verify on use' : 'Agent37 not connected'; $('#agentDot').style.background = status.connected ? '#00a9b8' : '#879aa3';
}
function showFeatureDetail(key) {
  const feature = FEATURE_DETAILS[key];
  if (!feature) return;
  const paragraphs = feature.paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('');
  showModal({ eyebrow: 'WAYFARER FEATURE GUIDE', title: feature.title, body: `<p class="card-sub" style="font-size:12px;margin:0 0 13px">${escapeHTML(feature.intro)}</p>${paragraphs}<div class="detail-note"><strong>What to know:</strong> ${escapeHTML(feature.note)}</div>`, actions: [{ label: 'Open this feature ↗', class: 'btn-primary', onClick: () => { closeModal(); enterApp(); routeTo(feature.route); } }, { label: 'Close', class: 'btn-outline', onClick: closeModal }] });
}
function updateFeaturePreview(key) {
  const item = FEATURE_PREVIEWS[key]; if (!item) return;
  $$('.preview-tab').forEach(tab => { const active = tab.dataset.featureTab === key; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
  const target = $('#featurePreview');
  target.innerHTML = `<div class="preview-content-icon">${item.icon}</div><div><p class="eyebrow">${item.kicker}</p><h3>${item.title}</h3><p>${item.body}</p><button class="btn btn-primary btn-small" data-preview-route="${item.route}">${item.cta}</button></div><div class="preview-mini-map"><span class="map-pin pin-one">⌖</span><span class="map-pin pin-two">✦</span><span class="map-route"></span><span class="map-caption">${key.toUpperCase()} / PLAN / REVIEW</span></div>`;
}

const TOUR_STEPS = [
  { route: 'dashboard', target: '.dash-hero', title: 'Your travel command centre', body: 'This is your overview. It brings your trip count, completed AI tasks, saved places and budget totals together, then points you toward the next useful action. The journey cards below show only trips you have actually created or saved.', tip: 'Start here whenever you return to WAYFARER.' },
  { route: 'explore', target: '#destinationForm', title: 'Discover destinations', body: 'Search a city or place name to retrieve real geocoding results. Open a result to check its coordinates, save it to your wishlist, use it to start a trip or request weather context. Results are sourced live rather than selected from a made-up catalogue.', tip: 'Try a city name such as Manali, Jaipur or Kochi.' },
  { route: 'planner', target: '#plannerForm', title: 'Plan in natural language', body: 'Describe the trip you have in mind: route, dates, travellers, budget and interests. When Agent37 is connected, the assistant can return an itinerary broken into days and time periods, with an estimated budget. Review the proposal before saving it.', tip: 'AI requests require a signed-in Firebase account and a configured Agent37 service.' },
  { route: 'workspace', target: '#workspaceForm', title: 'Your AI workspace', body: 'This is the command area for travel-related instructions. It sends requests to your own Agent37 Cloud Hermes instance through a secure server route. The execution history records actual responses; the app does not fake a successful task or silently edit your website.', tip: 'Guests can explore this page, but sending private Agent37 requests requires sign-in.' },
  { route: 'trips', target: '.page-head', title: 'Keep every trip organised', body: 'Create and manage trip records with a destination, dates, traveller count, status, itinerary and budget. Open a trip to edit the details, review its plan, add recorded expenses or export a calendar file when available.', tip: 'Guest trip data is local to this browser. Sign in to use your account workspace.' },
  { route: 'flights', target: '#providerSearchForm', title: 'Compare flight options', body: 'Enter the origin, destination, departure date, optional return date and traveller count. WAYFARER prepares useful external searches so you can compare real fares and schedules on provider websites.', tip: 'Final fares, baggage rules and availability belong to the provider, not WAYFARER.' },
  { route: 'hotels', target: '#providerSearchForm', title: 'Find a place to stay', body: 'Search using a destination, check-in and check-out dates and adult count. The app opens external hotel searches where you can review room details, taxes, location, cancellation policies and total prices.', tip: 'Always verify the final booking terms on the provider website.' },
  { route: 'experiences', target: '#providerSearchForm', title: 'Add experiences to the plan', body: 'Choose a city and the type of activity you want to explore, such as adventure, food, culture or guided tours. WAYFARER creates a contextual search to help you continue your research on external websites.', tip: 'Check activity availability, suitability and safety information with the organiser.' },
  { route: 'budget', target: '.page-head', title: 'Understand your trip budget', body: 'Select a trip to review its estimated cost breakdown and compare it with the budget you set. Add expenses you have actually paid or recorded to see the difference between an estimate and recorded spending.', tip: 'Estimates are planning aids, not live quotes or guaranteed prices.' },
  { route: 'bookings', target: '#documentUploadForm', title: 'Keep confirmations together', body: 'Record details from a real booking or upload supported confirmations when private storage is configured. This page is a document organiser; it does not book travel or invent reservation references.', tip: 'Private cloud document uploads need sign-in and backend storage configuration.' },
  { route: 'history', target: '.page-head', title: 'Review AI history', body: 'Inspect the instructions you sent, real assistant replies and task execution logs. This gives you a transparent record of what happened rather than a list of sample or simulated actions.', tip: 'No entry is added just because you opened a feature.' },
  { route: 'wishlist', target: '.page-head', title: 'Save places for later', body: 'Your wishlist is a shortlist of destinations you saved from Explore. Return to a place, check its weather again or use it to start a trip when you are ready.', tip: 'Useful when you are comparing ideas before choosing dates.' },
  { route: 'support', target: '#supportForm', title: 'Save travel support notes', body: 'Capture a question, disruption, accessibility concern or other travel note with its topic and details. Your notes stay in the workspace for reference; this form is not a live helpdesk or supplier ticket.', tip: 'Keep the details here, then contact the relevant provider for urgent assistance.' },
  { route: 'settings', target: '#profileForm', title: 'Personalise your workspace', body: 'Set a display name, home city or airport, preferred currency, travel pace and interests. Review Firebase, Agent37, storage and public data integration status from the same settings page.', tip: 'Your profile helps provide useful context, but you stay in control of what you share.' }
];
let activeTourIndex = 0;
let tourTarget = null;
function closeWebsiteTour() {
  tourTarget?.classList.remove('tour-focus');
  tourTarget = null;
  const layer = $('#tourLayer');
  if (layer) { layer.classList.remove('open'); layer.setAttribute('aria-hidden', 'true'); layer.innerHTML = ''; }
}
async function showTourStep(index) {
  if (index < 0) index = 0;
  if (index >= TOUR_STEPS.length) { closeWebsiteTour(); toast('You have completed the WAYFARER guided tour. Explore any feature whenever you are ready.'); return; }
  activeTourIndex = index;
  const step = TOUR_STEPS[index];
  if (document.body.dataset.view === 'landing') enterApp();
  await routeTo(step.route);
  await new Promise(resolve => setTimeout(resolve, 90));
  tourTarget?.classList.remove('tour-focus');
  tourTarget = document.querySelector(step.target) || $('#pageContent');
  tourTarget?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  tourTarget?.classList.add('tour-focus');
  const layer = $('#tourLayer');
  layer.classList.add('open'); layer.setAttribute('aria-hidden', 'false');
  const pct = Math.round(((index + 1) / TOUR_STEPS.length) * 100);
  layer.innerHTML = `<section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle"><div class="tour-card-top"><span>WAYFARER WEBSITE GUIDE · ${String(index + 1).padStart(2,'0')} / ${String(TOUR_STEPS.length).padStart(2,'0')}</span><button type="button" data-tour-close aria-label="Close tour">×</button></div><div class="tour-progress"><span style="width:${pct}%"></span></div><h3 id="tourTitle">${escapeHTML(step.title)}</h3><p>${escapeHTML(step.body)}</p><p class="tour-tip">${escapeHTML(step.tip)}</p><div class="tour-actions"><button class="btn btn-outline btn-small" data-tour-back ${index === 0 ? 'disabled' : ''}>← Back</button><div><button class="btn btn-outline btn-small" data-tour-close>Skip tour</button><button class="btn btn-primary btn-small" data-tour-next>${index === TOUR_STEPS.length - 1 ? 'Finish tour ✓' : 'Next feature →'}</button></div></div></section>`;
  $('[data-tour-next]', layer)?.addEventListener('click', () => showTourStep(activeTourIndex + 1));
  $('[data-tour-back]', layer)?.addEventListener('click', () => showTourStep(activeTourIndex - 1));
  $$('[data-tour-close]', layer).forEach(button => button.addEventListener('click', closeWebsiteTour));
}
function startWebsiteTour() { closeWebsiteTour(); showTourStep(0).catch(error => { closeWebsiteTour(); toast(`The website tour could not open: ${error.message}`, 'error'); }); }

function toggleTheme() { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; try { localStorage.setItem('wayfarer.theme', next); } catch { /* ignore */ } const glyph = next === 'dark' ? '☾' : '☼'; if ($('#themeToggle')) $('#themeToggle').textContent = glyph; if ($('#landingThemeToggle')) $('#landingThemeToggle').textContent = glyph; }

// Delegated page actions.
document.addEventListener('click', async event => {
  const route = event.target.closest('[data-route]'); if (route) { event.preventDefault(); routeTo(route.dataset.route); return; }
  const save = event.target.closest('[data-save-place]'); if (save) { handleDestinationSave(save.dataset.savePlace); return; }
  const plan = event.target.closest('[data-plan-place]'); if (plan) { planDestination(plan.dataset.planPlace); return; }
  const weather = event.target.closest('[data-weather-place]'); if (weather) { showPlaceWeather(weather.dataset.weatherPlace); return; }
  const openTripButton = event.target.closest('[data-open-trip]'); if (openTripButton) { openTrip(openTripButton.dataset.openTrip); return; }
  const openTask = event.target.closest('[data-open-task]'); if (openTask) { inspectTask(openTask.dataset.openTask); return; }
  const download = event.target.closest('[data-download-file]'); if (download) { try { openExternal(await getPrivateFileUrl(download.dataset.downloadFile)); } catch (error) { toast(error.message, 'error'); } return; }
  const plannerFill = event.target.closest('[data-planner-fill]'); if (plannerFill) { const i = $('#plannerInput'); if (i) { i.value = plannerFill.dataset.plannerFill; i.focus(); } return; }
  const savePlan = event.target.closest('[data-save-plan]'); if (savePlan) { confirmSavePlan(Number(savePlan.dataset.savePlan)); return; }
  const planSearch = event.target.closest('[data-plan-search]'); if (planSearch) { const plan = plannerMessages[Number(planSearch.dataset.planIdx)]?.plan; if (plan) openSearchFor(planSearch.dataset.planSearch, plan); return; }
  const landingChip = event.target.closest('[data-landing-search]'); if (landingChip) { enterApp(); routeTo('explore'); $('#destinationSearch').value = landingChip.dataset.landingSearch; searchDestinations(landingChip.dataset.landingSearch); return; }
  const landingLogin = event.target.closest('[data-landing-login]'); if (landingLogin) { showLoginModal(); return; }
  const guestStart = event.target.closest('[data-guest-start]'); if (guestStart) { startGuestSession(); return; }
  const landingGoogle = event.target.closest('[data-landing-google]'); if (landingGoogle) { performGoogleSignIn(); return; }
  const featureCard = event.target.closest('[data-feature]'); if (featureCard) { showFeatureDetail(featureCard.dataset.feature); return; }
  const featureTab = event.target.closest('[data-feature-tab]'); if (featureTab) { updateFeaturePreview(featureTab.dataset.featureTab); return; }
  const previewRoute = event.target.closest('[data-preview-route]'); if (previewRoute) { enterApp(); routeTo(previewRoute.dataset.previewRoute); return; }
  const landingTour = event.target.closest('[data-landing-tour]'); if (landingTour) { startWebsiteTour(); return; }
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
$('#landingThemeToggle')?.addEventListener('click', toggleTheme);
$('#topSignOut').addEventListener('click', handleSignOut);
$('#guideTourBtn').addEventListener('click', startWebsiteTour);
$('#sidebarTourBtn').addEventListener('click', startWebsiteTour);
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#helpAssistant').addEventListener('click', () => { $('#helpDrawer').classList.add('open'); $('#helpDrawer').setAttribute('aria-hidden','false'); $('#helpInput').focus(); });
$('#closeHelp').addEventListener('click', () => { $('#helpDrawer').classList.remove('open'); $('#helpDrawer').setAttribute('aria-hidden','true'); });
$('#helpForm').addEventListener('submit', e => { e.preventDefault(); sendHelpMessage($('#helpInput').value); });
$('#notificationBtn').addEventListener('click', async () => { const items = await listItems('notifications'); showModal({ eyebrow: 'YOUR NOTIFICATIONS', title: 'Recent updates', body: items.length ? items.map(n => `<div class="budget-row"><span><strong>${escapeHTML(n.title)}</strong><br><small>${escapeHTML(n.body)}</small></span><small>${new Date(n.createdAt).toLocaleDateString('en-IN')}</small></div>`).join('') : '<p>No notifications yet.</p>', actions: [{ label: 'Close', class: 'btn-primary', onClick: closeModal }] }); });
$('#globalSearch').addEventListener('keydown', event => { if (event.key === 'Enter') { const query = event.target.value.toLowerCase(); const routes = [['trip','trips'],['flight','flights'],['hotel','hotels'],['stay','hotels'],['experience','experiences'],['budget','budget'],['booking','bookings'],['workspace','workspace'],['destination','explore']]; const found = routes.find(([term]) => query.includes(term)); routeTo(found ? found[1] : 'explore'); if (currentRoute === 'explore' && query.length >= 2) { $('#destinationSearch').value = event.target.value; searchDestinations(event.target.value); } } });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); } if (event.key === 'Escape') { closeMobileNav(); if ($('#tourLayer')?.classList.contains('open')) closeWebsiteTour(); } });

// Landing page <-> app view, driven by the URL hash (#app shows the app).
function syncView() { const landing = !location.hash || location.hash === '#landing'; document.body.dataset.view = landing ? 'landing' : 'app'; if (landing) window.scrollTo(0, 0); }
function enterApp() { if (location.hash !== '#app') location.hash = '#app'; syncView(); }
window.addEventListener('hashchange', syncView);
$('#landingForm')?.addEventListener('submit', e => { e.preventDefault(); plannerDraft = $('#landingPrompt').value.trim(); enterApp(); routeTo('planner'); });
syncView();

async function boot() {
  try {
    purgeLegacyDemoRecords();
    const fb = await initFirebase();
    firebaseReady = fb.enabled;
    if (firebaseReady) {
      // Resolve the first Firebase auth event before selecting the account data namespace.
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
      // Never trust a stale local UID when Firebase is not configured.
      setCurrentUser(null);
    }
    profile = await getProfile();
    updateUserChrome();
    await refreshAgent37Status(); updateUserChrome();
    if (!currentUser().isGuest || location.hash === '#app') {
      enterApp();
      await routeTo('dashboard');
    } else {
      syncView();
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  } catch (error) { console.error(error); toast(`Startup issue: ${error.message}`, 'error'); }
}
boot();
