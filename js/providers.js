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

/** Forecast for trip dates. Open-Meteo forecasts cover ~16 days; outside that we say so instead of guessing. */
export async function weatherForDates(latitude, longitude, startDate, endDate) {
  const today = new Date(); const iso = d => d.toISOString().slice(0, 10);
  const max = new Date(today); max.setUTCDate(max.getUTCDate() + 15);
  const inRange = startDate && startDate >= iso(today) && startDate <= iso(max);
  const url = new URL(WEATHER_URL);
  const params = { latitude: String(latitude), longitude: String(longitude), daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', timezone: 'auto' };
  if (inRange) { params.start_date = startDate; params.end_date = endDate && endDate <= iso(max) && endDate >= startDate ? endDate : iso(max); }
  else params.forecast_days = '7';
  url.search = new URLSearchParams(params).toString();
  const data = await fetchJson(url);
  return { ...data, matchesTripDates: !!inRange, source: 'Open-Meteo' };
}
export const WMO = c => ({0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm, hail',99:'Thunderstorm, hail'}[c] || 'Mixed conditions');
