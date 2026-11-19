// Browser-safe defaults only. Firebase's public Web App configuration is
// loaded from /api/firebase-config at runtime on Vercel. Never add server secrets here.
export const CONFIG = {
  appName: 'WAYFARER AI',
  firebase: {
  apiKey: "AIzaSyCCv5TPO8d4QmrDlKFdYC1_Qhhpt21lUuE",
  authDomain: "wayfarer-4006a.firebaseapp.com",
  projectId: "wayfarer-4006a",
  storageBucket: "wayfarer-4006a.firebasestorage.app",
  messagingSenderId: "710294294480",
  appId: "1:710294294480:web:6b23991b9ab497691bf3d5",
  measurementId: "G-7PMJFT2WHT"
  },
  agent37: {
    // The actual Cloud API credentials are read only by /api/agent37 on the server.
    cloudEnabled: true
  },
  storage: {
    // Optional advanced setup only. Leave blank for the beginner/free setup.
    signingEndpoint: '',
    bucket: '',
    supabaseUrl: '',
    anonKey: ''
  },
  currency: 'INR',
  locale: 'en-IN'
};
