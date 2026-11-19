import { cloudSave, cloudList, cloudDelete, firebaseStatus } from './firebase.js';

const PREFIX = 'wayfarer.v2.';
const LEGACY_PREFIX = 'wayfarer.v1.';
const COLLECTIONS = ['trips', 'tasks', 'conversations', 'notifications', 'wishlist', 'supportRequests', 'documents', 'profile'];
let currentUser = { uid: 'local-guest', displayName: 'Traveller', email: '', isGuest: true };

function storageKey(name) { return `${PREFIX}${currentUser.uid}.${name}`; }
function readLocal(name) {
  try { return JSON.parse(localStorage.getItem(storageKey(name)) || '[]'); }
  catch { return []; }
}
function writeLocal(name, value) { localStorage.setItem(storageKey(name), JSON.stringify(value)); }

/** Remove only the seeded/sample material from the previous prototype, never user-created records. */
export function purgeLegacyDemoRecords() {
  try {
    const trips = JSON.parse(localStorage.getItem(`${LEGACY_PREFIX}trips`) || '[]');
    const safeTrips = trips.filter(t => t.id !== 'trip-goa-demo' && !String(t.status || '').includes('demo') && !(t.bookings || []).some(b => String(b.status || '').includes('demo')));
    if (safeTrips.length !== trips.length) localStorage.setItem(`${LEGACY_PREFIX}trips`, JSON.stringify(safeTrips));
    for (const collection of ['tasks','notifications','wishlist','conversations']) {
      const key = `${LEGACY_PREFIX}${collection}`;
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      const safe = rows.filter(row => {
        const blob = JSON.stringify(row).toLowerCase();
        return !blob.includes('guest@wayfarer.demo') && !blob.includes('sample goa trip') && !blob.includes('trip-goa-demo') && !blob.includes('confirmed-demo') && !blob.includes('demo booking') && !blob.includes('built-in demo planner');
      });
      localStorage.setItem(key, JSON.stringify(safe));
    }
  } catch (error) { console.warn('Legacy sample-data cleanup skipped:', error); }
}

export function setCurrentUser(user) {
  currentUser = user
    ? { uid: user.uid, displayName: user.displayName || user.email?.split('@')[0] || 'Traveller', email: user.email || '', isGuest: false }
    : { uid: 'local-guest', displayName: 'Traveller', email: '', isGuest: true };
  try { localStorage.setItem(`${PREFIX}active-user`, JSON.stringify(currentUser)); } catch { /* storage may be disabled */ }
  return currentUser;
}
export function getCurrentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(`${PREFIX}active-user`) || 'null');
    if (stored && typeof stored.uid === 'string') currentUser = stored;
  } catch { /* keep current session */ }
  return currentUser;
}

export async function saveItem(collectionName, item) {
  if (!COLLECTIONS.includes(collectionName)) throw new Error('Unsupported collection.');
  const user = getCurrentUser();
  const rows = readLocal(collectionName);
  const index = rows.findIndex(x => x.id === item.id);
  const updated = { ...item, ownerUid: user.uid, updatedAt: new Date().toISOString() };
  if (index >= 0) rows[index] = updated; else rows.unshift(updated);
  writeLocal(collectionName, rows);
  if (!user.isGuest && firebaseStatus().enabled) await cloudSave(user.uid, collectionName, updated);
  return updated;
}
export async function listItems(collectionName) {
  if (!COLLECTIONS.includes(collectionName)) throw new Error('Unsupported collection.');
  const user = getCurrentUser();
  if (!user.isGuest && firebaseStatus().enabled) {
    try {
      const cloudRows = await cloudList(user.uid, collectionName);
      if (cloudRows) { writeLocal(collectionName, cloudRows); return cloudRows; }
    } catch (error) {
      // Offline or rules not deployed yet: fall back to this device's copy instead of breaking the page.
      console.warn(`Cloud read failed for ${collectionName}; using local copy.`, error.message);
    }
  }
  return readLocal(collectionName);
}
export async function deleteItem(collectionName, id) {
  if (!COLLECTIONS.includes(collectionName)) throw new Error('Unsupported collection.');
  writeLocal(collectionName, readLocal(collectionName).filter(x => x.id !== id));
  const user = getCurrentUser();
  if (!user.isGuest && firebaseStatus().enabled) await cloudDelete(user.uid, collectionName, id);
}
export async function saveProfile(profile) {
  const user = getCurrentUser();
  return saveItem('profile', { id: 'main', ...profile, email: profile.email || user.email });
}
export async function getProfile() {
  const rows = await listItems('profile');
  return rows.find(x => x.id === 'main') || { id: 'main', name: getCurrentUser().displayName, homeAirport: '', currency: 'INR', interests: [] };
}
