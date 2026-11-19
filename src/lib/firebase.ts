import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  buildFirebaseConfig,
  FirebaseEnvValues,
  isFirebaseEnvComplete,
} from './firebaseConfig';

const rawEnv: FirebaseEnvValues = {
  VITE_FIREBASE_API_KEY:
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FIREBASE_API_KEY
      : '',
  VITE_FIREBASE_AUTH_DOMAIN:
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
      : '',
  VITE_FIREBASE_PROJECT_ID:
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FIREBASE_PROJECT_ID
      : '',
  VITE_FIREBASE_MESSAGING_SENDER_ID:
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
      : '',
  VITE_FIREBASE_APP_ID:
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_FIREBASE_APP_ID
      : '',
};

export function isFirebaseConfigured(): boolean {
  return isFirebaseEnvComplete(rawEnv);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (isFirebaseConfigured()) {
    const firebaseConfig = buildFirebaseConfig(rawEnv);
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (err) {
  console.warn('Firebase initialization error:', err);
}

export { app, auth, db };
