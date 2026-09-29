import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, deleteUser } from "firebase/auth";
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
      
      // Guardar el passwordHash en Firestore si no existía (compatibilidad retrospectiva)
      if (!data.passwordHash) {
        await updateDoc(doc(db, "usuarios", userId), { passwordHash });
      }
      
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
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      return okRes({ open: snap.empty, isFirstUser: snap.empty });
    } catch (e) {
      // Si falla por permisos, asumimos que ya hay usuarios creados y no es el primer usuario.
      return okRes({ open: false, isFirstUser: false });
    }
  },

  getSalt: async (userId) => {
    try {
      const localSalts = {
        "joyvert.albero23@gmail.com": "9162ba5bc2beb6f93a9a",
        "124@comunapasofrente.com": "4ac70820e26d861cb544",
        "123@comunapasofrente.com": "db154689ba775f341459",
        "123@comunapasofrente.local": "8ed9dcf040c08b231f9b",
        "temp_reset_user@comunapasofrente.com": "5ef596e49872b3be9ca5"
      };
      
      const normalized = String(userId || "").trim().toLowerCase();
      if (localSalts[normalized]) {
        return okRes({ salt: localSalts[normalized] });
      }

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
      if (!isFirst && (!session.isAdmin)) {
        return errRes("Solo el administrador puede crear nuevas cuentas.");
      }

      const authInstance = isFirst ? auth : secondaryAuth;
      await createUserWithEmailAndPassword(authInstance, getEmail(payload.userId), payload.passwordHash);
      
      const userIsAdmin = isFirst || Boolean(payload.isAdmin);

      await setDoc(doc(db, "usuarios", payload.userId), {
        nombre: payload.nombre,
        apellido: payload.apellido,
        telefono: payload.telefono || "",
        vocero: payload.vocero,
        calle: payload.calle,
        isAdmin: userIsAdmin,
        salt: payload.salt || "firebase_no_salt",
        passwordHash: payload.passwordHash,
        pregunta1: payload.pregunta1 || "",
        pregunta2: payload.pregunta2 || "",
        respuesta1Hash: payload.respuesta1Hash || "",
        respuesta2Hash: payload.respuesta2Hash || "",
        createdAt: serverTimestamp()
      });

      await api.logAuditoria({
        accion: "CREAR_USUARIO",
        detalle: `Creó la cuenta de ${payload.nombre} ${payload.apellido} (@${payload.userId}) con rol ${userIsAdmin ? "Administrador" : "Vocero"}`,
        modulo: "Usuarios"
      });

      return okRes({ message: "Usuario creado exitosamente.", isFirstUser: isFirst });
    } catch (e) {
      errRes(e.message);
    }
  },

  getRecoveryQuestions: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (!userDoc.exists()) return errRes("Usuario no encontrado.");
      const data = userDoc.data();
      return okRes({
        pregunta1: data.pregunta1 || "Pregunta 1 no configurada",
        pregunta2: data.pregunta2 || "Pregunta 2 no configurada",
        salt: data.salt || "firebase_no_salt"
      });
    } catch (e) {
      errRes(e.message);
    }
  },

  resetPassword: async (payload) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", payload.userId));
      if (!userDoc.exists()) return errRes("Usuario no encontrado.");
      const data = userDoc.data();
      
      // Validar respuestas
      if (data.respuesta1Hash !== payload.respuesta1Hash || data.respuesta2Hash !== payload.respuesta2Hash) {
        return errRes("Respuestas de seguridad incorrectas.");
      }
      
      const currentPasswordHash = data.passwordHash;
      if (!currentPasswordHash) {
        return errRes("No se pudo recuperar la credencial de Firebase. El Admin debe reiniciar tu cuenta.");
      }
      
      // Login en secondary Auth
      const userCred = await signInWithEmailAndPassword(secondaryAuth, getEmail(payload.userId), currentPasswordHash);
      
      // Cambiar clave
      await updatePassword(userCred.user, payload.newPasswordHash);
      
      // Guardar en Firestore
      await updateDoc(doc(db, "usuarios", payload.userId), {
        salt: payload.newSalt,
        passwordHash: payload.newPasswordHash
      });
      
      return okRes({ message: "Contraseña restablecida con éxito." });
    } catch (e) {
      errRes(e.message);
    }
  },

  listVoceros: async () => {
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const voceros = snap.docs.map(d => ({ 
        id: d.id, 
        user_id: d.id, 
        is_admin: Boolean(d.data().isAdmin),
        ...d.data() 
      }));
      voceros.sort((a, b) => {
        if (a.is_admin && !b.is_admin) return -1;
        if (!a.is_admin && b.is_admin) return 1;
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
      return okRes({ voceros });
    } catch (e) { errRes(e.message); }
  },

  createVocero: async (payload) => {
    return api.register(payload); // Utiliza el mismo método con secondaryAuth
  },

  toggleUserAdmin: async (userId, newIsAdmin) => {
    try {
      const session = getSession();
      if (!session.isAdmin) return errRes("Solo un administrador puede modificar roles.");

      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (!userDoc.exists()) return errRes("Usuario no encontrado.");
      const userData = userDoc.data();

      if (!newIsAdmin && session.userId === userId) {
        const snap = await getDocs(query(collection(db, "usuarios"), where("isAdmin", "==", true)));
        if (snap.size <= 1) {
          return errRes("No puedes quitarte el rol de administrador porque eres el único administrador.");
        }
      }

      await updateDoc(doc(db, "usuarios", userId), { isAdmin: newIsAdmin });

      await api.logAuditoria({
        accion: newIsAdmin ? "PROMOVER_ADMIN" : "REVOCAR_ADMIN",
        detalle: `${newIsAdmin ? "Asignó rol de Administrador" : "Revocó rol de Administrador"} a ${userData.nombre || userId} ${userData.apellido || ""} (@${userId})`,
        modulo: "Usuarios"
      });

      return okRes({ message: `Rol actualizado a ${newIsAdmin ? "Administrador" : "Vocero"}.` });
    } catch (e) { errRes(e.message); }
  },

  updateVocero: async (userId, payload) => {
    try {
      await updateDoc(doc(db, "usuarios", userId), {
        nombre: payload.nombre,
        apellido: payload.apellido,
        telefono: payload.telefono || "",
        vocero: payload.vocero,
        calle: payload.calle
      });
      await api.logAuditoria({
        accion: "ACTUALIZAR_USUARIO",
        detalle: `Actualizó datos de ${payload.nombre} ${payload.apellido} (@${userId})`,
        modulo: "Usuarios"
      });
      return okRes({ message: "Vocero actualizado." });
    } catch (e) { errRes(e.message); }
  },

  adminResetVoceroPassword: async (userId, payload) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (!userDoc.exists()) return errRes("Usuario no encontrado.");
      const data = userDoc.data();
      
      const currentPasswordHash = data.passwordHash;
      if (!currentPasswordHash) {
        return errRes("El usuario no tiene una contraseña registrada.");
      }
      
      // Iniciar sesión temporal
      const userCred = await signInWithEmailAndPassword(secondaryAuth, getEmail(userId), currentPasswordHash);
      
      // Cambiar clave
      await updatePassword(userCred.user, payload.newPasswordHash);
      
      // Guardar el nuevo hash y salt
      await updateDoc(doc(db, "usuarios", userId), {
        salt: payload.newSalt,
        passwordHash: payload.newPasswordHash
      });
      
      return okRes({ message: "Contraseña restablecida correctamente." });
    } catch (e) {
      errRes(e.message);
    }
  },

  deleteVocero: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      if (!userDoc.exists()) return errRes("Vocero no encontrado.");
      const data = userDoc.data();
      
      const currentPasswordHash = data.passwordHash;
      if (currentPasswordHash) {
        try {
          const userCred = await signInWithEmailAndPassword(secondaryAuth, getEmail(userId), currentPasswordHash);
          await deleteUser(userCred.user);
        } catch (authErr) {
          console.warn("No se pudo borrar del Auth de Firebase (tal vez ya no existía):", authErr.message);
        }
      }
      
      // Borrar de Firestore
      await deleteDoc(doc(db, "usuarios", userId));
      return okRes({ message: "Vocero eliminado con éxito." });
    } catch (e) {
      errRes(e.message);
    }
  },

  getHabitantes: async (consejoNombre) => {
    try {
      const session = getSession();
      const isAdmin = session.isAdmin || session.user?.isAdmin;
      const userCalle = session.calle || session.user?.calle;
      const ref = collection(db, "habitantes");
      
      let q;
      if (isAdmin) {
        q = query(ref, where("consejo", "==", consejoNombre));
      } else if (userCalle) {
        q = query(ref, where("consejo", "==", consejoNombre), where("calle", "==", userCalle));
      } else {
        q = query(ref, where("consejo", "==", consejoNombre));
      }
      
      const snap = await getDocs(q);
      const habitantes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenar por nombre en el cliente para evitar índices compuestos en Firebase
      habitantes.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
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
      await api.logAuditoria({
        accion: "REGISTRAR_HABITANTE",
        detalle: `Registró al habitante ${payload.nombre} ${payload.apellido} (C.I. ${payload.cedula || "S/C"}) en ${payload.calle}, ${payload.consejoNombre}`,
        modulo: "Habitantes"
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
      await api.logAuditoria({
        accion: "CARGA_MASIVA",
        detalle: `Cargó ${count} habitantes en bloque vía Excel para ${payload.consejoNombre}`,
        modulo: "Habitantes"
      });
      return okRes({ total: count });
    } catch (e) { errRes(e.message); }
  },

  updateHabitante: async (id, payload) => {
    try {
      await updateDoc(doc(db, "habitantes", id), payload);
      await api.logAuditoria({
        accion: "EDITAR_HABITANTE",
        detalle: `Actualizó datos del habitante ${payload.nombre || ""} ${payload.apellido || ""} (ID: ${id})`,
        modulo: "Habitantes"
      });
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
      await api.logAuditoria({
        accion: "ELIMINAR_HABITANTE",
        detalle: `Eliminó el registro del habitante ID: ${id}`,
        modulo: "Habitantes"
      });
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
      const q = session.isAdmin 
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
      const q = session.isAdmin 
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

  closeGlobalElection: async (titulo) => {
    try {
      const votosSnap = await getDocs(collection(db, "votos"));
      let count = votosSnap.size;
      const batch = writeBatch(db);
      
      if (titulo) {
        const histRef = doc(collection(db, "historial_votos"));
        batch.set(histRef, {
          titulo, consejo: "Global", calle: "Todas", cantidad_votos: count, createdAt: serverTimestamp()
        });
      }
      
      votosSnap.forEach(v => batch.delete(v.ref));
      batch.delete(doc(db, "config", "election"));
      
      await batch.commit();
      return okRes({ message: "Jornada global cerrada y votos reiniciados." });
    } catch (e) { errRes(e.message); }
  },

  getVotaciones: async () => {
    try {
      const session = getSession();
      const isAdmin = session.isAdmin;
      
      const habSnap = await getDocs(collection(db, "habitantes"));
      const votosSnap = await getDocs(collection(db, "votos"));
      
      const votosSet = new Set(votosSnap.docs.map(d => d.data().habitante_id));
      
      let habitantes = habSnap.docs.map(d => ({ id: d.id, ...d.data(), voto: votosSet.has(d.id) }));
      
      if (!isAdmin) {
        habitantes = habitantes.filter(h => h.consejo === session.vocero && h.calle === session.calle);
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
      const q = session.isAdmin
        ? query(collection(db, "historial_votos"))
        : query(collection(db, "historial_votos"), where("consejo", "==", session.vocero), where("calle", "==", session.calle));
      const snap = await getDocs(q);
      const historial = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      historial.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
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
  },

  // --- Módulo de Auditoría y Control ---
  logAuditoria: async ({ accion, detalle, modulo }) => {
    try {
      const session = getSession();
      const userName = [session.nombre, session.apellido].filter(Boolean).join(" ") || session.userId || "Sistema";
      const userRol = session.isAdmin ? "Administrador" : "Vocero";
      await addDoc(collection(db, "auditoria"), {
        accion,
        detalle,
        modulo: modulo || "General",
        usuario_id: session.userId || "sistema",
        usuario_nombre: userName,
        usuario_rol: userRol,
        consejo: session.vocero || "Todos",
        calle: session.calle || "General",
        createdAt: serverTimestamp()
      });
      return okRes();
    } catch (e) {
      // No interrumpir la operación principal si falla el log
      console.warn("Error registrando auditoría:", e.message);
      return okRes();
    }
  },

  getAuditoria: async (limitCount = 100) => {
    try {
      const session = getSession();
      if (!session.isAdmin) return errRes("Acceso restringido: Solo administradores pueden ver la auditoría.");
      
      const snap = await getDocs(collection(db, "auditoria"));
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      return okRes({ logs: logs.slice(0, limitCount) });
    } catch (e) { errRes(e.message); }
  },

  limpiarAuditoria: async () => {
    try {
      const session = getSession();
      if (!session.isAdmin) return errRes("Acceso restringido.");

      const snap = await getDocs(collection(db, "auditoria"));
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();

      await api.logAuditoria({
        accion: "PURGAR_AUDITORIA",
        detalle: `Vació los registros históricos del registro de auditoría`,
        modulo: "Auditoría"
      });

      return okRes({ message: "Historial de auditoría purgado correctamente." });
    } catch (e) { errRes(e.message); }
  },

  // --- Módulo de Respaldo y Restauración de Base de Datos ---
  exportDatabaseBackup: async () => {
    try {
      const session = getSession();
      if (!session.isAdmin) return errRes("Acceso restringido: Solo administradores pueden exportar respaldos.");

      const colecciones = [
        "habitantes",
        "usuarios",
        "jornadas",
        "pagos",
        "votos",
        "historial_votos",
        "auditoria"
      ];

      const backupData = {
        metadata: {
          sistema: "Comuna Un Paso Al Frente",
          version: "2.0",
          fecha_exportacion: new Date().toISOString(),
          exportado_por: session.userId || "admin",
          nombre_operador: [session.nombre, session.apellido].filter(Boolean).join(" ") || "Administrador"
        },
        data: {}
      };

      for (const colName of colecciones) {
        const snap = await getDocs(collection(db, colName));
        backupData.data[colName] = snap.docs.map(docSnap => {
          const docData = docSnap.data();
          // Convertir serverTimestamps si existen para que sean serializables en JSON limpio
          const parsedDoc = { id: docSnap.id, ...docData };
          Object.keys(parsedDoc).forEach(key => {
            if (parsedDoc[key] && typeof parsedDoc[key].toDate === "function") {
              parsedDoc[key] = parsedDoc[key].toDate().toISOString();
            }
          });
          return parsedDoc;
        });
      }

      await api.logAuditoria({
        accion: "EXPORTAR_RESPALDO",
        detalle: `Generó un archivo de respaldo completo JSON del sistema (${Object.keys(backupData.data).reduce((acc, k) => acc + backupData.data[k].length, 0)} registros)`,
        modulo: "Seguridad y Respaldo"
      });

      return okRes({ backup: backupData });
    } catch (e) {
      errRes(e.message);
    }
  },

  restoreDatabaseBackup: async (backupJson) => {
    try {
      const session = getSession();
      if (!session.isAdmin) return errRes("Acceso restringido: Solo administradores pueden restaurar respaldos.");

      if (!backupJson || !backupJson.data || typeof backupJson.data !== "object") {
        return errRes("El archivo no tiene el formato de respaldo válido de la Comuna.");
      }

      let totalRestaurados = 0;
      const permitidas = ["habitantes", "usuarios", "jornadas", "pagos", "historial_votos"];

      for (const colName of permitidas) {
        const items = backupJson.data[colName];
        if (!Array.isArray(items) || items.length === 0) continue;

        let batch = writeBatch(db);
        let count = 0;

        for (const item of items) {
          const docId = item.id;
          const docBody = { ...item };
          delete docBody.id;

          const docRef = docId ? doc(db, colName, docId) : doc(collection(db, colName));
          batch.set(docRef, { ...docBody, updatedAt: serverTimestamp() }, { merge: true });
          count++;
          totalRestaurados++;

          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
      }

      await api.logAuditoria({
        accion: "RESTAURAR_RESPALDO",
        detalle: `Restauró datos desde archivo de respaldo JSON (${totalRestaurados} registros procesados)`,
        modulo: "Seguridad y Respaldo"
      });

      return okRes({ total: totalRestaurados, message: `Respaldo restaurado exitosamente. Se sincronizaron ${totalRestaurados} registros.` });
    } catch (e) {
      errRes(e.message);
    }
  }
};
