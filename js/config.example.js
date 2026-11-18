// Copy this file to js/config.js. Never put Amadeus secrets or other private keys here.
export const CONFIG = {
  appName: 'WAYFARER AI',
  firebase: {
    apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    appId: 'YOUR_FIREBASE_WEB_APP_ID'
  },
  travel: {
    // Public URL of the Cloudflare Worker after deployment. No API secret belongs here.
    apiEndpoint: ''
  },
  agent37: {
    // Set only after Agent37 provides a documented Personal integration method.
    enabled: false,
    instanceId: '',
    bridgeUrl: ''
  },
  storage: {
    signingEndpoint: '',
    bucket: '',
    supabaseUrl: '',
    anonKey: ''
  },
  currency: 'INR',
  locale: 'en-IN'
};
