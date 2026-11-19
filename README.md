# WAYFARER AI — Vercel + Firebase + Agent37 Cloud

WAYFARER AI is a responsive travel-planning website built with HTML, CSS and vanilla JavaScript. It uses Firebase Authentication and Firestore for user accounts and saved data, and can send authenticated chat/task requests to a selected Agent37 Cloud Hermes instance through a secure Vercel serverless function.

## What this version does

- Responsive WAYFARER AI interface with light/dark theme.
- Firebase email/password and Google sign-in (after Firebase setup).
- Firestore-backed user profiles, trips, saved places, notes and history, subject to the supplied security rules.
- Agent37 Cloud Hermes chat through the documented `POST https://{instanceId}.agent37.app/v1/responses` endpoint.
- Agent37 credentials remain server-side in Vercel. The browser sends a Firebase ID token to `/api/agent37`; the server verifies it before forwarding the request.
- Agent37 conversation session IDs are kept in the current browser tab's session storage.
- Destination lookup and weather use Open-Meteo.
- Currency reference rates use Frankfurter.
- Flight searches open external Google Flights and Skyscanner pages.
- Hotel searches open external Google Travel and Booking.com pages.
- Activity searches open external Google and GetYourGuide pages.

## Important limitations and honest behaviour

- Agent37 Cloud is a metered service. Running instances, disk, model usage and connected tools may incur charges. Check your Agent37 usage and wallet before using it.
- The `AGENT37_API_KEY` is the Agent37 Cloud `sk_live_...` key. This same key authenticates to the instance data plane using the `X-Agent37-Key` header. There is no separate `AGENT37_API_SERVER_KEY` required by this integration.
- The Agent37 instance must be running and its Hermes gateway/model provider must be configured. A Cloud API key does not itself supply model inference if the instance has no usable provider/model configured.
- AI responses are real Agent37 responses. If the upstream request fails, the site displays an error; it does not substitute a fake response.
- The assistant does not automatically change saved trips, book flights, reserve hotels, take payments, cancel bookings or rebook travel. External providers handle availability, prices and booking.
- Flights, hotels and activities are external searches. WAYFARER does not fetch supplier inventory or verify displayed prices.
- No Amadeus integration remains. No OpenAI API key is used by this application.
- Firebase Web App config values are public client configuration. Firebase ID tokens are verified server-side with Google's published signing keys. Never put service-account JSON or private keys into the browser.
- Optional Supabase document storage is not required for the initial setup.

## Environment variables

Add these in Vercel → Project → Settings → Environment Variables. Choose Production (and Preview/Development if needed).

### Agent37 Cloud

| Name | Value |
|---|---|
| `AGENT37_API_KEY` | Your Agent37 Cloud `sk_live_...` API key |
| `AGENT37_INSTANCE_ID` | Your instance ID, e.g. `groyjqmd5x` |
| `AGENT37_BASE_URL` | `https://groyjqmd5x.agent37.app/v1` (must match the instance ID) |

The browser never receives `AGENT37_API_KEY`.

### Firebase Web App

| Name | Value copied from Firebase Web App config |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

The `/api/firebase-config` route returns only these public Firebase Web App settings to the browser. It never returns the Agent37 key.

## Run locally

Install Node.js 22 LTS if possible. From the project folder:

```bash
cp .env.example .env.local
```

Edit `.env.local` and enter your own values. Never commit or share `.env.local`; it is ignored by Git.

Then run:

```bash
npm install
npm run dev
```

Open <http://localhost:8080>. The local server supports the same `/api/firebase-config` and `/api/agent37` routes. Run the checks with:

```bash
npm run check
```

## Deploy to Vercel

1. Push the contents of this folder to a GitHub repository. Make sure `index.html`, `api/`, `js/`, `styles.css` and `package.json` are at the repository root.
2. Import the GitHub repository into Vercel.
3. Use Framework Preset **Other**, Root Directory `./`, Build Command blank, Output Directory `.`, and Install Command `npm install`.
4. Add all nine environment variables listed above.
5. Deploy. After changing variables later, redeploy so the new values take effect.
6. Add your Vercel domain in Firebase Console → Authentication → Settings → Authorized domains.

## Firebase setup

1. Create a Firebase project and register a Web App (`</>`).
2. Copy the six Web App config values into the six `FIREBASE_*` variables in Vercel.
3. In Firebase Authentication, enable Email/Password (and Google if desired).
4. Create a Cloud Firestore database.
5. Add your Vercel hostname to Authentication → Settings → Authorized domains.
6. Install Firebase CLI and deploy the supplied rules/indexes:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with the exact Firebase project ID, then run:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Agent37 setup

1. In Agent37 Cloud, open **Cloud → API keys** and copy your `sk_live_...` key.
2. Choose the Hermes instance that WAYFARER AI should use. Its ID must match the hostname in `AGENT37_BASE_URL`.
3. Add the three `AGENT37_*` variables to Vercel.
4. Make sure the instance is running and its Hermes gateway and model/provider are configured.
5. Redeploy Vercel.
6. Sign in to WAYFARER with Firebase, open Trip Planner or AI Workspace, and send a test message.
7. If it fails, inspect the visible error and Agent37 instance logs. Do not paste the API key into the browser or into support chats.

The official Agent37 data-plane endpoint uses `POST /v1/responses`, the `X-Agent37-Key` header, and returns a streaming response. The app proxies this request through `/api/agent37` and requires a valid Firebase ID token first.

## Project structure

```text
WayFarer-main/
├── api/
│   ├── agent37.js             # Authenticated server-side Agent37 proxy
│   └── firebase-config.js     # Returns public Firebase Web App config only
├── js/
│   ├── app.js
│   ├── config.js              # Safe browser defaults; no secrets
│   ├── firebase.js            # Runtime Firebase config + Auth/Firestore
│   ├── agent37Adapter.js      # Browser client for same-origin API
│   ├── providers.js           # Open-Meteo + Frankfurter
│   └── store.js
├── .env.example
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── package.json
├── vercel.json
└── START-HERE.md
```
