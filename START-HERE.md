# WAYFARER AI — Beginner setup guide (Mac + Firebase + GitHub + Vercel)

Follow these steps in order. You do not need Amadeus, Cloudflare, an airline API key, a hotel API key, or any Vercel environment variables for this version.

## Before you start

You need:
- A Mac and an internet connection.
- A Google account for Firebase.
- A GitHub account (free) to store the project code.
- A Vercel account (free tier is enough for a static prototype).

This ZIP contains the website source code, not your own Firebase project or Agent37 connection.

**What this version does:** destination lookup and weather use Open-Meteo; currency reference rates use Frankfurter; flight, hotel and activity forms open external travel search websites. It does not fetch supplier prices or book travel. There are no fabricated flight/hotel results.

---

## Part 1 — Download and open the website on your Mac

### Step 1: Extract the ZIP

1. Download `WAYFARER-AI-Vercel-Firebase-Updated.zip`.
2. Open your Mac's **Downloads** folder.
3. Double-click the ZIP file.
4. You should see a folder named `wayfarer-ai`.

### Step 2: Install Node.js

Node.js runs the small local web server used to preview the site.

1. Open <https://nodejs.org>.
2. Download the **LTS** version for macOS.
3. Open the installer and follow the installation steps.
4. Open **Terminal** (press Command + Space, type `Terminal`, press Return).
5. Type these commands one at a time:

```bash
node -v
npm -v
```

You should see version numbers. If Terminal says `command not found`, close and reopen Terminal. If it still fails, reinstall Node.js LTS.

### Step 3: Start WAYFARER on your Mac

1. In Terminal, type `cd ` (type `cd`, then one space; do not press Return yet).
2. Drag the extracted `wayfarer-ai` folder from Finder into Terminal.
3. Press Return.
4. Type:

```bash
npm run dev
```

5. Keep Terminal open while you use the website.
6. Open Chrome and visit <http://localhost:8080>.

To stop the local website, go back to Terminal and press **Control + C**.

### Step 4: Run the project check

While Terminal is in the `wayfarer-ai` folder, run:

```bash
npm run check
```

The last line should say the project check passed.

---

## Part 2 — Create Firebase (login and saved trips)

### Step 5: Create a Firebase project

1. Visit <https://console.firebase.google.com>.
2. Sign in with your Google account.
3. Click **Create a project**.
4. Enter a project name, for example `wayfarer-ai-yourname` (Firebase project IDs must be unique).
5. You can turn Google Analytics off for this prototype.
6. Finish creating the project.

### Step 6: Register the website as a Firebase Web App

1. Open your new Firebase project.
2. On the project overview page, click the Web icon `</>` to add a web app.
3. Give it a nickname such as `WAYFARER Website`.
4. Register the app.
5. Firebase shows a configuration object. Find and copy these four values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

You need the **Web App config**, not a service-account JSON file. Never download or paste a service-account private key into this website.

### Step 7: Enable Firebase sign-in

1. In Firebase, open **Build → Authentication**.
2. Click **Get started** if Firebase shows it.
3. Open **Sign-in method**.
4. Enable **Email/Password**, then Save.
5. Optional: enable **Google**. If you enable it, choose a support email and save.
6. Later, after Vercel gives you your website address, add that domain under **Authentication → Settings → Authorized domains**.

### Step 8: Create the Firestore database

1. Open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose production mode.
4. Choose a location near your expected users. The database location is difficult to change later.
5. Finish creating the database.

### Step 9: Put the four Firebase values in the project

1. Open the extracted `wayfarer-ai` folder in Visual Studio Code. Download it from <https://code.visualstudio.com> if you do not have it.
2. In the left file list, open `js`, then `config.js`.
3. Find this section:

```js
firebase: {
  apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_FIREBASE_WEB_APP_ID'
},
```

4. Replace each `YOUR_...` placeholder with the matching value copied from Firebase. Keep the quotation marks and commas.
5. Save the file.

Example only (not real credentials):

```js
firebase: {
  apiKey: 'AIza...your-web-app-key...',
  authDomain: 'wayfarer-ai-123.firebaseapp.com',
  projectId: 'wayfarer-ai-123',
  appId: '1:123456789:web:abcdef'
},
```

Firebase Web App config is public browser configuration. It is okay for this file to be in your website repository. **Do not put a service-account key, private key, Supabase service-role key, or other server secret here.**

---

## Part 3 — Put the code on GitHub

### Step 10: Create a GitHub repository

1. Visit <https://github.com> and sign in or create a free account.
2. Click the `+` icon near the top-right, then **New repository**.
3. Repository name: `WAYFARER-AI`.
4. Choose **Public** or **Private**. Either works with Vercel.
5. Do not add a README, license or `.gitignore` because these are already in the project folder.
6. Click **Create repository**.

### Step 11: Upload using GitHub Desktop (beginner-friendly)

1. Download GitHub Desktop from <https://desktop.github.com> and install it.
2. Open GitHub Desktop and sign in to your GitHub account.
3. Choose **File → Add Local Repository**. If it says the folder is not a repository, choose the option to create a repository there, or choose **File → New Repository** and set the local path to the extracted `wayfarer-ai` folder.
4. Make sure the local repository folder is the extracted `wayfarer-ai` folder itself (the folder containing `index.html`).
5. In the Changes tab, you should see the project files. Add a summary such as `Initial WAYFARER AI website` and click **Commit to main**.
6. Click **Publish repository** at the top. Choose the GitHub repository you created. Publish it.

Important: `js/config.js` contains only the Firebase public Web App config and placeholders. It is intentionally included so Vercel can load it. Never add private credentials or service-account JSON to this file.

---

## Part 4 — Deploy the website on Vercel

### Step 12: Import the GitHub repository into Vercel

1. Visit <https://vercel.com>.
2. Sign up or log in using GitHub.
3. Click **Add New → Project**.
4. Find your `WAYFARER-AI` repository and click **Import**.
5. On Configure Project, use these settings:

| Setting | Value |
|---|---|
| Framework Preset | Other |
| Root Directory | `./` |
| Build Command | Leave blank |
| Output Directory | `.` |
| Install Command | Leave blank |

6. **Environment Variables: leave this section empty.** No Vercel environment variables are required for this version.
7. Click **Deploy**.
8. Wait for Vercel to finish. It will show a website address similar to `https://wayfarer-ai-something.vercel.app`.
9. Open the website address. Your website is online.

If you change the code later and push a new commit to GitHub, Vercel automatically builds and deploys the update.

---

## Part 5 — Connect the Vercel website to Firebase

### Step 13: Add your Vercel domain to Firebase Authentication

1. Copy the Vercel website domain, for example `wayfarer-ai-something.vercel.app` (do not include `https://` or a slash).
2. Return to Firebase Console.
3. Open **Authentication → Settings → Authorized domains**.
4. Click **Add domain**.
5. Paste your exact Vercel domain and save.
6. Keep `localhost` listed so local testing continues to work.

### Step 14: Publish Firestore security rules

This step protects users' saved data so one signed-in user cannot read another user's private records.

1. Open Terminal.
2. Type `cd ` and drag your `wayfarer-ai` folder into Terminal, then press Return.
3. Install Firebase command-line tools:

```bash
npm install -g firebase-tools
```

4. Sign in:

```bash
firebase login
```

5. Create the Firebase project link file:

```bash
cp .firebaserc.example .firebaserc
```

6. Open `.firebaserc` in Visual Studio Code. Replace `YOUR_FIREBASE_PROJECT_ID` with the exact `projectId` from `js/config.js`. Save.
7. In Terminal, run:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

8. Confirm the deployment finishes successfully.

The `.firebaserc` file is local and ignored by Git. You do not need to upload it to GitHub.

### Step 15: Test sign-in and saved trips

1. Open your Vercel website and refresh it.
2. Open **Settings**.
3. Click **Sign in / create account**.
4. Create an account with your email and a password of at least six characters.
5. Sign in.
6. Open **My Trips** and create a trip using your own destination and dates.
7. Refresh the page and confirm that the trip is still there.
8. If sign-in fails, check the Firebase Web App values in `js/config.js`, Authentication providers, authorized domains and browser console error.

---

## Part 6 — Agent37 Personal (do this only after the website works)

1. Visit <https://agent37.com/personal> and sign in to Agent37 Personal.
2. Use the Personal product for the Hackyard challenge. Do not switch to Agent37 Cloud Sandbox or its API page just to obtain a key.
3. An Agent37 instance ID by itself does **not** tell a website how to send messages to the agent.
4. Check the Personal dashboard for an official documented website embed, external integration, webhook or supported connection method. If you cannot find one, ask Agent37 support for the exact Personal integration instructions.
5. Do not invent an endpoint, and do not paste an instance ID into a random API URL.
6. Until an official connection is provided and tested, keep `enabled: false` in `js/config.js`. The site will correctly show Agent37 as not connected.

This ZIP does not claim Agent37 Personal is already connected. No OpenAI API key is required or used as a substitute.

---

## Part 7 — What about Amadeus, API keys and environment variables?

- Do not create `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_API_KEY` or `AMADEUS_API_SECRET` for this project.
- The old Amadeus Self-Service setup has been removed from the code and guide.
- No Cloudflare Worker is required.
- No Vercel environment variables are required.
- Open-Meteo and Frankfurter public endpoints do not need API keys for the features used here.
- Flight, hotel and activity searches open external provider websites. The external provider shows the live prices and availability.

---

## Optional features — skip these at first

### Supabase document storage

The project contains a helper for private document uploads through a Firebase-authenticated signing endpoint. It is not ready merely by adding a Supabase URL and anon key. You need a secure backend that verifies Firebase ID tokens and creates signed storage URLs. The included optional Cloud Function may require a Firebase billing-enabled plan. Skip this feature for your initial free setup.

### Custom domain

After the Vercel deployment works, you can add a domain in Vercel → Project → Settings → Domains. Add the final custom domain to Firebase Authentication → Authorized domains too.

---

## Troubleshooting

**Vercel shows a 404:** Make sure `index.html` is at the repository root, not nested inside another `wayfarer-ai/wayfarer-ai` folder. Confirm Root Directory is `./` and Output Directory is `.`.

**Firebase says auth/unauthorized-domain:** Add the exact Vercel hostname under Firebase Authentication → Settings → Authorized domains.

**Firebase says API key not valid:** Re-copy the `apiKey`, `authDomain`, `projectId` and `appId` from Firebase Project settings → General → Your apps, and update `js/config.js`.

**Sign-in works but saved trips do not:** Make sure Firestore Database was created and Step 14 rules deployment completed successfully.

**Flight search does not show fares inside WAYFARER:** This is expected. The app opens Google Flights or Skyscanner. The live results and prices appear on the provider website.

**Agent37 says not connected:** This is expected until Agent37 provides a supported Personal external connection and you configure and test a secure bridge.

**Weather or currency fails:** Check your internet connection and retry. These public services may occasionally be unavailable.

---

## Useful links

- Firebase Console: <https://console.firebase.google.com>
- Firebase documentation: <https://firebase.google.com/docs>
- GitHub: <https://github.com>
- GitHub Desktop: <https://desktop.github.com>
- Vercel: <https://vercel.com>
- Node.js: <https://nodejs.org>
- Visual Studio Code: <https://code.visualstudio.com>
- Agent37 Personal: <https://agent37.com/personal>
- Open-Meteo: <https://open-meteo.com>
- Frankfurter: <https://frankfurter.dev>
