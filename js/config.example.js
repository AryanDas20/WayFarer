// Browser-safe defaults only. Firebase's public Web App configuration is
// loaded from /api/firebase-config at runtime on Vercel. Never add server secrets here.
export const CONFIG = {
  appName: 'WAYFARER AI',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
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
