# WAYFARER AI — Beginner setup (Mac + Firebase + Agent37 Cloud + Vercel)

This guide is for the ZIP you received. Follow it in order. You will connect your own Firebase project and your existing Agent37 Cloud Hermes instance.

## Before you begin

You need:
- Node.js 22 LTS: https://nodejs.org
- A Firebase account: https://console.firebase.google.com
- A GitHub account: https://github.com
- A Vercel account: https://vercel.com
- Your Agent37 Cloud API key and instance ID

**Billing note:** Agent37 Cloud is metered. Running compute, disk, model usage and connected tools may cost money. Check your balance and usage before sending many requests.

## Part 1 — Extract and run the website

1. Download and extract this ZIP.
2. Open Terminal. Type `cd ` (include a space), drag the extracted `WayFarer-main` folder into Terminal, then press Enter.
3. Check Node.js:

```bash
node -v
npm -v
```

4. Create your local environment file:

```bash
cp .env.example .env.local
```

5. Open the `WayFarer-main` folder in VS Code. Open `.env.local`. Fill in the Agent37 and Firebase values you will collect in Parts 2 and 3. Keep this file private; it is ignored by Git.
6. Install dependencies and start the website:

```bash
npm install
npm run dev
```

7. Open http://localhost:8080. Keep Terminal open while testing.
8. In another Terminal tab/window, navigate to the same folder and run:

```bash
npm run check
```

The last line should report that the project check passed.

## Part 2 — Get Firebase values

1. Open https://console.firebase.google.com and create or open your WAYFARER AI project.
2. Click the gear beside Project Overview → **Project settings**.
3. Scroll to **Your apps**. If there is no Web App, click the `</>` icon, register an app named `WAYFARER AI`, and finish.
4. Under **SDK setup and configuration**, choose **Config**.
5. Copy the values from the `firebaseConfig` object:

| Vercel/local variable | Firebase property |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |

6. In Firebase → **Authentication** → Get started → **Sign-in method**, enable Email/Password. You can enable Google later.
7. In Firebase → **Firestore Database**, create a database in production mode.
8. After Vercel deploys, add the exact Vercel hostname in Authentication → Settings → Authorized domains.

These six values are Firebase Web App configuration. They are not service-account private keys. Do not download a service-account JSON file for this setup.

## Part 3 — Get Agent37 Cloud values

1. Open your Agent37 Cloud dashboard.
2. Go to **Cloud → API keys**.
3. Copy your `sk_live_...` key. Do not share it in chat, screenshots, GitHub, or browser code.
4. Use the Hermes instance you selected for WAYFARER AI. Your instance ID in this setup is `groyjqmd5x`.
5. The base URL is:

```text
https://groyjqmd5x.agent37.app/v1
```

6. Make sure the instance is running and its Hermes model/provider is configured. The Cloud API key authenticates the app to the Hermes gateway; it is not itself a language-model provider key.

**Do not create `AGENT37_API_SERVER_KEY`.** This integration uses the Agent37 Cloud `sk_live_...` key in the documented `X-Agent37-Key` header.

## Part 4 — Add the nine environment variables to Vercel

1. Open your Vercel dashboard and select the WAYFARER project.
2. Open **Settings → Environment Variables**.
3. Add each variable separately. Select Production; also select Preview/Development if you want those deployments to use the same services.

### Agent37 Cloud variables

| Name | Value |
|---|---|
| `AGENT37_API_KEY` | Paste your Agent37 `sk_live_...` key |
| `AGENT37_INSTANCE_ID` | `groyjqmd5x` |
| `AGENT37_BASE_URL` | `https://groyjqmd5x.agent37.app/v1` |

### Firebase variables

| Name | Value |
|---|---|
| `FIREBASE_API_KEY` | Firebase `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | Firebase `authDomain` |
| `FIREBASE_PROJECT_ID` | Firebase `projectId` |
| `FIREBASE_STORAGE_BUCKET` | Firebase `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase `messagingSenderId` |
| `FIREBASE_APP_ID` | Firebase `appId` |

5. Click Save for each variable.
6. Go to **Deployments**, open the latest deployment's three-dot menu and choose **Redeploy**. Environment variable changes only apply to new deployments.

The six Firebase values are public Web App config. The Agent37 key is private and is used only by the server-side function.

## Part 5 — Deploy your project to GitHub and Vercel

1. Create a GitHub repository named `WAYFARER-AI`.
2. Upload the **contents** of the extracted `WayFarer-main` folder to the repository root. `index.html`, `api/`, `js/`, `package.json`, and `vercel.json` must be at the root.
3. Do not upload `.env.local`. The `.gitignore` file excludes it.
4. In Vercel, choose **Add New → Project**, import the GitHub repository.
5. Set:
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: leave blank
   - Output Directory: `.`
   - Install Command: `npm install`
6. Add the nine variables if you have not already done so.
7. Click Deploy.
8. After deployment, copy your Vercel domain and add it in Firebase Authentication → Settings → Authorized domains.

## Part 6 — Deploy Firestore security rules

From Terminal, inside the project folder:

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
```

Open `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with the exact Firebase `projectId`. Save it, then run:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Part 7 — Test the integrations

1. Open your Vercel website.
2. Open Settings and create a WAYFARER account with Email/Password.
3. Confirm that you can sign in.
4. Open My Trips and save a trip. Refresh and confirm it remains saved.
5. Open Trip Planner or AI Workspace.
6. Send a simple test such as: `Hello. You are the WAYFARER travel concierge. Tell me what you can help me plan.`
7. The first Agent37 request may take longer if the instance is waking. The instance should be running for the best chance of success.
8. If an error appears, read the exact message. Check Vercel → Functions/Logs and Agent37 instance logs. Do not paste your secret key into chat.

## How the Agent37 connection works

Browser → Vercel `/api/agent37` → verify Firebase ID token → Agent37 instance `/v1/responses`.

The Agent37 API key stays on the server. The server uses the official `X-Agent37-Key` header and streams the Hermes response back to the website. Each signed-in user gets a separate browser-tab session ID.

## What the website does not do

- It does not invent flight/hotel prices or live availability.
- Flight, hotel and activity buttons open external provider searches.
- It does not complete supplier bookings, payments, cancellations or rebookings.
- Agent37 replies are real upstream responses. If the service fails, the website shows the error; it does not make up an answer.
- Agent37 chat does not automatically write changes to your saved trips.

