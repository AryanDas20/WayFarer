/** Strictly validate the small set of structured writes the website is allowed to apply. */
const text = (value, name, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${name} is required and must be ${max} characters or fewer.`);
  return value.trim();
};
const optionalText = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value, name) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error(`${name} must use YYYY-MM-DD.`);
  return value;
};

export const AGENT37_TOOL_NAMES = ['create_trip', 'update_trip', 'create_packing_checklist'];

export function normalizeAgentAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
  const name = String(action.name || action.tool || '').trim();
  const args = action.arguments && typeof action.arguments === 'object' ? action.arguments : action.args && typeof action.args === 'object' ? action.args : {};
  try {
    if (name === 'create_trip') {
      const startDate = date(args.startDate, 'Start date');
      const endDate = date(args.endDate, 'End date');
      if (endDate < startDate) return null;
      const travelers = Number(args.travelers || 1);
      if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) return null;
      const budget = args.budget === undefined || args.budget === null ? null : Number(args.budget);
      if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 100000000)) return null;
      return { name, args: { title: optionalText(args.title, 120) || `Trip to ${text(args.destination, 'Destination')}`, destination: text(args.destination, 'Destination'), origin: optionalText(args.origin, 120), startDate, endDate, travelers, budget } };
    }
    if (name === 'update_trip') {
      const tripId = text(args.tripId, 'Trip ID', 100);
      const changes = args.changes;
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
      const allowed = ['title', 'destination', 'origin', 'startDate', 'endDate', 'travellers', 'budget'];
      const safe = {};
      for (const key of allowed) if (Object.hasOwn(changes, key)) {
        if (key === 'startDate' || key === 'endDate') safe[key] = date(changes[key], key);
        else if (key === 'budget' || key === 'travellers') {
          const n = Number(changes[key]);
          if (!Number.isFinite(n) || n < 0 || n > 100000000) return null;
          safe[key] = n;
        } else safe[key] = text(changes[key], key, 160);
      }
      if (!Object.keys(safe).length) return null;
      return { name, args: { tripId, changes: safe } };
    }
    if (name === 'create_packing_checklist') {
      if (!Array.isArray(args.items) || !args.items.length || args.items.length > 40) return null;
      const items = args.items.map(item => text(item, 'Checklist item', 120));
      return { name, args: { title: optionalText(args.title, 120) || 'Packing checklist', items } };
    }
  } catch { return null; }
  return null;
}
