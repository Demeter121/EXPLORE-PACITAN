import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup as fbSignInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";

import firebaseConfig from "../../firebase-applet-config.json";

export interface FirebaseConfigType {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const configObj = (firebaseConfig as any) || {};

const cleanEnvVar = (val: any): string => {
  if (typeof val !== "string") return "";
  let s = val.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.substring(1, s.length - 1);
  }
  if (s.startsWith("'") && s.endsWith("'")) {
    s = s.substring(1, s.length - 1);
  }
  return s.trim();
};

const getEnvOrFallback = (envName: string, fallback: string): string => {
  const envVal = cleanEnvVar((import.meta as any).env?.[envName]);
  return envVal || fallback;
};

const DEFAULT_FIREBASE_CONFIG: FirebaseConfigType = {
  apiKey: getEnvOrFallback("VITE_FIREBASE_API_KEY", configObj.apiKey || "AIzaSyD6QuJJ5RMbClgqzZVkagSALeZhkfWpBaw"),
  authDomain: getEnvOrFallback("VITE_FIREBASE_AUTH_DOMAIN", configObj.authDomain || "sisteminformasipariwisatapct.firebaseapp.com"),
  projectId: getEnvOrFallback("VITE_FIREBASE_PROJECT_ID", configObj.projectId || "sisteminformasipariwisatapct"),
  storageBucket: getEnvOrFallback("VITE_FIREBASE_STORAGE_BUCKET", configObj.storageBucket || "sisteminformasipariwisatapct.firebasestorage.app"),
  messagingSenderId: getEnvOrFallback("VITE_FIREBASE_MESSAGING_SENDER_ID", configObj.messagingSenderId || "17617438203"),
  appId: getEnvOrFallback("VITE_FIREBASE_APP_ID", configObj.appId || "1:17617438203:web:f184358361423abd2ef75e"),
  measurementId: getEnvOrFallback("VITE_FIREBASE_MEASUREMENT_ID", configObj.measurementId || "G-G5KC7Z1VHQ")
};

const databaseId = configObj.firestoreDatabaseId || "(default)";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let analytics: Analytics | null = null;

export const getActiveFirebaseConfig = (): FirebaseConfigType => {
  try {
    const custom = localStorage.getItem("sipp_custom_firebase_config");
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && parsed.apiKey && parsed.apiKey.startsWith("AIza")) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to read custom firebase config from localStorage", e);
  }
  return DEFAULT_FIREBASE_CONFIG;
};

export const isValidApiKey = (key: string): boolean => {
  return typeof key === "string" && 
    key.length > 10 && 
    !key.includes("PLEASE_REPLACE") && 
    key.startsWith("AIza");
};

export const initFirebaseConnector = (customCfg?: FirebaseConfigType) => {
  const cfg = customCfg || getActiveFirebaseConfig();
  if (!isValidApiKey(cfg.apiKey)) {
    console.warn("Firebase API Key is missing or default. Firebase auth & firestore running in safe fallback mode.");
    app = null;
    auth = null;
    db = null;
    googleProvider = null;
    return false;
  }

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      const existingApp = existingApps[0];
      const existingOpts = existingApp.options as any;
      if (existingOpts && existingOpts.apiKey === cfg.apiKey && existingOpts.projectId === cfg.projectId) {
        app = existingApp;
      } else {
        try {
          deleteApp(existingApp);
        } catch (e) {
          console.warn("Could not delete old Firebase app instance:", e);
        }
        app = initializeApp(cfg);
      }
    } else {
      app = initializeApp(cfg);
    }
    
    auth = getAuth(app);
    try {
      db = getFirestore(app);
    } catch {
      try {
        db = getFirestore(app, databaseId);
      } catch {
        db = null;
      }
    }
    
    googleProvider = new GoogleAuthProvider();
    
    // Safely initialize analytics in supported client environments
    // Note: Disabled by default because the API key is restricted to Auth & Firestore.
    // Initializing getAnalytics(app) triggers background Installations API calls that return 400 INVALID_ARGUMENT.
    /*
    if (typeof window !== "undefined") {
      isSupported().then((supported) => {
        if (supported && app) {
          analytics = getAnalytics(app);
        }
      }).catch((e) => {
        console.warn("Analytics not supported in this environment:", e);
      });
    }
    */

    return true;
  } catch (err) {
    console.warn("Firebase Initialization Error handled safely:", err);
    app = null;
    auth = null;
    db = null;
    googleProvider = null;
    return false;
  }
};

// Auto initialize on module load
initFirebaseConnector();

export const saveCustomFirebaseConfig = (newConfig: FirebaseConfigType) => {
  try {
    localStorage.setItem("sipp_custom_firebase_config", JSON.stringify(newConfig));
    initFirebaseConnector(newConfig);
    return true;
  } catch (err) {
    console.error("Failed to save custom Firebase config", err);
    return false;
  }
};

export const resetCustomFirebaseConfig = () => {
  try {
    localStorage.removeItem("sipp_custom_firebase_config");
    initFirebaseConnector(DEFAULT_FIREBASE_CONFIG);
  } catch (err) {
    console.error("Failed to reset Firebase config", err);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Do not throw on background list/get operations (subscriptions/readers)
  // as they are safely handled and fall back to local/default states
  if (operationType !== OperationType.LIST && operationType !== OperationType.GET) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Safe wrapper for Google Sign In
const signInWithGooglePopup = async (_authObj?: any, _providerObj?: any) => {
  let activeAuth = _authObj || auth;
  let activeProvider = _providerObj || googleProvider;

  if (!activeAuth || !activeProvider) {
    initFirebaseConnector();
    activeAuth = auth;
    activeProvider = googleProvider;
  }

  if (!activeAuth || !activeProvider) {
    const err = new Error("Firebase Auth tidak tersedia");
    (err as any).code = "auth/auth-not-available";
    throw err;
  }

  try {
    return await fbSignInWithPopup(activeAuth, activeProvider);
  } catch (err: any) {
    if (err?.code === "auth/popup-closed-by-user") {
      const customErr = new Error("Jendela login Google ditutup sebelum selesai.");
      (customErr as any).code = "auth/popup-closed-by-user";
      throw customErr;
    }
    throw err;
  }
};

export const getFirebaseAuth = (): Auth | null => {
  if (!auth) {
    initFirebaseConnector();
  }
  return auth;
};

export const getGoogleProvider = (): GoogleAuthProvider | null => {
  if (!googleProvider) {
    initFirebaseConnector();
  }
  return googleProvider;
};

// Safe wrapper for Sign Out
const safeSignOut = async (_authObj?: any) => {
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Firebase sign out warning:", e);
    }
  }
};

// Safe listener for auth state
const safeOnAuthStateChanged = (
  firstArg: any,
  secondArg?: any
) => {
  const callback = typeof firstArg === "function" ? firstArg : secondArg;
  if (!auth || typeof callback !== "function") {
    if (typeof callback === "function") callback(null);
    return () => {};
  }
  try {
    return fbOnAuthStateChanged(auth, callback, (error) => {
      console.warn("Firebase auth listener error handled:", error.message);
      callback(null);
    });
  } catch (err) {
    console.warn("Firebase auth state listener exception:", err);
    callback(null);
    return () => {};
  }
};

// Connection test function as specified by Firebase integration skill
export async function testConnection() {
  if (!db) return false;
  try {
    const { doc, getDocFromServer } = await import("firebase/firestore");
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection test successful.");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    } else {
      console.info("Firestore connection check status:", error);
    }
    return false;
  }
}

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  analytics,
  signInWithGooglePopup as signInWithPopup, 
  safeSignOut as signOut, 
  safeOnAuthStateChanged as onAuthStateChanged 
};
export type { FirebaseUser };


