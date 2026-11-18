import { CONFIG } from './config.js';
import { getFirebaseIdToken } from './firebase.js';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const FX_URL = 'https://api.frankfurter.dev/v2/rate';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.reason || payload.error || payload.message || `Request failed (${response.status}).`);
  return payload;
}

async function travelRequest(action, params = {}) {
  const endpoint = CONFIG.travel?.apiEndpoint;
  if (!endpoint) throw new Error('Live flight, hotel and activity search is not configured yet. Deploy the travel API Worker and add its URL in js/config.js.');
  const token = await getFirebaseIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...params })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Travel provider request failed (${response.status}).`);
  if (payload.live !== true) throw new Error('The provider did not confirm this as live data. Results were not shown.');
  return payload;
}

export async function searchRealDestinations(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const url = new URL(GEO_URL);
  url.search = new URLSearchParams({ name: term, count: '15', language: 'en', format: 'json' }).toString();
  const result = await fetchJson(url);
  return (result.results || []).map(place => ({
    id: `geo-${place.id}`,
    name: place.name,
    country: place.country || '',
    admin1: place.admin1 || '',
    latitude: place.latitude,
    longitude: place.longitude,
    population: place.population ?? null,
    timezone: place.timezone || '',
    source: 'Open-Meteo Geocoding',
    retrievedAt: new Date().toISOString(),
    live: true
  }));
}

async function geocodeOne(placeName) {
  const rows = await searchRealDestinations(placeName);
  if (!rows.length) throw new Error(`No live city match found for "${placeName}". Try a city name.`);
  return rows[0];
}

function isoDuration(value = '') {
  const m = String(value).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? `${m[1] || 0}h ${m[2] || 0}m` : value || 'Duration not provided';
}

function mapFlightOffer(offer, dictionaries = {}, source = 'Amadeus production') {
  const itinerary = offer.itineraries?.[0];
  const segments = itinerary?.segments || [];
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || {};
  const codes = [...new Set(segments.map(s => s.carrierCode).filter(Boolean))];
  return {
    id: offer.id,
    airline: codes.map(code => dictionaries.carriers?.[code] || code).join(' · ') || 'Airline details unavailable',
    carrierCodes: codes,
    route: `${first.departure?.iataCode || '—'} → ${last.arrival?.iataCode || '—'}`,
    depart: first.departure?.at || '',
    arrive: last.arrival?.at || '',
    duration: isoDuration(itinerary?.duration),
    stops: `${Math.max(0, segments.length - 1)} stop${segments.length === 2 ? '' : 's'}`,
    price: Number(offer.price?.grandTotal || offer.price?.total || 0),
    currency: offer.price?.currency || 'EUR',
    source,
    live: true,
    raw: offer
  };
}

export const TravelProvider = {
  mode: 'LIVE PROVIDERS ONLY',
  searchDestinations: searchRealDestinations,
  async searchFlights(params) {
    if (!params) return [];
    const result = await travelRequest('flights', params);
    return (result.data || []).map(offer => mapFlightOffer(offer, result.dictionaries || {}, result.source));
  },
  async searchHotels(params) {
    if (!params) return [];
    const result = await travelRequest('hotels', params);
    return (result.data || []).flatMap(row => (row.offers || []).map(offer => ({
      id: `${row.hotel?.hotelId || row.hotel?.name}-${offer.id}`,
      hotelId: row.hotel?.hotelId || '',
      name: row.hotel?.name || 'Hotel name not provided',
      area: [row.hotel?.address?.cityName, row.hotel?.address?.countryCode].filter(Boolean).join(', '),
      rating: row.hotel?.rating || null,
      type: offer.room?.typeEstimated?.category || offer.room?.type || 'Room details from supplier',
      perk: offer.room?.description?.text || offer.policies?.cancellation?.description?.text || 'See supplier offer details',
      price: Number(offer.price?.total || 0),
      currency: offer.price?.currency || 'EUR',
      checkInDate: row.hotel?.checkInDate,
      checkOutDate: row.hotel?.checkOutDate,
      source: result.source,
      live: true,
      raw: { hotel: row.hotel, offer }
    })));
  },
  async searchActivities(params) {
    if (!params) return [];
    const location = params.latitude !== undefined && params.longitude !== undefined
      ? params
      : await geocodeOne(params.city || '');
    const result = await travelRequest('activities', { latitude: location.latitude, longitude: location.longitude, radius: params.radius || 5 });
    return (result.data || []).map(item => ({
      id: item.id,
      name: item.name,
      category: 'Activity',
      duration: item.minimumDuration || 'Duration not provided by provider',
      price: Number(item.price?.amount || 0),
      currency: item.price?.currencyCode || '',
      rating: item.rating ? Number(item.rating) : null,
      description: item.shortDescription || item.description || '',
      image: item.pictures?.[0] || '',
      bookingLink: item.bookingLink || '',
      latitude: Number(item.geoCode?.latitude),
      longitude: Number(item.geoCode?.longitude),
      source: result.source,
      live: true,
      raw: item
    }));
  },
  async validatePrice(item) {
    if (item?.raw && item.raw.itineraries) {
      const result = await travelRequest('price-flight', { offer: item.raw });
      const priced = result.data?.flightOffers?.[0];
      return { valid: !!priced, source: result.source, retrievedAt: result.retrievedAt, price: Number(priced?.price?.grandTotal || priced?.price?.total || 0), currency: priced?.price?.currency || item.currency, raw: priced };
    }
    throw new Error('This provider does not support re-pricing for this item. Check the supplier offer again before booking.');
  },
  async weather(latitude, longitude) {
    const url = new URL(WEATHER_URL);
    url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', forecast_days: '7', timezone: 'auto' }).toString();
    return { ...(await fetchJson(url)), source: 'Open-Meteo', attribution: 'Weather data by Open-Meteo.com' };
  },
  async exchangeRate(base, quote) {
    if (!/^[A-Z]{3}$/i.test(base) || !/^[A-Z]{3}$/i.test(quote)) throw new Error('Enter valid three-letter currency codes.');
    const url = `${FX_URL}/${encodeURIComponent(base.toUpperCase())}/${encodeURIComponent(quote.toUpperCase())}`;
    const result = await fetchJson(url);
    return { ...result, source: 'Frankfurter reference rates', rateType: 'Reference rate, not a real-time card or cash quote' };
  }
};
