// Copy this file to config.js and add your own project settings.
// Never place private keys in browser configuration.
export const CONFIG = {
  appName: 'WAYFARER AI',
  demoMode: true,
  firebase: {
    apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    appId: 'YOUR_FIREBASE_APP_ID'
  },
  // Agent37 Personal does not expose a website API merely from an instance ID.
  // Configure bridgeUrl only when you have a documented, secure bridge you control.
  // The bridge must implement POST /chat and return { reply, actions? }.
  agent37: {
    enabled: false,
    instanceId: '',
    bridgeUrl: ''
  },
  // Supabase is used only for files. Use a Firebase-authenticated server endpoint
  // that verifies the Firebase ID token and returns signed storage URLs.
  storage: {
    signingEndpoint: '',
    bucket: '',
    supabaseUrl: '',
    anonKey: ''
  },
  currency: 'INR',
  locale: 'en-IN'
};
