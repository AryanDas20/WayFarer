import { importX509, jwtVerify } from 'jose';

const AMADEUS_PROD = 'https://api.amadeus.com';
const FIREBASE_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { expiresAt: 0, certs: null };
let amadeusToken = { value: null, expiresAt: 0 };

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'vary': 'Origin',
      'cache-control': 'no-store'
    }
  });
}

async function verifyFirebaseIdToken(request, projectId) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Sign in first. A Firebase ID token is required.');
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured on the travel worker.');

  if (!certCache.certs || Date.now() >= certCache.expiresAt) {
    const response = await fetch(FIREBASE_CERT_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw new Error('Could not verify Firebase signing certificates.');
    const cacheControl = response.headers.get('cache-control') || '';
    const maxAge = Number((cacheControl.match(/max-age=(\d+)/i) || [])[1] || 300);
    certCache = { certs: await response.json(), expiresAt: Date.now() + maxAge * 1000 };
  }

  const { payload, protectedHeader } = await jwtVerify(
    match[1],
    async header => {
      const pem = certCache.certs?.[header.kid];
      if (!pem) throw new Error('Firebase token signing key is not recognised.');
      return importX509(pem, 'RS256');
    },
    { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, algorithms: ['RS256'] }
  );
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) throw new Error('Firebase token has no valid user ID.');
  if (protectedHeader.alg !== 'RS256') throw new Error('Unsupported Firebase token algorithm.');
  return payload.sub;
}

async function getAmadeusToken(env) {
  if (amadeusToken.value && Date.now() < amadeusToken.expiresAt - 60_000) return amadeusToken.value;
  if (!env.AMADEUS_API_KEY || !env.AMADEUS_API_SECRET) throw new Error('Live travel search is not configured. Add AMADEUS_API_KEY and AMADEUS_API_SECRET as Worker secrets.');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.AMADEUS_API_KEY,
    client_secret: env.AMADEUS_API_SECRET
  });
  const response = await fetch(`${AMADEUS_PROD}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.errors?.[0]?.detail || payload.error || `HTTP ${response.status}`;
    throw new Error(`Amadeus authentication failed: ${detail}`);
  }
  amadeusToken = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 1800) * 1000 };
  return amadeusToken.value;
}

async function amadeusRequest(env, path, { method = 'GET', query, body } = {}) {
  const token = await getAmadeusToken(env);
  const url = new URL(`${AMADEUS_PROD}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/vnd.amadeus+json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const first = payload.errors?.[0];
    const message = first?.detail || first?.title || payload.error_description || `Provider returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status === 401 ? 502 : response.status;
    throw error;
  }
  return payload;
}

function dateIsValid(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false; const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }
function boundedInteger(value, fallback, min, max, label) { const n = Number(value ?? fallback); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`); return n; }
function validateDateRange(from, to) {
  if (!dateIsValid(from)) throw new Error('Enter a valid departure/check-in date (YYYY-MM-DD).');
  if (to && (!dateIsValid(to) || Date.parse(`${to}T00:00:00Z`) <= Date.parse(`${from}T00:00:00Z`))) throw new Error('Return/check-out date must be after the departure/check-in date.');
  if (Date.parse(`${from}T00:00:00Z`) < Date.now() - 86400000) throw new Error('Choose a date that is not in the past.');
}

async function resolveCityCode(env, value, subtype = 'CITY') {
  const raw = String(value || '').trim();
  if (/^[A-Z]{3}$/i.test(raw)) return raw.toUpperCase();
  if (raw.length < 2) throw new Error(`Enter a city name or 3-letter IATA code for ${subtype.toLowerCase()}.`);
  const result = await amadeusRequest(env, '/v1/reference-data/locations', {
    query: { subType: subtype, keyword: raw.slice(0, 40), 'page[limit]': 10 }
  });
  const items = result.data || [];
  const preferred = items.find(x => x.subType?.toUpperCase() === subtype && x.iataCode) || items.find(x => x.iataCode);
  if (!preferred?.iataCode) throw new Error(`No Amadeus ${subtype.toLowerCase()} code was found for "${raw}". Try a major city or airport code.`);
  return preferred.iataCode;
}

async function dispatch(env, input, uid) {
  const action = String(input.action || '');
  if (action === 'locations') {
    const keyword = String(input.keyword || '').trim();
    if (keyword.length < 2) throw new Error('Enter at least two characters to search airports/cities.');
    const subtype = input.subType === 'CITY' ? 'CITY' : 'AIRPORT';
    const result = await amadeusRequest(env, '/v1/reference-data/locations', { query: { subType: subtype, keyword: keyword.slice(0, 40), 'page[limit]': 12 } });
    return { data: result.data || [], source: 'Amadeus production', retrievedAt: new Date().toISOString(), live: true };
  }

  if (action === 'flights') {
    validateDateRange(input.departureDate, input.returnDate);
    const [origin, destination] = await Promise.all([
      resolveCityCode(env, input.origin, 'AIRPORT'),
      resolveCityCode(env, input.destination, 'AIRPORT')
    ]);
    if (origin === destination) throw new Error('Origin and destination must be different.');
    const adults = boundedInteger(input.adults, 1, 1, 9, 'Adults');
    const result = await amadeusRequest(env, '/v2/shopping/flight-offers', {
      query: {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: input.departureDate,
        returnDate: input.returnDate || undefined,
        adults,
        currencyCode: input.currency || 'INR',
        max: 20
      }
    });
    return { ...result, source: 'Amadeus production · live supplier offers', resolvedRoute: { origin, destination }, retrievedAt: new Date().toISOString(), live: true, requestedBy: uid };
  }

  if (action === 'hotels') {
    validateDateRange(input.checkInDate, input.checkOutDate);
    const cityName = String(input.city || '').trim();
    if (cityName.length < 2 || cityName.length > 80) throw new Error('Enter a valid city name for the hotel search.');
    // Hotel Search v3 expects hotel IDs sourced from a geographic Hotel List search.
    // Resolve the city to coordinates, then search hotels by geocode (not by IATA city code).
    const citySearch = await amadeusRequest(env, '/v1/reference-data/locations', {
      query: { subType: 'CITY', keyword: cityName.slice(0, 40), 'page[limit]': 10 }
    });
    const city = (citySearch.data || []).find(row => row.geoCode?.latitude && row.geoCode?.longitude);
    if (!city) throw new Error(`Amadeus could not resolve a city location for "${cityName}". Try a larger city or a different spelling.`);
    const hotelList = await amadeusRequest(env, '/v1/reference-data/locations/hotels/by-geocode', {
      query: {
        latitude: city.geoCode.latitude,
        longitude: city.geoCode.longitude,
        radius: boundedInteger(input.radius, 10, 1, 20, 'Hotel search radius'),
        radiusUnit: 'KM',
        hotelSource: 'ALL'
      }
    });
    const hotels = (hotelList.data || []).filter(h => h.hotelId).slice(0, 15);
    if (!hotels.length) return { data: [], resolvedCity: city, source: 'Amadeus production', retrievedAt: new Date().toISOString(), live: true };
    const offers = await amadeusRequest(env, '/v3/shopping/hotel-offers', {
      query: {
        hotelIds: hotels.map(h => h.hotelId).join(','),
        adults: boundedInteger(input.adults, 1, 1, 9, 'Adults'),
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        roomQuantity: 1,
        currency: input.currency || 'INR'
      }
    });
    return { ...offers, resolvedCity: city, source: 'Amadeus production · live hotel offers', retrievedAt: new Date().toISOString(), live: true, requestedBy: uid };
  }

  if (action === 'activities') {
    const latitude = Number(input.latitude), longitude = Number(input.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Choose a destination from the live city search first.');
    const radius = Math.min(20, Math.max(1, Number(input.radius || 5)));
    const result = await amadeusRequest(env, '/v1/shopping/activities', { query: { latitude, longitude, radius } });
    return { ...result, source: 'Amadeus production · live activity listings', retrievedAt: new Date().toISOString(), live: true, requestedBy: uid };
  }

  if (action === 'price-flight') {
    const offer = input.offer;
    if (!offer || typeof offer !== 'object' || Array.isArray(offer)) throw new Error('A flight offer is required for re-pricing.');
    const result = await amadeusRequest(env, '/v1/shopping/flight-offers/pricing', {
      method: 'POST',
      query: { include: 'detailed-fare-rules' },
      body: { data: { type: 'flight-offers-pricing', flightOffers: [offer] } }
    });
    return { ...result, source: 'Amadeus production · re-priced offer', retrievedAt: new Date().toISOString(), live: true, requestedBy: uid };
  }

  throw new Error('Unsupported travel search action.');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = String(env.APP_ORIGINS || env.APP_ORIGIN || 'http://localhost:8080')
      .split(',').map(value => value.trim()).filter(Boolean);
    const corsOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || 'http://localhost:8080');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': corsOrigin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'vary': 'Origin'
    }});
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, corsOrigin);
    if (origin && !allowedOrigins.includes(origin)) return json({ error: 'This website origin is not allowed by the travel API worker.' }, 403, corsOrigin);
    try {
      const uid = await verifyFirebaseIdToken(request, env.FIREBASE_PROJECT_ID);
      const input = await request.json();
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request body.');
      const result = await dispatch(env, input, uid);
      return json(result, 200, corsOrigin);
    } catch (error) {
      const status = error.status || (error.message?.includes('Sign in') ? 401 : error.message?.includes('not configured') ? 503 : 400);
      return json({ error: error.message || 'Travel provider request failed.', live: false }, status, corsOrigin);
    }
  }
};
