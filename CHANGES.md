# Changes in v2.0.0

## Bugs fixed
- Agent37 status was never checked at startup, so the planner always said "not configured" (`js/app.js` boot).
- Planner silently sent the user's first saved trip to the AI as context on every message; now only a trip you explicitly open for editing is sent.
- Cert-cache regex in `api/agent37.js` and quote-stripping regex in `dev-server.mjs` had doubled backslashes and never matched.
- Date validation accepted impossible dates like 2026-02-30 (`js/plan.js`, `js/agent37Tools.js`).
- Service worker served cached JS forever after a deployment; now network-first.
- Upstream failures were all reported as HTTP 401; now 402/404/409/429/502/504 with clear messages.
- Request body sent undocumented fields (`agent`, `mode`, `metadata`); now only `input`, `session_id`, `stream`.
- Website help chat spent Agent37 credits; now answered locally.
- Firestore read failure broke whole pages; now falls back to the device copy.
- Accent colour was olive; replaced with the required brown palette.

## New
- Landing page (hero, discovery, features, how-it-works, footer).
- Structured AI plans (validated JSON) with itinerary cards, budget estimate, per-person total; saved only after explicit confirmation.
- Trip page: edit details, edit/add/remove itinerary days, budget estimate, weather for trip dates, pre-filled flight/stay/activity searches, calendar export, delete.
- Budget page: estimates vs. your recorded costs, per trip.
- Rate limiting, 55 s timeout, security headers, loading/typing states, friendly sign-in errors.
- Tests: `npm test` (plan parser, auth + proxy route with a locally generated signing key).

## Files
Modified: `api/agent37.js`, `js/app.js`, `js/agent37Adapter.js`, `js/providers.js`, `js/store.js`, `js/agent37Tools.js`, `index.html`, `styles.css`, `service-worker.js`, `dev-server.mjs`, `vercel.json`, `package.json`, `scripts/verify-project.mjs`, `START-HERE.md`.
Added: `js/plan.js`, `styles-extra.css`, `tests/plan.test.mjs`, `tests/api.test.mjs`, `CHANGES.md`.
