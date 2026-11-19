const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const FX_URL = 'https://api.frankfurter.dev/v2/rate';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.reason || payload.error || payload.message || `Request failed (${response.status}).`);
  return payload;
}

export async function searchRealDestinations(query) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const url = new URL(GEO_URL);
  url.search = new URLSearchParams({ name: term, count: '15', language: 'en', format: 'json' }).toString();
  const result = await fetchJson(url);
  return (result.results || []).map(place => ({
    id: `geo-${place.id}`, name: place.name, country: place.country || '', admin1: place.admin1 || '',
    latitude: place.latitude, longitude: place.longitude, population: place.population ?? null,
    timezone: place.timezone || '', source: 'Open-Meteo Geocoding', retrievedAt: new Date().toISOString(), live: true
  }));
}

export const TravelProvider = {
  mode: 'PUBLIC LIVE DATA + EXTERNAL TRAVEL SEARCH',
  searchDestinations: searchRealDestinations,
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
