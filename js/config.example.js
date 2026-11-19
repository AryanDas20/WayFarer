// Public browser configuration. Firebase Web App config is not a private key.
// Replace the YOUR_* values with the settings from Firebase Console > Project settings > Your apps.
// NEVER place service-account JSON, private keys, or server secrets in this file.
export const CONFIG = {
  appName: 'WAYFARER AI',
  firebase: {
    apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    appId: 'YOUR_FIREBASE_WEB_APP_ID'
  },
  agent37: {
    // Keep disabled until Agent37 documents a supported Personal-to-website connection.
    enabled: false,
    instanceId: '',
    bridgeUrl: ''
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
