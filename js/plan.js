// Structured travel plans: the AI is asked to append one JSON block; we validate it
// strictly before anything is displayed or saved. Nothing here is trusted as "booked".
const str = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, max = 100000000) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null; };
const isDate = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false; const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; };

export const BUDGET_KEYS = [
  ['transport', 'Transportation'], ['accommodation', 'Accommodation'], ['food', 'Food'],
  ['activities', 'Activities'], ['localTransport', 'Local transport'], ['misc', 'Miscellaneous']
];

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const destination = str(raw.destination, 120);
  if (!destination || !Array.isArray(raw.days) || !raw.days.length) return null;
  const startDate = isDate(raw.startDate) ? raw.startDate : '';
  const days = raw.days.slice(0, 30).map((d, i) => ({
    day: i + 1,
    date: startDate ? addDays(startDate, i) : (isDate(d?.date) ? d.date : ''),
    title: str(d?.title, 160), morning: str(d?.morning), afternoon: str(d?.afternoon), evening: str(d?.evening),
    travel: str(d?.travel), estCost: num(d?.estCost)
  })).filter(d => d.title || d.morning || d.afternoon || d.evening);
  if (!days.length) return null;
  const endDate = isDate(raw.endDate) && (!startDate || raw.endDate >= startDate) ? raw.endDate : (startDate ? addDays(startDate, days.length - 1) : '');
  const be = raw.budgetEstimate && typeof raw.budgetEstimate === 'object' ? raw.budgetEstimate : {};
  const budgetEstimate = {};
  for (const [key] of BUDGET_KEYS) { const n = num(be[key]); if (n !== null) budgetEstimate[key] = n; }
  const travellers = Number(raw.travellers);
  return {
    title: str(raw.title, 120) || `Trip to ${destination}`, destination, origin: str(raw.origin, 120),
    startDate, endDate, travellers: Number.isInteger(travellers) && travellers >= 1 && travellers <= 20 ? travellers : 1,
    budget: num(raw.budget), summary: str(raw.summary, 800), days, budgetEstimate,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.slice(0, 8).map(a => str(a, 240)).filter(Boolean) : [],
    tripId: str(raw.tripId, 100)
  };
}

/** Pull the ```wayfarer-plan block out of a reply; returns readable text + validated plan (or null). */
export function extractPlan(reply) {
  const text = String(reply || '');
  const match = text.match(/```wayfarer-plan\s*([\s\S]*?)```/i);
  if (!match) return { text: text.trim(), plan: null, invalid: false };
  const readable = text.replace(match[0], '').trim();
  try {
    const plan = normalizePlan(JSON.parse(match[1].trim()));
    return { text: readable, plan, invalid: !plan };
  } catch { return { text: readable, plan: null, invalid: true }; }
}

export function budgetTotal(budgetEstimate = {}) {
  return Object.values(budgetEstimate).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);
}

export const PLAN_INSTRUCTIONS = [
  'You are the WAYFARER AI travel concierge inside a travel-planning website. Be honest, practical and concise.',
  'Never invent flight/hotel prices, availability, reservations or completed bookings. All costs you give are rough ESTIMATES in INR unless told otherwise; say so.',
  'The website cannot book anything. It opens external search sites (Google Flights, Skyscanner, Booking.com, GetYourGuide) for the user. Never say you booked, paid for or reserved anything. Ask for confirmation before suggesting any consequential step.',
  'If destination, trip length (or dates), number of travellers or budget is missing, ask one or two short questions instead of guessing, and do NOT output a plan block yet.',
  'When you have enough information (or the user asks you to change an existing itinerary), reply with a short explanation of your reasoning, then append exactly ONE fenced block in this form:',
  '```wayfarer-plan',
  '{"title":"","destination":"","origin":"","startDate":"YYYY-MM-DD or empty","endDate":"YYYY-MM-DD or empty","travellers":1,"budget":null,"summary":"","days":[{"title":"","morning":"","afternoon":"","evening":"","travel":"","estCost":0}],"budgetEstimate":{"transport":0,"accommodation":0,"food":0,"activities":0,"localTransport":0,"misc":0},"assumptions":[""]}',
  '```',
  '"budget" is the user’s own stated total budget in INR (null if they gave none). Budget estimate numbers are totals for the whole group in INR. Keep each day entry short (one or two sentences per slot). Do not put markdown or comments inside the JSON.'
].join('\n');

export function buildPrompt({ message, profile = {}, trip = null, firstTurn = true }) {
  const parts = [];
  if (firstTurn) parts.push(PLAN_INSTRUCTIONS);
  else parts.push('Reminder: follow the WAYFARER rules from earlier (estimates only, no bookings, one wayfarer-plan block when you have enough information).');
  const p = {}; if (profile?.homeAirport) p.homeCity = profile.homeAirport; if (profile?.interests?.length) p.interests = profile.interests; if (profile?.pace) p.pace = profile.pace;
  if (Object.keys(p).length) parts.push(`Traveller preferences (user-provided): ${JSON.stringify(p)}`);
  if (trip) {
    const slim = { tripId: trip.id, title: trip.title, destination: trip.destination, origin: trip.origin, startDate: trip.startDate, endDate: trip.endDate, travellers: trip.travellers, budget: trip.budget, days: (trip.days || []).map(d => ({ day: d.day, title: d.title, morning: d.morning, afternoon: d.afternoon, evening: d.evening })) };
    parts.push(`The user is editing this saved trip. If you change the itinerary, return the COMPLETE updated plan block and set "tripId" to "${trip.id}": ${JSON.stringify(slim)}`);
  }
  parts.push(`User message: ${message}`);
  return parts.join('\n\n');
}
