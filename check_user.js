import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQXxDiXOsXniLwtuFjXPey_qrdYC7EwNk",
  authDomain: "comuna-un-paso-al-frente.firebaseapp.com",
  projectId: "comuna-un-paso-al-frente",
  storageBucket: "comuna-un-paso-al-frente.firebasestorage.app",
  messagingSenderId: "776529724786",
  appId: "1:776529724786:web:fb1ae6a61709eb636d09eb",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    console.log("Fetching user doc for joyvert.albero23@gmail.com...");
    const userDoc = await getDoc(doc(db, "usuarios", "joyvert.albero23@gmail.com"));
    if (userDoc.exists()) {
      console.log("User doc found:", userDoc.data());
    } else {
      console.log("User doc NOT found!");
      console.log("Attempting to list users...");
      const snap = await getDocs(collection(db, "usuarios"));
      console.log("Users found in collection:", snap.size);
      snap.forEach(d => console.log(d.id, d.data()));
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

check();
