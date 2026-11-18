# WAYFARER AI

**An intelligent, agentic travel companion — planning, comparing, managing and supporting the whole journey.**

This is a runnable vanilla HTML/CSS/JavaScript prototype prepared for Hackyard Build 2026. It includes an interactive product UI, local demo persistence, a rule-based demo planner, approval-gated task execution, simulated travel inventory, trip records, booking records, task history and optional Firebase/Supabase infrastructure.

> **Honesty note:** the app works in demo mode without credentials. Travel inventory, prices and reservations are simulated and labelled DEMO. Agent37 Personal is not reported as connected unless you configure a bridge and a request succeeds. An Agent37 instance ID by itself is not a chat API URL. The Agent37 Personal integration point is intentionally configurable and does not use the paid Cloud API.

## 1. Run the project locally

Requirements: Node.js 18+.

```bash
cd wayfarer-ai
npm run dev
```

Open **http://localhost:8080**. No npm install is required for the frontend demo. The app seeds a sample Goa trip in local browser storage on first run.

To check JavaScript syntax:

```bash
npm run check
node --check functions/index.js
```

The local server is a small Node static-file server. Do not expose it to the public internet as a production server.

## 2. What works in demo mode

- Dashboard and responsive editorial UI.
- Destination discovery, search and wishlist.
- Conversational travel planner with an explicitly labelled built-in demo planner.
- AI Workspace with natural-language task parsing, multi-step plans, before/after previews and approval/rejection.
- Approved demo trip creation, itinerary updates, budget adjustments, packing checklist creation and demo booking/cancellation records.
- Flight, stay and experience comparison using clearly labelled simulated inventory.
- Trip dashboard, itinerary detail, booking references and demo policy records.
- Budget breakdown, support request form, notification centre and AI execution history.
- Website Guide chatbot for explaining the website's own pages and workflows.
- Light/dark mode, responsive sidebar, global search and PWA shell caching.

The AI Workspace is a bounded prototype, not an unrestricted browser agent. It uses an allowlisted set of actions and does not execute arbitrary code, SQL or untrusted commands. Every mutation is presented for explicit user confirmation first.

## 3. Configuration

Copy the template if you want to keep your own local settings:

```bash
cp js/config.example.js js/config.js
```

`js/config.js` is ignored by Git. The included default file has only placeholders and demo settings. Never commit real secrets.

### Firebase Authentication and Firestore

1. Create a Firebase project.
2. Register a Web App in Firebase Project Settings.
3. Enable Email/Password authentication. Enable Google authentication only if you want Google sign-in.
4. Create a Firestore database.
5. Copy the web app's public Firebase configuration values into `js/config.js` under `firebase`.
6. Set `demoMode` to `false` after Firebase is configured.
7. Deploy the security rules and indexes:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
# Edit .firebaserc and set your Firebase project ID
firebase deploy --only firestore:rules,firestore:indexes
```

The application stores each signed-in user's records under `users/{uid}/{collection}/{docId}`. The rules restrict access to the matching authenticated UID. The local browser copy is used as a demo/offline cache; configure and test your Firebase project before relying on cloud persistence.

To deploy Hosting:

```bash
firebase deploy --only hosting
```

### Agent37 Personal integration

This project follows the Hackyard instruction to use **Agent37 Personal**, not the Agent37 Cloud API page. Start at <https://agent37.com/personal> and use the Personal flow provided for the challenge.

The public Agent37 Personal page describes a hosted personal agent and its own computer/workspace. The public Agent37 Cloud page is a separate API product. The Agent37 Cloud Starter Kit also documents a Cloud-specific API key and instance data-plane endpoints; this project does not use that Cloud flow.

**Important limitation:** the Personal instance ID is an identifier. The public information available for this build does not establish a supported browser-embeddable chat endpoint or a complete Personal API contract. Therefore this code does not guess an endpoint, does not call `api.agent37.com`, and does not claim that an instance ID is sufficient to connect a web chat.

`js/agent37Adapter.js` is the single adapter boundary. To connect it:

1. Confirm the actual supported Personal integration method in your Agent37 Personal dashboard or from Agent37 support.
2. If the supported method requires a secure application bridge, deploy a bridge you control. It must authenticate the request and safely forward it to the documented Personal interface.
3. Configure `agent37.enabled`, `agent37.instanceId` and `agent37.bridgeUrl` in `js/config.js`. Users must be signed in with Firebase; the frontend sends the Firebase ID token to the bridge for verification.
4. The bridge contract expected by this frontend is:

```json
{
  "instanceId": "your-personal-instance-id",
  "message": "Plan a short trip to Jaipur",
  "conversation": [],
  "travellerProfile": {},
  "currentTrip": null,
  "availableTools": ["search_destinations", "search_flights", "search_hotels", "build_itinerary", "estimate_trip_cost"],
  "product": "WAYFARER AI"
}
```

Expected response:

```json
{
  "reply": "The agent's response text",
  "actions": [
    {
      "name": "create_trip",
      "arguments": { "destination": "Jaipur, India", "budget": 25000, "travelers": 2 }
    }
  ]
}
```

The frontend recognizes a small allowlist of write proposals: `create_trip`, `extend_trip`, `optimize_budget`, `create_packing_checklist`, `simulate_disruption`, `create_demo_booking` and `request_booking_cancellation`. Read-only capability names are supplied to the agent for planning, but the bridge must not treat this list as permission to access user data without checking the authenticated Firebase UID. Unknown tool names or malformed arguments are ignored. The frontend creates a preview and requires the user's approval before applying any supported mutation.

This is **WAYFARER's bridge contract**, not a claim that Agent37 Personal natively exposes these exact request/response shapes. The bridge must be configured only after you confirm a supported Personal connection. Keep any private credentials on the bridge server. Never place a Cloud API key, access token or private credential in `js/config.js`.

Until a successful bridge response is received, planner responses are visibly labelled as built-in demo planner responses.

Official reference pages:

- Agent37 Personal: <https://www.agent37.com/personal>
- Agent37 Cloud (separate product; not used by this build): <https://www.agent37.com/cloud>
- Agent37 Cloud Starter Kit (Cloud-specific): <https://github.com/agent37-platform/starter-kit>

### Supabase Storage (files only)

Supabase is used only for private file storage. Authentication and app data remain in Firebase.

1. Create a Supabase project and a **private** Storage bucket, for example `wayfarer-private`.
2. Do not enable public access on the bucket.
3. Set up Firebase Functions dependencies:

```bash
cd functions
npm install
cd ..
```

4. Set the Supabase URL and bucket as Firebase Function parameters when prompted during deploy. Set the service-role key as a Firebase Secret:

```bash
firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
```

5. Configure `APP_ORIGIN` to your exact Firebase Hosting origin. The default is `http://localhost:8080` for local testing; change it for deployment.
6. Deploy the signing function:

```bash
firebase deploy --only functions:storageSign
```

7. Add the deployed `storageSign` function URL, Supabase project URL, bucket name and Supabase anon key to `js/config.js` under `storage`.

The browser sends its Firebase ID token to the signing function. The function verifies the token and creates short-lived Supabase signed upload/download URLs. The Supabase service-role key never reaches the browser. Uploads are restricted to PDF/JPEG/PNG/WebP and 10 MB. Paths are forced under `uploads/{firebaseUid}/`.

For production, add stronger per-file lifecycle handling, malware scanning, retention controls and audit monitoring. Verify CORS and bucket policy settings in your own project before allowing user uploads.

## 4. Demo flow (about 3 minutes)

1. Open the dashboard and point out the sample upcoming trip. Explain that sample trip details are demo data.
2. Open **Trip Planner** and use the suggestion “A Goa escape”. Show the planner's personalized context and the visible demo-mode disclosure.
3. Open **AI Workspace** and run: `Extend my Goa trip by two days and recalculate the budget.` Review the plan and before/after panel. Reject it, then run it again and confirm so the history demonstrates the approval gate.
4. Open **Stays** or **Flights**, inspect a sample option and prepare a demo booking. Confirm the booking only after reviewing the demo warning.
5. Open **My Trips** and **Bookings & Vouchers** to show the updated trip and demo booking reference.
6. Open **AI History** to show the request, plan, status and recorded result.
7. Open **Settings** and explain which integrations are configured and which remain demo-only.

## 5. Feature-to-judging-criteria mapping

| Judging area | Demonstration in this prototype |
|---|---|
| Personalization | Traveller profile, editable preferences, contextual planner and recommendation reasons |
| Intelligent automation | AI Workspace task intent parsing, action plans, allowlisted operations and task results |
| Orchestration | Trip creation, itinerary changes, sample inventory comparisons, cost summaries and booking records |
| Price validation | Demo catalogue validation with explicit non-live disclosure; provider interface ready for live adapters |
| Reliability | Input validation, error states, ownership rules, explicit approval and action history |
| User experience | Responsive editorial UI, theme modes, contextual help, concise workflows and itinerary views |
| Full travel lifecycle | Planning, trips, simulated reservations, voucher/document records and disruption/cancellation demo paths |
| Agent37 | Personal adapter boundary with honest unconfigured/bridge status; no false connection claims |

## 6. Important architecture boundaries

- `js/providers.js`: simulated travel providers. Replace these interfaces with real provider adapters only after obtaining legitimate API access and handling each provider's terms.
- `js/agent37Adapter.js`: single boundary for the Agent37 Personal bridge. No unsupported endpoint is hardcoded.
- `js/agent37Tools.js`: schema-limited action allowlist for proposals returned by the configured bridge.
- `js/storage.js` + `functions/index.js`: private Supabase Storage using Firebase-verified signed URLs.
- `js/store.js` + `js/firebase.js`: local demo cache and optional Firebase cloud persistence.
- `firestore.rules`: per-user Firestore access restriction.

## 7. Before production use

This project is a hackathon prototype, not a production travel-booking operator. Before processing real trips or payments, implement and test live provider integrations, booking idempotency, payment processing, cancellation policy retrieval, legal terms, privacy disclosures, support escalation, robust logging, monitoring, rate limits and comprehensive security testing. Never treat a simulated quote as a confirmed supplier price or a demo reservation as a real booking.
