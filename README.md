# WAYFARER AI — Vercel + Firebase travel-planning website

WAYFARER AI is a responsive travel-planning prototype built with HTML, CSS and vanilla JavaScript. This updated package removes the discontinued Amadeus Self-Service integration and does not require Amadeus, Cloudflare Workers, or travel API credentials.

## Start here

If you are new to websites, follow **[START-HERE.md](./START-HERE.md)** from the beginning. It explains how to run the site on a Mac, create Firebase, publish the code to GitHub, deploy it on Vercel, and add your Vercel domain to Firebase.

## What works in this version

- Responsive WAYFARER AI interface with light/dark theme.
- Destination lookup using Open-Meteo Geocoding.
- Weather forecast using Open-Meteo.
- Currency reference rates using Frankfurter.
- Flight searches prepared as external Google Flights and Skyscanner links.
- Hotel searches prepared as external Google Travel and Booking.com links.
- Activity searches prepared as external Google and GetYourGuide links.
- Firebase email/password and Google sign-in (after Firebase setup).
- Firestore-backed user profiles, trips, saved places, notes and history, subject to Firebase configuration and security rules.
- Optional secure document-storage integration, not required for the basic website.
- Agent37 Personal adapter boundary, intentionally disabled until a documented supported external integration is available.

## Important honesty and limitations

- **No Amadeus integration remains in this version.** The old Self-Service setup instructions and credentials are removed.
- Flights, hotels and activities are external searches. WAYFARER does not fetch provider inventory, show verified live prices, validate fares, or complete bookings.
- Prices, taxes, cancellation rules, availability and bookings must be checked directly with the external provider.
- Weather and currency use public services. Frankfurter rates are reference rates, not bank/card quotes.
- The website does not execute supplier payments, reservations, cancellations or rebookings.
- An Agent37 Personal instance ID alone is not an API endpoint. The Agent37 connection stays disabled until an official supported bridge is available and tested. This project does not use Agent37 Cloud Sandbox or OpenAI API credentials.
- Supabase document storage is optional and needs a separately configured secure signing backend. Skip it for the initial free deployment.

## Technology

- Website hosting: Vercel (static website).
- Authentication and user data: Firebase Authentication + Cloud Firestore.
- Public destination and weather data: Open-Meteo.
- Currency reference rates: Frankfurter.
- Flight/hotel/activity discovery: external provider search links.
- Agent: Agent37 Personal integration boundary; not connected by default.

## Run locally

Install Node.js LTS, then from this folder run:

```bash
npm run dev
```

Open <http://localhost:8080>. To check the project:

```bash
npm run check
```

## Vercel environment variables

**No Vercel environment variables are required for this version.** The Firebase Web App configuration is placed in `js/config.js`. It is public browser configuration, not a service-account key. Do not put private keys or service-account JSON in this file or in Vercel client-side variables.

## Project structure

```text
wayfarer-ai/
├── index.html
├── styles.css
├── theme-init.js
├── vercel.json
├── js/
│   ├── app.js
│   ├── config.js              # Firebase public web config placeholders
│   ├── config.example.js      # Same safe example configuration
│   ├── firebase.js
│   ├── store.js
│   ├── providers.js           # Open-Meteo + Frankfurter only
│   ├── agent37Adapter.js      # Documented bridge boundary; disabled by default
│   ├── agent37Tools.js
│   └── storage.js              # Optional signed private uploads
├── functions/                  # Optional advanced storage signing function
├── firestore.rules
├── firestore.indexes.json
├── firebase.json               # Firebase rules/index deployment configuration
├── .firebaserc.example
├── package.json
└── START-HERE.md
```

## Security

- Firebase browser config is public and restricted by Firebase Auth/Firestore rules; never put service-account private keys in the repository.
- Firestore rules allow each signed-in user to access their own `users/{uid}` records and subcollections.
- Supabase service-role keys, signing secrets and any future Agent37 bridge secrets must remain server-side.
- Do not enable an Agent37 endpoint unless it is official, documented, HTTPS, and secured server-side.
