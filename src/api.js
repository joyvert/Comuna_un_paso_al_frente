import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, orderBy } from "firebase/firestore";

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
const auth = getAuth(app);
const db = getFirestore(app);

// Secondary app trick to prevent admin from being logged out when creating voceros
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const DOMAIN = "@comunapasofrente.com";
const getEmail = (userId) => userId.includes('@') ? userId : `${userId}${DOMAIN}`;

function getSession() {
  try { return JSON.parse(sessionStorage.getItem("comuna_session_v1") || "{}"); } 
  catch { return {}; }
}
function setSession(data) {
  sessionStorage.setItem("comuna_session_v1", JSON.stringify(data));
}

const okRes = (data = {}) => ({ ok: true, ...data });
const errRes = (message) => {
  const err = new Error(message);
  err.ok = false;
  throw err;
};

// --- Migrated Firebase API ---
export const api = {
  health: async () => okRes({ message: "Firebase operativo" }),
  initDb: async () => okRes(), // Noop en Firebase

  login: async ({ userId, passwordHash }) => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, getEmail(userId), passwordHash);
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (!userDoc.exists()) return errRes("Usuario no encontrado en la base de datos.");
      const data = userDoc.data();
      
      const sessionData = {
        accessToken: await userCred.user.getIdToken(),
        id: userId,
        userId,
        nombre: data.nombre,
        apellido: data.apellido,
        vocero: data.vocero,
        calle: data.calle,
        isAdmin: data.isAdmin
      };
      setSession(sessionData);
      return okRes(sessionData);
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        errRes("Credenciales inválidas.");
      }
      errRes(e.message);
    }
  },

  getRegistrationOpen: async () => {
    const snap = await getDocs(collection(db, "usuarios"));
    return okRes({ open: snap.empty, isFirstUser: snap.empty });
  },

  getSalt: async (userId) => {
    try {
      const docRef = await getDoc(doc(db, "usuarios", userId));
      if (docRef.exists()) {
        return okRes({ salt: docRef.data().salt });
      }
      return okRes({ salt: "firebase_no_salt" });
    } catch (e) {
      return okRes({ salt: "firebase_no_salt" });
    }
  },

  register: async (payload) => {
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const isFirst = snap.empty;
      
      const session = getSession();
      if (!isFirst && (!session.user || !session.user.isAdmin)) {
        return errRes("Solo el administrador puede crear nuevas cuentas.");
      }

      const authInstance = isFirst ? auth : secondaryAuth;
      await createUserWithEmailAndPassword(authInstance, getEmail(payload.userId), payload.passwordHash);
      
      await setDoc(doc(db, "usuarios", payload.userId), {
        nombre: payload.nombre,
        apellido: payload.apellido,
        vocero: payload.vocero,
        calle: payload.calle,
        isAdmin: isFirst,
        salt: payload.salt || "firebase_no_salt",
        createdAt: serverTimestamp()
      });
      return okRes({ message: "Usuario creado exitosamente.", isFirstUser: isFirst });
    } catch (e) {
      errRes(e.message);
    }
  },

  getRecoveryQuestions: async () => errRes("Recuperación no disponible en modo Firebase. El Admin debe reiniciar la cuenta."),
  resetPassword: async () => errRes("Recuperación no disponible en modo Firebase."),

  listVoceros: async () => {
    try {
      const q = query(collection(db, "usuarios"), where("isAdmin", "==", false));
      const snap = await getDocs(q);
      return okRes({ voceros: snap.docs.map(d => ({ id: d.id, user_id: d.id, ...d.data() })) });
    } catch (e) { errRes(e.message); }
  },

  createVocero: async (payload) => {
    return api.register(payload); // Utiliza el mismo método con secondaryAuth
  },

  updateVocero: async (userId, payload) => {
    try {
      await updateDoc(doc(db, "usuarios", userId), {
        nombre: payload.nombre,
        apellido: payload.apellido,
        vocero: payload.vocero,
        calle: payload.calle
      });
      return okRes({ message: "Vocero actualizado." });
    } catch (e) { errRes(e.message); }
  },

  adminResetVoceroPassword: async () => errRes("Cambio de contraseña no soportado por cliente en Firebase sin Auth Admin SDK. Borre y recree el usuario."),

  getHabitantes: async (consejoNombre) => {
    try {
      const session = getSession();
      const isAdmin = session.isAdmin || session.user?.isAdmin;
      const userCalle = session.calle || session.user?.calle;
      const ref = collection(db, "habitantes");
      
      let q;
      if (isAdmin) {
        q = query(ref, orderBy("nombre"));
      } else {
        q = query(ref, where("consejo", "==", consejoNombre), where("calle", "==", userCalle), orderBy("nombre"));
      }
      
      const snap = await getDocs(q);
      const habitantes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return okRes({ stats: [], habitantes });
    } catch (e) { errRes(e.message); }
  },

  createHabitante: async (payload) => {
    try {
      const docRef = await addDoc(collection(db, "habitantes"), {
        ...payload,
        consejo: payload.consejoNombre,
        es_jefe_familia: false,
        jefe_familia_id: null,
        createdAt: serverTimestamp()
      });
      return okRes({ id: docRef.id });
    } catch (e) { errRes(e.message); }
  },

  createHabitantesBulk: async (payload) => {
    try {
      let batch = writeBatch(db);
      let count = 0;
      let ops = 0;
      
      const commitIfFull = async () => {
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      };

      for (const fam of payload.familias) {
        if (!fam.jefe) continue;
        const jefeRef = doc(collection(db, "habitantes"));
        batch.set(jefeRef, {
          ...fam.jefe,
          consejo: payload.consejoNombre,
          es_jefe_familia: false, // Se cargan como personas individuales, no jefes por defecto
          jefe_familia_id: null,
          createdAt: serverTimestamp()
        });
        count++;
        ops++;
        await commitIfFull();

        for (const dep of (fam.dependientes || [])) {
          const depRef = doc(collection(db, "habitantes"));
          batch.set(depRef, {
            ...dep,
            consejo: payload.consejoNombre,
            es_jefe_familia: false,
            jefe_familia_id: jefeRef.id,
            createdAt: serverTimestamp()
          });
          count++;
          ops++;
          await commitIfFull();
        }
      }
      if (ops > 0) {
        await batch.commit();
      }
      return okRes({ total: count });
    } catch (e) { errRes(e.message); }
  },

  updateHabitante: async (id, payload) => {
    try {
      await updateDoc(doc(db, "habitantes", id), payload);
      return okRes({ message: "Actualizado" });
    } catch (e) { errRes(e.message); }
  },

  deleteHabitante: async (id) => {
    try {
      // First find if anyone depends on this
      const q = query(collection(db, "habitantes"), where("jefe_familia_id", "==", id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.update(d.ref, { jefe_familia_id: null });
      });
      batch.delete(doc(db, "habitantes", id));
      // Delete votes if any
      const vq = query(collection(db, "votos"), where("habitante_id", "==", id));
      const vsnap = await getDocs(vq);
      vsnap.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
      return okRes({ message: "Eliminado" });
    } catch (e) { errRes(e.message); }
  },

  saveGrupoFamiliar: async (id, dependientesIds) => {
    try {
      const batch = writeBatch(db);
      // Make this ID the head
      batch.update(doc(db, "habitantes", id), { es_jefe_familia: true, jefe_familia_id: null });
      
      // Unlink current dependents
      const currentDeps = await getDocs(query(collection(db, "habitantes"), where("jefe_familia_id", "==", id)));
      currentDeps.forEach(d => batch.update(d.ref, { jefe_familia_id: null }));
      
      // Link new dependents
      if (dependientesIds && dependientesIds.length > 0) {
        for (const depId of dependientesIds) {
          batch.update(doc(db, "habitantes", depId), { es_jefe_familia: false, jefe_familia_id: id });
        }
      }
      await batch.commit();
      return okRes({ message: "Familia guardada" });
    } catch (e) { errRes(e.message); }
  },

  disolverGrupoFamiliar: async (id) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "habitantes", id), { es_jefe_familia: false });
      const currentDeps = await getDocs(query(collection(db, "habitantes"), where("jefe_familia_id", "==", id)));
      currentDeps.forEach(d => batch.update(d.ref, { jefe_familia_id: null }));
      await batch.commit();
      return okRes({ message: "Familia disuelta" });
    } catch (e) { errRes(e.message); }
  },

  getPagos: async (consejoNombre) => {
    try {
      const session = getSession();
      const q = session.user?.isAdmin 
        ? query(collection(db, "pagos"))
        : query(collection(db, "pagos"), where("consejo", "==", consejoNombre));
      const snap = await getDocs(q);
      const pagos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return okRes({ pagos });
    } catch (e) { errRes(e.message); }
  },

  createPago: async (payload) => {
    try {
      const docRef = await addDoc(collection(db, "pagos"), {
        ...payload,
        createdAt: serverTimestamp()
      });
      return okRes({ id: docRef.id });
    } catch (e) { errRes(e.message); }
  },

  deletePago: async (id) => {
    try {
      await deleteDoc(doc(db, "pagos", id));
      return okRes();
    } catch (e) { errRes(e.message); }
  },

  updatePago: async (id, payload) => {
    try {
      await updateDoc(doc(db, "pagos", id), payload);
      return okRes();
    } catch (e) { errRes(e.message); }
  },

  getJornadas: async (consejoNombre) => {
    try {
      const session = getSession();
      const q = session.user?.isAdmin 
        ? query(collection(db, "jornadas"))
        : query(collection(db, "jornadas"), where("consejo", "==", consejoNombre));
      const snap = await getDocs(q);
      const jornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return okRes({ jornadas });
    } catch (e) { errRes(e.message); }
  },

  createJornada: async (payload) => {
    try {
      const docRef = await addDoc(collection(db, "jornadas"), {
        ...payload,
        estado: "Abierta",
        createdAt: serverTimestamp()
      });
      return okRes({ id: docRef.id });
    } catch (e) { errRes(e.message); }
  },

  deleteJornada: async (id) => {
    try {
      await deleteDoc(doc(db, "jornadas", id));
      return okRes();
    } catch (e) { errRes(e.message); }
  },

  getElectionConfig: async () => {
    try {
      const docRef = await getDoc(doc(db, "config", "election"));
      return okRes({ active_election_title: docRef.exists() ? docRef.data().title : null });
    } catch (e) { errRes(e.message); }
  },

  setElectionConfig: async (title) => {
    try {
      if (!title) {
        await deleteDoc(doc(db, "config", "election"));
      } else {
        await setDoc(doc(db, "config", "election"), { title });
      }
      return okRes({ active_election_title: title });
    } catch (e) { errRes(e.message); }
  },

  getVotaciones: async () => {
    try {
      const session = getSession();
      const isAdmin = session.user?.isAdmin;
      
      const habSnap = await getDocs(collection(db, "habitantes"));
      const votosSnap = await getDocs(collection(db, "votos"));
      
      const votosSet = new Set(votosSnap.docs.map(d => d.data().habitante_id));
      
      let habitantes = habSnap.docs.map(d => ({ id: d.id, ...d.data(), voto: votosSet.has(d.id) }));
      
      if (!isAdmin) {
        habitantes = habitantes.filter(h => h.consejo === session.user?.consejo && h.calle === session.user?.calle);
      }
      
      // Calculate Stats
      const statsMap = {};
      habitantes.forEach(h => {
        if (!statsMap[h.consejo]) {
          statsMap[h.consejo] = { consejo: h.consejo, total: 0, callesMap: {} };
        }
        if (!statsMap[h.consejo].callesMap[h.calle]) {
          statsMap[h.consejo].callesMap[h.calle] = { nombre: h.calle, total: 0 };
        }
        if (h.voto) {
          statsMap[h.consejo].total++;
          statsMap[h.consejo].callesMap[h.calle].total++;
        }
      });
      
      const stats = Object.values(statsMap).map(s => ({
        consejo: s.consejo,
        total: s.total,
        calles: Object.values(s.callesMap)
      }));
      
      return okRes({ stats, habitantes });
    } catch (e) { errRes(e.message); }
  },

  toggleVoto: async (habitanteId, voto) => {
    try {
      if (voto) {
        // Add vote
        await setDoc(doc(db, "votos", habitanteId), { habitante_id: habitanteId, createdAt: serverTimestamp() });
      } else {
        await deleteDoc(doc(db, "votos", habitanteId));
      }
      return okRes();
    } catch (e) { errRes(e.message); }
  },

  getVotacionesHistorial: async () => {
    try {
      const session = getSession();
      const q = session.user?.isAdmin
        ? query(collection(db, "historial_votos"), orderBy("createdAt", "desc"))
        : query(collection(db, "historial_votos"), where("consejo", "==", session.user?.consejo));
      const snap = await getDocs(q);
      const historial = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return okRes({ historial });
    } catch (e) { errRes(e.message); }
  },

  saveVotacionesHistorial: async (payload) => {
    try {
      const { titulo, consejoNombre, calle } = payload;
      // Get all inhabitants of this street
      const habQuery = query(collection(db, "habitantes"), where("consejo", "==", consejoNombre), where("calle", "==", calle));
      const habSnap = await getDocs(habQuery);
      const habIds = new Set(habSnap.docs.map(d => d.id));
      
      // Get all votes
      const votosSnap = await getDocs(collection(db, "votos"));
      const votosToClear = [];
      let count = 0;
      votosSnap.forEach(v => {
        if (habIds.has(v.data().habitante_id)) {
          votosToClear.push(v.ref);
          count++;
        }
      });
      
      const batch = writeBatch(db);
      // Save history
      const histRef = doc(collection(db, "historial_votos"));
      batch.set(histRef, {
        titulo, consejo: consejoNombre, calle, cantidad_votos: count, createdAt: serverTimestamp()
      });
      
      // Clear votes
      votosToClear.forEach(ref => batch.delete(ref));
      
      await batch.commit();
      return okRes({ cantidad: count, message: "Historial guardado exitosamente." });
    } catch (e) { errRes(e.message); }
  },

  deleteVotacionesHistorial: async (id) => {
    try {
      await deleteDoc(doc(db, "historial_votos", id));
      return okRes();
    } catch (e) { errRes(e.message); }
  }
};
