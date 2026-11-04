import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function text(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readConfig(): FirebasePublicConfig | null {
  const config = {
    apiKey: text(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: text(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: text(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: text(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: text(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: text(import.meta.env.VITE_FIREBASE_APP_ID),
  };
  if (Object.values(config).some((value) => value.length === 0)) return null;
  return config;
}

export const firebaseConfig = readConfig();
export const isFirebaseConfigured = firebaseConfig !== null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

function openFirestore(firebaseApp: FirebaseApp): Firestore {
  if (typeof indexedDB === 'undefined') return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn('Firestore persistent cache is unavailable. Using memory cache.', error);
    try {
      return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
    } catch {
      return getFirestore(firebaseApp);
    }
  }
}

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = openFirestore(app);
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured.');
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!firestore) throw new Error('Firebase is not configured.');
  return firestore;
}
