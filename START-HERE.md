# WAYFARER AI — Start Here (beginner guide)

This guide assumes you have never built or deployed a website before. Follow the steps in order. Do not skip ahead.

## Before you begin: what you have and what you still need

You have the website source code. This ZIP does **not** contain private keys, paid API access, a Firebase project, an Amadeus production account, or an Agent37 website connection. Those belong to you and must be configured.

The app is deliberately set to **no fabricated travel data**:

- There is no preloaded sample traveller, trip, destination list, hotel, flight, price, booking, voucher or fake AI chat response.
- Place search and weather use Open-Meteo's real public data services.
- Currency conversion uses Frankfurter's published reference rates (not bank/card real-time quotes).
- Flights, hotel offers and activity listings use Amadeus **Production** only, after you configure it. If you do not have Production access, these searches will show an explanation/error and no results.
- Your own trips and notes appear only after you enter them.
- The app does not claim to book or cancel real travel. It stores booking information you enter and documents you upload.
- Agent37 Personal is shown as not connected until you have an official, supported Personal integration method. An instance ID by itself is not a website chat API.

## Part 1 — Open the website on your Mac

### Step 1: Download and extract the ZIP

1. Download `Wayfarer-AI-Real-Data.zip`.
2. Open your **Downloads** folder in Finder.
3. Double-click the ZIP file. macOS creates a folder named `wayfarer-ai` (or a similarly named folder).

### Step 2: Install Node.js

Node.js is a free tool that runs the small local website server.

1. Open <https://nodejs.org>.
2. Download the **LTS** version for macOS.
3. Open the downloaded installer and follow the installation steps.
4. Open the **Terminal** app (press Command + Space, type `Terminal`, press Return).
5. Type these commands one at a time:

```bash
node -v
npm -v
```

Both commands should print version numbers. If you see “command not found”, close and reopen Terminal. If it still appears, install Node.js again.

### Step 3: Start WAYFARER AI

In Terminal, type `cd ` (include a space after `cd`). Drag the extracted `wayfarer-ai` folder from Finder into the Terminal window, then press Return.

Now type:

```bash
npm run dev
```

Keep this Terminal window open. It is running your website.

Open Chrome and visit:

<http://localhost:8080>

You should see the WAYFARER AI dashboard. To stop the local website later, return to Terminal and press **Control + C**.

### Step 4: Check the website code

To check JavaScript syntax, open another Terminal window, go to the same `wayfarer-ai` folder and run:

```bash
npm run check
```

A successful check ends without a syntax error.

## Part 2 — Set up Firebase (accounts and saving your own trips)

Firebase is used for sign-in and saving each user's own records. You can open and explore the website before configuring Firebase, but cloud sign-in and private live flight/hotel searches require Firebase.

### Step 5: Create a Firebase project

1. Visit <https://console.firebase.google.com>.
2. Sign in with your Google account.
3. Click **Create a project** and give it a name such as `wayfarer-ai`.
4. You can turn Google Analytics off for this prototype.
5. Finish creating the project.

### Step 6: Register the website with Firebase

1. In the Firebase project overview, click the Web icon `</>` to add a Web App.
2. Give it a nickname such as `WAYFARER Website`.
3. Register the app.
4. Firebase displays a configuration object. Copy these four values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

Do not copy a service-account private key into the website. The four Web App config values above are intended for browser setup; the Amadeus and Supabase secrets are not.

### Step 7: Enable sign-in

1. In Firebase, open **Build → Authentication**.
2. Click **Get started** if shown.
3. Open **Sign-in method**.
4. Enable **Email/Password** and save.
5. You may also enable **Google**. If you do, configure the support email and save.
6. Open **Settings → Authorized domains** and make sure `localhost` is listed. Firebase Hosting's `YOUR_PROJECT_ID.web.app` domain is usually added when Hosting is set up; check it later.

### Step 8: Create the Firestore database

1. Open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose the production mode option (the security rules in this project will be deployed in a later step).
4. Choose a nearby location. The location cannot easily be changed later, so choose one suitable for your users.
5. Finish creating the database.

### Step 9: Put Firebase's web settings in the project

1. Open the `wayfarer-ai` folder.
2. Open `js` and then open `config.js` in a text editor. Visual Studio Code (<https://code.visualstudio.com>) is recommended; TextEdit can also work if set to plain text.
3. Find the `firebase` section. Replace the four `YOUR_...` values with the four values you copied from Firebase.
4. Keep the quotation marks around the values. Do not change the other settings yet.
5. Save `config.js`.

Example format only — use your own Firebase values:

```js
firebase: {
  apiKey: 'paste-your-value-here',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  appId: 'paste-your-value-here'
},
```

The `config.js` file is ignored by Git so you do not accidentally upload your local configuration. Never put Amadeus secret keys or the Supabase service-role key in this file.

### Step 10: Deploy Firestore security rules

The rules restrict each signed-in user to their own data.

1. Return to Terminal.
2. Make sure Terminal is inside the main `wayfarer-ai` folder (not the `js` folder).
3. Install the Firebase command-line tool:

```bash
npm install -g firebase-tools
```

4. Sign in:

```bash
firebase login
```

5. Create the local Firebase project link:

```bash
cp .firebaserc.example .firebaserc
```

6. Open `.firebaserc` in your text editor. Replace `YOUR_FIREBASE_PROJECT_ID` with your actual Firebase `projectId`. Save it.
7. In Terminal, deploy the security rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

If Firebase asks you to select a project, choose the one you created.

### Step 11: Test Firebase sign-in

1. Refresh <http://localhost:8080>.
2. Open **Settings**.
3. Click the sign-in/create-account button.
4. Create an account using your email and a password with at least six characters.
5. Sign in.
6. Open **My Trips**, create a trip with your own real destination and dates, then refresh the page. It should remain saved to your account.

## Part 3 — Set up real flight, hotel and activity search

**Important:** This is the part that may require a payment method or paid use. Do not enter payment details unless you have read the provider's current pricing and chosen to proceed.

WAYFARER calls Amadeus only at `https://api.amadeus.com` (Production). It does not use the Amadeus test endpoint. Amadeus says its test environment uses limited, cached data, while Production provides real-time data. Production billing applies beyond the included quota and may require a payment method. See the official pricing and FAQ links at the bottom of this guide.

### Step 12: Create an Amadeus developer account

1. Visit <https://developers.amadeus.com>.
2. Register or sign in.
3. Create an application in the Self-Service API area.
4. Find your API Key and API Secret.
5. New apps commonly start with Test credentials. **Do not put Test credentials into this project expecting real live prices.**
6. Read Amadeus' current Production access and billing requirements. Only continue if you obtain Production credentials and accept the provider's pricing.

If you only have Test access, stop here. The flight/hotel/experience pages will intentionally not show Test data as live data.

### Step 13: Create a Cloudflare account for the secure travel connector

The Amadeus secret must stay on a server, not in your website. This project includes a Cloudflare Worker to hold those secrets securely.

1. Visit <https://dash.cloudflare.com/sign-up> and create a Cloudflare account.
2. Verify your email and sign in.
3. You do not need to put the Amadeus secret into the browser or share it with anyone.

### Step 14: Install the travel Worker

Open Terminal and go to the Worker folder inside your project:

```bash
cd workers/travel-api
npm install
npx wrangler login
```

A browser window opens. Approve the connection to your Cloudflare account.

Now add your secret values one at a time. Replace the text after each command with your own value; Terminal will ask you to enter it securely:

```bash
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put AMADEUS_API_KEY
npx wrangler secret put AMADEUS_API_SECRET
```

For `FIREBASE_PROJECT_ID`, use the same Firebase project ID from Step 6. For the other two, use your **Production** Amadeus key and secret.

### Step 15: Allow your local and hosted website origins

1. Open `workers/travel-api/wrangler.toml` in your text editor.
2. Find `APP_ORIGINS`.
3. While testing locally, this can be:

```toml
APP_ORIGINS = "http://localhost:8080"
```

4. When you later deploy the website, add its exact Firebase Hosting URL separated by a comma, for example:

```toml
APP_ORIGINS = "http://localhost:8080,https://YOUR_PROJECT_ID.web.app"
```

Replace `YOUR_PROJECT_ID` with your real Firebase project ID. Do not include a slash at the end.

### Step 16: Deploy the Worker

Make sure Terminal is still inside `workers/travel-api`, then run:

```bash
npm run deploy
```

Cloudflare prints a Worker URL. Copy it. It will look similar to `https://wayfarer-travel-api.YOUR_ACCOUNT.workers.dev` (your actual URL will be different).

### Step 17: Connect the website to the Worker

1. Open `js/config.js` in your text editor.
2. Find `travel: { apiEndpoint: '' }`.
3. Paste your real Worker URL between the quotes:

```js
travel: { apiEndpoint: 'https://YOUR-WORKER-URL.workers.dev' },
```

4. Save the file.
5. Refresh the website and sign in.
6. Open **Flights**, enter a route and future date, then search. Try **Stays** and **Experiences** too.

If the provider has no matching result, the website displays no result. If you see a configuration or access error, check the Worker URL, Firebase sign-in, Cloudflare Worker secrets, allowed origins and Amadeus Production access.

### Step 18: Deploy the Worker again if you change its settings

If you change `APP_ORIGINS` or the Worker code, return to `workers/travel-api` in Terminal and run:

```bash
npm run deploy
```

## Part 4 — Real public data that does not need API keys

These services are already connected:

- **Open-Meteo Geocoding:** real city/place search.
- **Open-Meteo Weather:** current and forecast weather for a selected location.
- **Frankfurter:** published currency reference rates. These are not live cash/card exchange quotes.

Open **Explore destinations** and search for a real city. Select **Weather** on a result to view the forecast. The website shows source attribution. Open **Settings** and use **Test public data sources** to check that the two public data services respond.

Open-Meteo's free API is for non-commercial use under its published request limits and CC BY attribution requirements. For a commercial product, contact Open-Meteo or use a suitable licensed provider.

## Part 5 — Agent37 Personal (read this carefully)

Follow the challenge's instruction exactly:

1. Open <https://agent37.com/personal> — not the general Cloud/API page.
2. Tap **Start free** and create your Personal agent. The challenge instructions say not to enter a card for this flow.
3. Open the Agent37 dashboard and create/configure your agent.
4. Use **Copy instance ID** and keep the ID private enough that you do not post it publicly.
5. Do **not** use the Agent37 Cloud Sandbox/API page for this challenge.

### Why the AI chat is not automatically connected yet

The Personal instance ID identifies your agent, but the publicly available Personal page does not document a website-embeddable chat endpoint or a complete request/response API. Therefore this project does not invent one. Putting the instance ID into `js/config.js` alone will not connect a chatbot.

Ask Agent37 support or check your Personal dashboard for its official method to connect a third-party website (for example, an officially supported webhook, messaging integration, or secure bridge). Ask them for the exact endpoint/protocol, authentication requirements, and whether third-party website embedding is supported by Personal. If they do not provide an official supported method, the website cannot safely connect to Personal just by using the instance ID.

Once you receive the official integration instructions, keep the private credentials on a secure server and share the documentation (not your secret keys) so the adapter can be completed correctly. Do not paste credentials into browser code, public chat, GitHub or screenshots.

Until a real bridge is configured and successfully responds, WAYFARER will show **Agent37 not connected** and will not pretend an AI task ran.

## Part 6 — Deploy your website online (Firebase Hosting)

Do this after the website works locally and Firebase is configured.

1. In Terminal, go back to the main project folder:

```bash
cd ../..
```

This command works if Terminal started from `workers/travel-api`. If you opened a new Terminal window, use `cd ` then drag the main `wayfarer-ai` folder into Terminal and press Return.

2. Make sure `.firebaserc` contains your project ID.
3. Deploy the website:

```bash
firebase deploy --only hosting
```

4. Firebase prints your hosted website URL, usually `https://YOUR_PROJECT_ID.web.app`.
5. Open that URL in Chrome.
6. In Firebase Authentication → Settings → Authorized domains, ensure your hosted domain is listed.
7. Add the hosted domain to `APP_ORIGINS` in `workers/travel-api/wrangler.toml`, along with `http://localhost:8080`, and redeploy the Worker.

If you changed `js/config.js` to set the Worker URL or Firebase credentials, those local config values are part of the deployed website. **Never upload secrets or private keys.**

## Part 7 — Optional private voucher/document uploads (may require billing)

The project includes secure Supabase Storage code, but uploads stay disabled until you configure the signing function. This optional setup uses Firebase Cloud Functions, which requires a Firebase project on the billing-enabled plan (Blaze); Google may charge for usage beyond no-cost allowances. Do not enable billing unless you understand the costs.

If you do not need document uploads for your initial test, skip this entire part. You can still use the rest of the website and enter your own booking details manually.

To enable it later:

1. Create a Supabase project at <https://supabase.com>.
2. Create a **private** Storage bucket named `wayfarer-private` (do not make it public).
3. In Firebase, enable billing only if you accept the possible charges and need Cloud Functions.
4. In Terminal, go to the main project folder, then run:

```bash
cd functions
npm install
cd ..
firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
```

When asked, paste the Supabase **service-role** key. Never put it in `js/config.js` or expose it in your website.

5. Set the Firebase Function parameters `SUPABASE_URL`, `SUPABASE_BUCKET` and `APP_ORIGIN` when the CLI prompts during deployment. Use the exact Supabase project URL, bucket name `wayfarer-private`, and your website origin.
6. Deploy:

```bash
firebase deploy --only functions:storageSign
```

7. In Firebase Functions, copy the deployed `storageSign` URL.
8. Put that URL, your Supabase project URL, bucket name and Supabase **anon/public** key into the `storage` section of `js/config.js`. Only the anon key belongs in the browser. Never use the service-role key there.

The upload feature accepts PDF/JPEG/PNG/WebP up to 10 MB and signs paths under the signed-in user's own UID.

## What each page currently does (honest feature list)

- **Overview:** your own trip/task/budget counts. No preloaded trips.
- **Explore destinations:** live place lookup from Open-Meteo Geocoding; no fabricated destination rankings or prices.
- **Trip planner:** forwards a conversation to Agent37 only after a supported connection is configured; otherwise it explains the disconnected state.
- **AI Workspace:** sends tasks to Agent37 only after connection; displays a proposed website change and requires your approval. Supported writes are limited to trip create/update and packing checklist.
- **My trips:** stores trips you create or that a connected agent proposes and you approve.
- **Flights:** Amadeus Production search only.
- **Stays:** Amadeus Production hotel offers only.
- **Experiences:** Amadeus Production activities only.
- **Budget:** totals amounts you entered/recorded; no invented category estimates.
- **Bookings & vouchers:** displays booking details you enter and files you upload. It does not create fake supplier booking confirmations.
- **AI history:** records actual connected Agent37 replies and user-approved changes.
- **Travel support:** saves a support note to your own account; it does not claim to contact a human consultant.
- **Settings:** Firebase profile, integration status and tests for public data services.

## Troubleshooting

**The page does not open:** Check that the Terminal window running `npm run dev` is still open. Try `http://localhost:8080` again.

**`npm: command not found`:** Install Node.js LTS and restart Terminal.

**Firebase sign-in is unavailable:** Check the Firebase values in `js/config.js`, confirm Email/Password is enabled, and check that `localhost` is an authorized domain.

**Firestore permission denied:** Deploy the project's security rules and confirm you are signed in to the correct Firebase project.

**Flights/hotels say not configured:** Add your Worker URL in `js/config.js`, sign in, and confirm the Worker has Amadeus Production key/secret and Firebase project ID secrets.

**Amadeus says unauthorized or invalid client:** Check you used Production credentials, not Test credentials; re-enter the secrets in Cloudflare and redeploy if needed.

**The Worker says origin not allowed:** Add the exact origin (including `https://` and without a trailing slash) to `APP_ORIGINS`, then redeploy the Worker.

**Agent37 says not connected:** This is intentional until you have the official Personal website integration method. An instance ID alone is not enough.

**No flights/hotels found:** The app does not insert a substitute result. Check the route/date, provider coverage, credentials and current supplier inventory.

## Official references

- Firebase console: <https://console.firebase.google.com>
- Firebase Web setup: <https://firebase.google.com/docs/web/setup>
- Firebase Authentication: <https://firebase.google.com/docs/auth/web/start>
- Firestore: <https://firebase.google.com/docs/firestore>
- Firebase Hosting: <https://firebase.google.com/docs/hosting>
- Cloudflare Workers: <https://developers.cloudflare.com/workers/>
- Amadeus developer portal: <https://developers.amadeus.com>
- Amadeus Self-Service Quick Start: <https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/quick-start/>
- Amadeus Hotel Search v3 tutorial: <https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/hotels/>
- Amadeus Test vs Production data: <https://amadeus4dev.github.io/developer-guides/test-data/>
- Amadeus pricing: <https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/pricing/>
- Amadeus API FAQ: <https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/>
- Agent37 Personal: <https://www.agent37.com/personal>
- Open-Meteo: <https://open-meteo.com/>
- Open-Meteo terms: <https://open-meteo.com/en/terms>
- Frankfurter: <https://frankfurter.dev/>

---

**This is a no-fabricated-data prototype, not a complete online travel agency.** Real-time supplier search requires the relevant provider's Production access. Actual booking, payment, cancellation and rebooking need additional supplier/payment integrations and are intentionally not presented as complete in this version.
