import { cloudSave, cloudList, cloudDelete, firebaseStatus } from './firebase.js';

const PREFIX = 'wayfarer.v1.';
const COLLECTIONS = ['trips', 'tasks', 'conversations', 'notifications', 'wishlist', 'supportRequests', 'documents', 'profile'];
let currentUser = { uid: 'demo-user', displayName: 'Guest Traveller', email: 'guest@wayfarer.demo', isDemo: true };

function readLocal(name) {
  try { return JSON.parse(localStorage.getItem(PREFIX + name) || '[]'); }
  catch { return []; }
}
function writeLocal(name, value) {
  localStorage.setItem(PREFIX + name, JSON.stringify(value));
}
export function setCurrentUser(user) {
  currentUser = user ? { uid: user.uid, displayName: user.displayName || user.email?.split('@')[0] || 'Traveller', email: user.email || '', isDemo: false } : { uid: 'demo-user', displayName: 'Guest Traveller', email: 'guest@wayfarer.demo', isDemo: true };
  localStorage.setItem(PREFIX + 'user', JSON.stringify(currentUser));
  return currentUser;
}
export function getCurrentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFIX + 'user') || 'null');
    if (stored) currentUser = stored;
  } catch { /* keep current session */ }
  return currentUser;
}
export async function saveItem(collectionName, item) {
  if (!COLLECTIONS.includes(collectionName)) throw new Error('Unsupported collection.');
  const rows = readLocal(collectionName);
  const index = rows.findIndex(x => x.id === item.id);
  const updated = { ...item, updatedAt: new Date().toISOString() };
  if (index >= 0) rows[index] = updated; else rows.unshift(updated);
  writeLocal(collectionName, rows);
  const user = getCurrentUser();
  if (!user.isDemo && firebaseStatus().enabled) {
    try { await cloudSave(user.uid, collectionName, updated); }
    catch (error) { console.warn('Cloud save failed; local copy retained.', error); }
  }
  return updated;
}
export async function listItems(collectionName) {
  if (!COLLECTIONS.includes(collectionName)) throw new Error('Unsupported collection.');
  const user = getCurrentUser();
  if (!user.isDemo && firebaseStatus().enabled) {
    try {
      const cloudRows = await cloudList(user.uid, collectionName);
      if (cloudRows) {
        writeLocal(collectionName, cloudRows);
        return cloudRows;
      }
    } catch (error) { console.warn('Cloud read failed; showing local cache.', error); }
  }
  return readLocal(collectionName);
}
export async function deleteItem(collectionName, id) {
  const rows = readLocal(collectionName).filter(x => x.id !== id);
  writeLocal(collectionName, rows);
  const user = getCurrentUser();
  if (!user.isDemo && firebaseStatus().enabled) {
    try { await cloudDelete(user.uid, collectionName, id); } catch (error) { console.warn(error); }
  }
}
export async function saveProfile(profile) {
  const user = getCurrentUser();
  const item = { id: 'main', ...profile, email: profile.email || user.email };
  await saveItem('profile', item);
  return item;
}
export async function getProfile() {
  const rows = await listItems('profile');
  return rows.find(x => x.id === 'main') || { id: 'main', name: getCurrentUser().displayName, homeAirport: 'Delhi (DEL)', currency: 'INR', interests: ['Culture', 'Food', 'Nature'] };
}
export function seedDemoData() {
  if (readLocal('trips').length) return;
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() + 24);
  const end = new Date(start); end.setDate(end.getDate() + 5);
  const iso = d => d.toISOString().slice(0, 10);
  writeLocal('trips', [{
    id: 'trip-goa-demo', title: 'Slow days in Goa', destination: 'Goa, India', origin: 'Delhi, India', startDate: iso(start), endDate: iso(end), travellers: 2, budget: 40000, estimatedCost: 36750, status: 'upcoming',
    interests: ['Beaches', 'Food', 'Nature'], cover: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=85',
    days: [
      { day: 1, date: iso(start), morning: 'Arrive and check in', afternoon: 'Explore Fontainhas', evening: 'Dinner by the waterfront', cost: 5200 },
      { day: 2, date: iso(new Date(start.getTime()+86400000)), morning: 'Palolem Beach', afternoon: 'Kayaking experience', evening: 'Sunset and local seafood', cost: 6800 },
      { day: 3, date: iso(new Date(start.getTime()+2*86400000)), morning: 'Spice plantation', afternoon: 'Old Goa heritage walk', evening: 'Night market', cost: 4900 }
    ], bookings: [{ id: 'bk-demo-1', type: 'hotel', name: 'Casa Solana (Demo Stay)', reference: 'WAY-GOA-2048', status: 'confirmed-demo', amount: 15800, checkIn: iso(start), checkOut: iso(end), policy: 'Demo booking: free cancellation until 48 hours before check-in.' }], createdAt: new Date().toISOString()
  }]);
  writeLocal('tasks', []);
  writeLocal('conversations', []);
  writeLocal('notifications', [{ id: 'notice-welcome', title: 'Welcome to WAYFARER AI', body: 'Your sample Goa trip is ready to explore. All reservation data is labelled demo.', type: 'info', createdAt: new Date().toISOString(), read: false }]);
  writeLocal('wishlist', []);
  writeLocal('supportRequests', []);
  writeLocal('documents', []);
}
