import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const providers = read('js/providers.js');
const store = read('js/store.js');
const config = read('js/config.js');
const app = read('js/app.js');
const agentApi = read('api/agent37.js');
const firebaseApi = read('api/firebase-config.js');
const adapter = read('js/agent37Adapter.js');
const guide = read('START-HERE.md');

assert.match(providers, /api\.open-meteo\.com/);
assert.match(providers, /api\.frankfurter\.dev/);
assert.doesNotMatch(providers, /amadeus|demoFlights|sampleHotels|fakeBookings|DEMO_DESTINATIONS/i);
assert.match(app, /www\.google\.com\/travel\/flights/);
assert.match(app, /www\.booking\.com\/searchresults/);
assert.match(app, /EXTERNAL PROVIDER/);
assert.doesNotMatch(app, /Amadeus|AMADEUS_API|travel\.apiEndpoint/i);
assert.doesNotMatch(store, /function\s+seed|seedDemoData|DEMO_TRIPS/i);
assert.match(store, /purgeLegacyDemoRecords/);
assert.match(config, /apiKey: ''/);
assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}|sk_live_|BEGIN PRIVATE KEY/i);
assert.match(agentApi, /X-Agent37-Key/);
assert.match(agentApi, /\/v1\/responses|responses/);
assert.match(agentApi, /verifySignature/);
assert.match(agentApi, /AGENT37_API_KEY/);
assert.match(firebaseApi, /FIREBASE_MESSAGING_SENDER_ID/);
assert.doesNotMatch(firebaseApi, /AGENT37_API_KEY|FIREBASE_PRIVATE_KEY|SERVICE_ACCOUNT/i);
assert.match(adapter, /\/api\/agent37/);
assert.match(adapter, /session_id/);
assert.match(guide, /AGENT37_BASE_URL/);
assert.match(guide, /FIREBASE_APP_ID/);
assert.match(guide, /X-Agent37-Key/);
assert.equal(fs.existsSync(new URL('../workers/travel-api/src/index.js', import.meta.url)), false);

console.log('Project check passed: Firebase runtime configuration, authenticated server-side Agent37 proxy, secret isolation, external travel searches, and no Amadeus integration.');
