/**
 * Almacén en memoria de intentos fallidos (por instancia de Node).
 * En producción con varias réplicas usar Redis.
 */

const store = new Map();

function now() {
  return Date.now();
}

/**
 * @param {string} key - ej. "login:ip:userId"
 * @param {{ maxFailures: number, windowMs: number, lockoutMs: number }} opts
 * @returns {{ blocked: boolean, retryAfterSeconds?: number }}
 */
export function recordFailure(key, opts) {
  const { maxFailures, windowMs, lockoutMs } = opts;
  const t = now();
  let e = store.get(key);

  if (e?.lockUntil && t < e.lockUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil((e.lockUntil - t) / 1000) };
  }

  if (e?.lockUntil && t >= e.lockUntil) {
    store.delete(key);
    e = undefined;
  }

  if (!e) {
    e = { failures: 0, windowStart: t };
  }

  if (t - e.windowStart > windowMs) {
    e.failures = 0;
    e.windowStart = t;
  }

  e.failures += 1;

  if (e.failures >= maxFailures) {
    e.lockUntil = t + lockoutMs;
    e.failures = 0;
    e.windowStart = t;
    store.set(key, e);
    return { blocked: true, retryAfterSeconds: Math.ceil(lockoutMs / 1000) };
  }

  store.set(key, e);
  return { blocked: false };
}

/**
 * @returns {{ blocked: boolean, retryAfterSeconds?: number }}
 */
export function checkBlocked(key) {
  const t = now();
  const e = store.get(key);
  if (!e?.lockUntil) return { blocked: false };
  if (t >= e.lockUntil) {
    store.delete(key);
    return { blocked: false };
  }
  return { blocked: true, retryAfterSeconds: Math.ceil((e.lockUntil - t) / 1000) };
}

export function clearAttempts(key) {
  store.delete(key);
}

export function loginKey(ip, userId) {
  return `login:${ip}:${String(userId).toLowerCase()}`;
}

export function recoveryKey(ip, userId) {
  return `recovery:${ip}:${String(userId).toLowerCase()}`;
}
