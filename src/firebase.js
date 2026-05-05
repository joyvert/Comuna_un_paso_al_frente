import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQXxDiXOsXniLwtuFjXPey_qrdYC7EwNk",
  authDomain: "comuna-un-paso-al-frente.firebaseapp.com",
  projectId: "comuna-un-paso-al-frente",
  storageBucket: "comuna-un-paso-al-frente.firebasestorage.app",
  messagingSenderId: "776529724786",
  appId: "1:776529724786:web:fb1ae6a61709eb636d09eb",
  measurementId: "G-X6XH1WYFC5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
