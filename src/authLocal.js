/**
 * Autenticación local (fallback cuando el API no está disponible).
 * En producción el backend debe ser la única fuente de verdad.
 */
const LOCAL_USERS_KEY = "comuna_local_users_v1";

export function getLocalUser(userId) {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[userId] || null;
  } catch {
    return null;
  }
}

export function saveLocalUser(record) {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[record.userId] = record;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error(e);
    throw new Error("No se pudo guardar la cuenta en el navegador.");
  }
}

export function localUserExists(userId) {
  return Boolean(getLocalUser(userId));
}

/** Actualiza salt y hash de contraseña tras recuperación (misma estructura que al registrar). */
export function updateLocalUserCredentials(userId, { salt, passwordHash }) {
  const u = getLocalUser(userId);
  if (!u) {
    throw new Error("Usuario no encontrado en este navegador.");
  }
  saveLocalUser({ ...u, salt, passwordHash });
}
