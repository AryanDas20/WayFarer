import { CONFIG } from './config.js';

let app = null;
let auth = null;
let db = null;
let modules = null;
let firebaseConfigPromise = null;

async function loadFirebaseConfig() {
  if (!firebaseConfigPromise) {
    firebaseConfigPromise = (async () => {
      try {
        const response = await fetch('/api/firebase-config', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Firebase config endpoint returned ${response.status}.`);
        const payload = await response.json();
        if (payload?.configured && payload.firebase) Object.assign(CONFIG.firebase, payload.firebase);
      } catch (error) {
        // Local static preview can still use values placed in the browser-safe config.js.
        console.info('Using local Firebase config fallback:', error.message);
      }
      return CONFIG.firebase;
    })();
  }
  return firebaseConfigPromise;
}

const configured = f => !!(f?.apiKey && f?.projectId && f?.authDomain && f?.appId);

export async function initFirebase() {
  const firebaseConfig = await loadFirebaseConfig();
  if (!configured(firebaseConfig)) return { enabled: false, reason: 'Firebase configuration is missing. Check the six FIREBASE_* variables in Vercel and redeploy.' };
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    modules = { ...authMod, ...fsMod };
    app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = fsMod.getFirestore(app);
    return { enabled: true, auth, db };
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return { enabled: false, reason: error.message };
  }
}

export function firebaseStatus() { return { enabled: !!(auth && db), auth, db, modules }; }

export async function getFirebaseIdToken() {
  if (!auth?.currentUser) throw new Error('Sign in with your WAYFARER account to use this private feature.');
  return auth.currentUser.getIdToken();
}

export async function signInEmail(email, password) {
  if (!auth || !modules) throw new Error('Firebase is not configured. Check the FIREBASE_* environment variables and redeploy.');
  return modules.signInWithEmailAndPassword(auth, email, password);
}
export async function signUpEmail(email, password) {
  if (!auth || !modules) throw new Error('Firebase is not configured.');
  return modules.createUserWithEmailAndPassword(auth, email, password);
}
export async function signInGoogle() {
  if (!auth || !modules) throw new Error('Firebase is not configured.');
  const provider = new modules.GoogleAuthProvider();
  return modules.signInWithPopup(auth, provider);
}
export async function signOutFirebase() {
  if (auth) await modules.signOut(auth);
}
export function onAuthChange(callback) {
  if (!auth || !modules) return () => {};
  return modules.onAuthStateChanged(auth, callback);
}

export async function cloudSave(uid, collectionName, item) {
  if (!db || !modules || !uid) return false;
  const ref = modules.doc(db, 'users', uid, collectionName, String(item.id));
  await modules.setDoc(ref, { ...item, updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}
export async function cloudList(uid, collectionName) {
  if (!db || !modules || !uid) return null;
  const ref = modules.collection(db, 'users', uid, collectionName);
  const snap = await modules.getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function cloudDelete(uid, collectionName, id) {
  if (!db || !modules || !uid) return false;
  await modules.deleteDoc(modules.doc(db, 'users', uid, collectionName, String(id)));
  return true;
}
