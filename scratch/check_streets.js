import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
const db = getFirestore(app);

async function run() {
  console.log("Conectando a Firestore...");
  const snap = await getDocs(collection(db, "habitantes"));
  console.log(`Total habitantes: ${snap.size}`);
  
  const streetsMap = {};
  snap.forEach(doc => {
    const data = doc.data();
    const street = data.calle || "SIN CALLE";
    const consejo = data.consejo || "SIN CONSEJO";
    const key = `${consejo} || ${street}`;
    streetsMap[key] = (streetsMap[key] || 0) + 1;
  });
  
  console.log("\nCalles y habitantes registrados:");
  console.log("================================");
  for (const [key, count] of Object.entries(streetsMap)) {
    console.log(`- ${key}: ${count} habitantes`);
  }
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
