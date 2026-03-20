// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBevsB_4KIIOEV6OL57kH1wO-LzJqjULX8",
  authDomain: "field-force-mgmt.firebaseapp.com",
  projectId: "field-force-mgmt",
  storageBucket: "field-force-mgmt.firebasestorage.app",
  messagingSenderId: "396621193631",
  appId: "1:396621193631:web:f6bf1a0e79273cda469daa",
  measurementId: "G-3SBSWM600H"
};

// Initialize Firebase (Prevent multiple initializations in Next.js development)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize specific services
// Note: Analytics is only available in browser environments
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const cloudFunctions = getFunctions(app);

export { app, analytics, db, auth, storage, cloudFunctions };
