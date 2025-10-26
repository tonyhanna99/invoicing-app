// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDcKjb8Pg9Jx3Jf6RHgoMXxjoglVMt8dMc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tetrias-tech.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tetrias-tech",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tetrias-tech.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "887716742400",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:887716742400:web:3f80769867a8f650825fe5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KZZJC1BTMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;
