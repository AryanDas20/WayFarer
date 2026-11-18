// All results in this provider are deliberately simulated and labelled DEMO.
const flights = [
  { id: 'fl-1', airline: 'IndiGo', route: 'Delhi → Goa', depart: '06:15', arrive: '08:50', duration: '2h 35m', stops: 'Non-stop', price: 5890, tag: 'Best budget' },
  { id: 'fl-2', airline: 'Air India', route: 'Delhi → Goa', depart: '10:20', arrive: '13:05', duration: '2h 45m', stops: 'Non-stop', price: 7240, tag: 'Comfort pick' },
  { id: 'fl-3', airline: 'Akasa Air', route: 'Delhi → Goa', depart: '14:10', arrive: '18:25', duration: '4h 15m', stops: '1 stop', price: 4980, tag: 'Lowest fare' }
];
const hotels = [
  { id: 'ht-1', name: 'Casa Solana', area: 'Candolim, Goa', rating: 4.7, price: 4200, type: 'Boutique stay', perk: 'Quiet courtyard · Breakfast' },
  { id: 'ht-2', name: 'The Palm House', area: 'Anjuna, Goa', rating: 4.6, price: 3600, type: 'Design hotel', perk: 'Pool · Walkable cafés' },
  { id: 'ht-3', name: 'Serein Beach Resort', area: 'Palolem, Goa', rating: 4.8, price: 5900, type: 'Beach resort', perk: 'Beach access · Garden' }
];
const activities = [
  { id: 'ac-1', name: 'Old Goa heritage walk', category: 'Culture', duration: '2.5 hours', price: 850 },
  { id: 'ac-2', name: 'Palolem kayak at sunrise', category: 'Adventure', duration: '90 minutes', price: 1200 },
  { id: 'ac-3', name: 'Spice farm and Goan lunch', category: 'Food & nature', duration: '4 hours', price: 1650 },
  { id: 'ac-4', name: 'Fontainhas photo walk', category: 'Culture', duration: '2 hours', price: 700 }
];
const destinations = [
  { id: 'goa', name: 'Goa', country: 'India', tag: 'Coast & slow living', budget: '₹25k–₹45k', season: 'Nov–Feb', score: 97, days: '4–6 days', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1000&q=85', reason: 'A strong match for beaches, food and relaxed nature experiences.' },
  { id: 'jaipur', name: 'Jaipur', country: 'India', tag: 'Culture & colour', budget: '₹12k–₹25k', season: 'Oct–Mar', score: 94, days: '2–4 days', image: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=1000&q=85', reason: 'Excellent for architecture, markets, history and photography.' },
  { id: 'sikkim', name: 'Sikkim', country: 'India', tag: 'Mountains & nature', budget: '₹22k–₹40k', season: 'Mar–May', score: 92, days: '5–7 days', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1000&q=85', reason: 'A good fit for scenic landscapes, slower travel and outdoor discovery.' },
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', tag: 'Heritage & gardens', budget: '₹85k–₹1.4L', season: 'Mar–May / Oct–Nov', score: 91, days: '4–5 days', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1000&q=85', reason: 'A memorable mix of temples, food culture, gardens and quiet streets.' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', tag: 'Wellness & island life', budget: '₹55k–₹95k', season: 'Apr–Oct', score: 89, days: '6–8 days', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1000&q=85', reason: 'Pairs island landscapes with food, culture and restorative stays.' },
  { id: 'istanbul', name: 'Istanbul', country: 'Türkiye', tag: 'Food & history', budget: '₹65k–₹1.1L', season: 'Apr–May / Sep–Oct', score: 87, days: '4–6 days', image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1000&q=85', reason: 'Ideal for travellers who enjoy layered history, markets and cuisine.' }
];
export const TravelProvider = {
  mode: 'SIMULATED DEMO DATA',
  searchFlights: async () => flights.map(x => ({ ...x, source: 'DEMO' })),
  searchHotels: async () => hotels.map(x => ({ ...x, source: 'DEMO' })),
  searchActivities: async () => activities.map(x => ({ ...x, source: 'DEMO' })),
  searchDestinations: async (query = '') => destinations.filter(x => `${x.name} ${x.country} ${x.tag}`.toLowerCase().includes(query.toLowerCase())).map(x => ({ ...x, source: 'DEMO' })),
  validatePrice: async item => ({ valid: true, source: 'DEMO', checkedAt: new Date().toISOString(), price: item.price, message: 'Demo price checked against the local sample catalogue. This is not live inventory.' })
};
export const DEMO_IMAGES = destinations;
