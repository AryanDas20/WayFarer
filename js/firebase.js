import { CONFIG } from './config.js';

let app = null;
let auth = null;
let db = null;
let modules = null;

const configured = () => {
  const f = CONFIG.firebase || {};
  return !!(f.apiKey && !f.apiKey.startsWith('YOUR_') && f.projectId && !f.projectId.startsWith('YOUR_'));
};

export async function initFirebase() {
  if (!configured()) return { enabled: false, reason: 'Firebase credentials are not configured.' };
  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    modules = { ...authMod, ...fsMod };
    app = appMod.initializeApp(CONFIG.firebase);
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
  if (!auth || !modules) throw new Error('Firebase is not configured. Add your Firebase web app settings in js/config.js first.');
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
