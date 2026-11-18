import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const providers = read('js/providers.js');
const store = read('js/store.js');
const worker = read('workers/travel-api/src/index.js');
const config = read('js/config.js');
const app = read('js/app.js');

assert.match(providers, /LIVE PROVIDERS ONLY/);
assert.doesNotMatch(providers, /demoFlights|sampleHotels|fakeBookings|DEMO_DESTINATIONS|seedTrip/i);
assert.match(worker, /https:\/\/api\.amadeus\.com/);
assert.doesNotMatch(worker, /test\.api\.amadeus\.com/);
assert.match(worker, /verifyFirebaseIdToken/);
assert.match(worker, /by-geocode/);
assert.doesNotMatch(store, /function\s+seed|seedDemoData|DEMO_TRIPS/i);
assert.match(store, /purgeLegacyDemoRecords/);
assert.match(app, /No sample results have been substituted/);
assert.match(app, /will not prefill sample itineraries/);
assert.match(config, /YOUR_FIREBASE_WEB_API_KEY/);
assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}/);

console.log('Project integrity check passed: no seeded travel inventory, Amadeus Production only, Firebase auth required for supplier search.');
