# WAYFARER AI — Real-data travel platform prototype

WAYFARER AI is a responsive travel-planning workspace built with HTML, CSS and vanilla JavaScript. It is configured to **not show preloaded dummy travel data**.

## Start here

New to coding? Read **[START-HERE.md](./START-HERE.md)**. It explains how to install Node.js, run the website on a Mac, create Firebase, deploy the site, configure real Amadeus Production search, and understand the Agent37 Personal connection limitation.

## No fabricated data policy

- No seeded demo user, trip, destination catalogue, flight, hotel, activity, booking, voucher, price, rating or generated AI task is bundled.
- Place lookup and weather use Open-Meteo public endpoints.
- Currency rates use Frankfurter reference data, not live card/cash quotes.
- Flights, hotels and activities call Amadeus Production only through `workers/travel-api`. The Worker does not use `test.api.amadeus.com` and rejects missing credentials rather than inventing results.
- The user's own trips, booking details, profile and support notes are saved only when they enter them.
- This version does not execute supplier bookings, payments, cancellations or rebookings. It displays booking information supplied by the user and supports document uploads after optional storage configuration.
- Agent37 Personal is not claimed to be connected unless a real, supported bridge has been provided and responds successfully. An instance ID alone is not a website chat API.

## Stack

- Frontend: HTML5, CSS3, vanilla JavaScript modules.
- Authentication and application data: Firebase Authentication + Cloud Firestore.
- Static hosting: Firebase Hosting.
- Secure live travel API proxy: Cloudflare Worker.
- Supplier data: Amadeus Self-Service **Production** API (requires Production access and may incur charges).
- Public data: Open-Meteo Geocoding/Weather and Frankfurter reference exchange rates.
- Optional private document storage: Supabase Storage signed URLs created by a Firebase Cloud Function. This requires Firebase billing-enabled Functions and is not necessary to run the rest of the app.
- Agent interface: `js/agent37Adapter.js`; it intentionally requires a documented Agent37 Personal integration/bridge and does not use Agent37 Cloud.

## Run locally

Requirements: Node.js LTS.

```bash
npm run dev
```

Open <http://localhost:8080>. No root-level `npm install` is required. To check JavaScript syntax:

```bash
npm run check
```

## Setup

Follow the beginner guide **[START-HERE.md](./START-HERE.md)**. The sequence is:

1. Install Node.js and run the site locally.
2. Create Firebase, configure `js/config.js`, enable sign-in and deploy Firestore rules.
3. If you have Amadeus Production access, deploy `workers/travel-api` to Cloudflare and set the Worker URL in `js/config.js`.
4. Deploy the site with `firebase deploy --only hosting`.
5. Configure Agent37 Personal only after you obtain its official supported external integration details. Do not invent a URL or paste secrets into browser files.
6. Configure Supabase document storage only if you need it and accept the Firebase Functions billing requirement.

## Project map

```text
wayfarer-ai/
├── index.html
├── styles.css
├── theme-init.js
├── js/
│   ├── app.js
│   ├── config.js                 # Local placeholders; ignored by Git
│   ├── config.example.js
│   ├── firebase.js
│   ├── store.js
│   ├── providers.js              # Live public + Amadeus provider client
│   ├── agent37Adapter.js         # Documented Personal bridge boundary
│   ├── agent37Tools.js           # Strict allowlist + validation
│   └── storage.js                # Optional signed private uploads
├── workers/travel-api/
│   ├── src/index.js              # Firebase token verification + Amadeus Production proxy
│   ├── wrangler.toml
│   └── .dev.vars.example
├── functions/                    # Optional Supabase signed-URL function
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── START-HERE.md
```

## Security notes

- Amadeus API credentials belong in Cloudflare Worker secrets, never in `js/config.js`.
- Supabase service-role key belongs only in Firebase Secret Manager, never in browser code.
- Firestore rules scope private records to `users/{uid}`.
- The Worker verifies Firebase ID tokens before serving travel-provider requests.
- The Agent37 bridge must be HTTPS and operated by you or a trusted provider. Only configure a documented Personal integration.
- No AI write operation is applied until the user approves the proposed action.

## Known limitations

This is a hackathon prototype, not a production OTA. Amadeus Production access is needed for real-time flight/hotel/activity supplier inventory. Some searches may return no results depending on the supplier and requested route/date. Actual supplier bookings/payments/cancellations/rebooking, airline disruption feeds, transfers, group voting, and a verified Agent37 Personal external web-chat connection are not delivered by this version. They must not be represented as functional until corresponding live integrations are connected and tested.
