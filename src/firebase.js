// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcKjb8Pg9Jx3Jf6RHgoMXxjoglVMt8dMc",
  authDomain: "tetrias-tech.firebaseapp.com",
  projectId: "tetrias-tech",
  storageBucket: "tetrias-tech.firebasestorage.app",
  messagingSenderId: "887716742400",
  appId: "1:887716742400:web:3f80769867a8f650825fe5",
  measurementId: "G-KZZJC1BTMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;
