/**
 * Allowlisted Agent37 -> WAYFARER tool vocabulary.
 * Only these structured proposals can be translated into app actions.
 * The application still validates ownership and asks the user to approve every mutation.
 */
export const AGENT37_TOOL_NAMES = [
  'search_destinations', 'search_flights', 'search_hotels', 'search_transfers', 'search_activities',
  'compare_options', 'validate_price', 'validate_availability', 'build_itinerary', 'estimate_trip_cost',
  'create_trip', 'extend_trip', 'optimize_budget', 'create_packing_checklist',
  'simulate_disruption', 'create_demo_booking', 'request_booking_cancellation'
];

const shortText = (value, fallback, max = 100) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
const safeNumber = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

export function normalizeAgentAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
  const name = String(action.name || action.tool || '').trim();
  const args = action.arguments && typeof action.arguments === 'object' ? action.arguments : action.args && typeof action.args === 'object' ? action.args : {};
  switch (name) {
    case 'create_trip': {
      const destination = shortText(args.destination, 'Goa, India');
      const budget = safeNumber(args.budget, 40000, 1000, 5000000);
      const travellers = safeNumber(args.travelers ?? args.travellers, 2, 1, 20);
      return `Create a trip to ${destination} under ₹${budget} for ${travellers} travellers.`;
    }
    case 'extend_trip': {
      const days = safeNumber(args.days, 2, 1, 14);
      return `Extend my current trip by ${days} days and recalculate the budget.`;
    }
    case 'optimize_budget': {
      const percent = safeNumber(args.percent, 15, 1, 60);
      return `Reduce my current trip budget by ${percent}% and show the proposed itinerary changes.`;
    }
    case 'create_packing_checklist': return 'Create a packing checklist for my next trip and prepare it to save.';
    case 'simulate_disruption': return 'Simulate a flight delay and prepare a recovery plan for my trip.';
    case 'create_demo_booking': {
      const option = shortText(args.optionName, 'Selected travel option (DEMO)');
      const price = safeNumber(args.price, 0, 0, 10000000);
      const kind = ['flight','hotel','experience'].includes(args.kind) ? args.kind : 'experience';
      return `Book DEMO ${option} for ₹${price} as a ${kind} in my current trip.`;
    }
    case 'request_booking_cancellation': return 'Cancel my saved booking and show its refund and policy implications.';
    default: return null;
  }
}
