const admin = require('firebase-admin');

let firebaseApp = null;
let initialized = false;
let warnedMissingCredentials = false;

const warnMissingCredentials = () => {
  if (warnedMissingCredentials) return;
  warnedMissingCredentials = true;
  console.warn(
    'Firebase Admin credentials are not configured. Chat push notifications will be skipped.'
  );
};

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Chat push notifications will be skipped.');
    return null;
  }
};

const hasApplicationDefaultCredentials = () =>
  Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_CONFIG
  );

const initializeFirebaseApp = () => {
  if (initialized) return firebaseApp;
  initialized = true;

  if (admin.apps.length) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  const serviceAccount = parseServiceAccount();

  try {
    if (serviceAccount) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return firebaseApp;
    }

    if (hasApplicationDefaultCredentials()) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      return firebaseApp;
    }

    warnMissingCredentials();
    return null;
  } catch (error) {
    console.warn('Failed to initialize Firebase Admin. Chat push notifications will be skipped.', error.message);
    firebaseApp = null;
    return null;
  }
};

const getMessaging = () => {
  const app = initializeFirebaseApp();
  if (!app) return null;

  try {
    return admin.messaging(app);
  } catch (error) {
    console.warn('Failed to create Firebase Messaging client. Chat push notifications will be skipped.', error.message);
    return null;
  }
};

module.exports = {
  getMessaging,
  initializeFirebaseApp,
};
