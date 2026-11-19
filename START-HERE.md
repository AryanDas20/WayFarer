# WAYFARER AI — Start here (beginner guide)

WAYFARER AI is a static website (HTML/CSS/JS) plus two small server routes in `/api`, hosted on Vercel.
The AI is **Agent37 Cloud** (your instance `groyjqmd5x`). Accounts and saved trips use **Firebase**.

## 1. Update your local repository (keeps your Git history)
1. Unzip this project somewhere temporary. You will see a folder `WayFarer-main`.
2. Open your real repo folder `Wayfarer-AI-Hackyard-2026`. **Do not delete the hidden `.git` folder.**
3. Copy everything *inside* `WayFarer-main` into that folder and choose "Replace" when asked.
4. In a terminal inside the repo folder:
```bash
git add .
git commit -m "WAYFARER AI v2: structured planner, trip page, landing page, secure Agent37 route"
git push origin main
```
Vercel redeploys automatically after the push.

## 2. Vercel environment variables (Project → Settings → Environment Variables)
These nine names must exist for **Production** (values are yours; never paste them in chat or commit them):

| Name | Value |
|---|---|
| `AGENT37_API_KEY` | your `sk_live_…` key from Agent37 dashboard → API keys |
| `AGENT37_INSTANCE_ID` | `groyjqmd5x` |
| `AGENT37_BASE_URL` | `https://groyjqmd5x.agent37.app/v1` |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Firebase Console → Project settings → Your apps → Web app → config |

After changing any variable: Vercel → Deployments → ⋯ → **Redeploy**. (Variables only apply to new deployments.)

## 3. Firebase setup (one time)
1. Console → **Authentication → Sign-in method** → enable **Email/Password** (and Google if you want that button).
2. **Authentication → Settings → Authorized domains** → add your Vercel domain (e.g. `your-app.vercel.app`).
3. **Firestore Database → Create database** (production mode, any region).
4. **Firestore → Rules** → paste the contents of `firestore.rules` from this project → **Publish**.
   This is what stops one user from reading another user's trips.

## 4. Agent37
- The server calls `POST https://groyjqmd5x.agent37.app/v1/responses` with header `X-Agent37-Key` (matches Agent37's docs).
- Your instance must be running and your workspace needs credit. **Each chat message can use credits** — Agent37 Cloud is not free.
- If the chat shows "insufficient credit", "rejected the API key" or "instance not found", the message says which setting to check.

## 5. Run locally
```bash
node -v        # 18 or newer
npm run check  # static checks + unit tests
cp .env.example .env.local   # then fill in your own values (this file is git-ignored)
npm run dev    # http://localhost:8080
```
Local chat needs real Firebase + Agent37 values in `.env.local`.

## 6. Using the app
Landing page → **Open planner** → sign in → describe a trip → review the proposed plan → **Review & save as trip** → open it under **My trips** to edit the itinerary, check weather, adjust the budget estimate, or open flight/stay/activity searches with details pre-filled.

## What is real and what is not
- Real: AI replies (Agent37), accounts and saved trips (Firebase), weather and place search (Open-Meteo).
- Estimates only: all AI costs and the budget breakdown. They are labelled as estimates.
- Search links only: flights, hotels, activities (Google, Skyscanner, Booking.com, GetYourGuide). WAYFARER cannot book or take payment and never claims to.
