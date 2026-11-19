import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const providers = read('js/providers.js');
const store = read('js/store.js');
const config = read('js/config.js');
const app = read('js/app.js');
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
assert.match(config, /YOUR_FIREBASE_WEB_API_KEY/);
assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|BEGIN PRIVATE KEY/i);
assert.match(guide, /Vercel/);
assert.match(guide, /No Vercel environment variables are required/);
assert.equal(fs.existsSync(new URL('../workers/travel-api/src/index.js', import.meta.url)), false);

console.log('Project check passed: no Amadeus integration, no fabricated inventory, external travel search links, public data providers, and Vercel setup guide present.');
