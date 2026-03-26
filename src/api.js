const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const SESSION_KEY = "comuna_session_v1";

function authHeaders() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    if (s.accessToken) return { Authorization: `Bearer ${s.accessToken}` };
  } catch {
    /* noop */
  }
  return {};
}

async function request(path, options = {}) {
  const skipAuth = options.skipAuth === true;
  const { skipAuth: _s, ...fetchOpts } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(skipAuth ? {} : authHeaders()),
      ...(fetchOpts.headers || {}),
    },
    ...fetchOpts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Error de API");
    err.status = res.status;
    if (data.retryAfterSeconds != null) err.retryAfterSeconds = data.retryAfterSeconds;
    else {
      const ra = res.headers.get("Retry-After");
      if (ra) {
        const n = parseInt(ra, 10);
        if (Number.isFinite(n)) err.retryAfterSeconds = n;
      }
    }
    throw err;
  }
  return data;
}

export const api = {
  health: () => request("/health"),
  initDb: () => request("/setup/init-db", { method: "POST", skipAuth: true }),

  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload), skipAuth: true }),
  getRegistrationOpen: () => request("/auth/registration-open", { skipAuth: true }),
  getSalt: (userId) => request(`/auth/salt/${encodeURIComponent(userId)}`, { skipAuth: true }),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  getRecoveryQuestions: (userId) => request(`/auth/recovery/${encodeURIComponent(userId)}`, { skipAuth: true }),
  resetPassword: (payload) =>
    request("/auth/recovery/reset", { method: "POST", body: JSON.stringify(payload), skipAuth: true }),

  listVoceros: () => request("/auth/admin/voceros"),
  createVocero: (payload) => request("/auth/admin/voceros", { method: "POST", body: JSON.stringify(payload) }),
  updateVocero: (userId, payload) =>
    request(`/auth/admin/voceros/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminResetVoceroPassword: (userId, payload) =>
    request(`/auth/admin/voceros/${encodeURIComponent(userId)}/reset-password`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getHabitantes: (consejoNombre) => request(`/data/habitantes/${encodeURIComponent(consejoNombre)}`),
  createHabitante: (payload) => request("/data/habitantes", { method: "POST", body: JSON.stringify(payload) }),
  updateHabitante: (id, payload) =>
    request(`/data/habitantes/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteHabitante: (id) => request(`/data/habitantes/${encodeURIComponent(id)}`, { method: "DELETE" }),

  getPagos: (consejoNombre) => request(`/data/pagos/${encodeURIComponent(consejoNombre)}`),
  createPago: (payload) => request("/data/pagos", { method: "POST", body: JSON.stringify(payload) }),
  deletePago: (id) => request(`/data/pagos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updatePago: (id, payload) => request(`/data/pagos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),

  getJornadas: (consejoNombre) => request(`/data/jornadas/${encodeURIComponent(consejoNombre)}`),
  createJornada: (payload) => request("/data/jornadas", { method: "POST", body: JSON.stringify(payload) }),
};
