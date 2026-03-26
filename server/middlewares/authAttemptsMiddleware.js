import { checkBlocked, loginKey, recoveryKey } from "../security/attemptStore.js";
import { getClientIp } from "./clientIp.js";

/** Bloquea login si ya hay lockout activo para IP+usuario */
export function loginLockoutGuard(req, res, next) {
  const userId = req.body?.userId;
  if (!userId) return next();
  const ip = getClientIp(req);
  const key = loginKey(ip, userId);
  const r = checkBlocked(key);
  if (r.blocked) {
    return res.status(429).json({
      ok: false,
      message: `Demasiados intentos fallidos. Vuelve a intentar en ${r.retryAfterSeconds} segundos.`,
      retryAfterSeconds: r.retryAfterSeconds,
    });
  }
  next();
}

/** Bloquea reset de contraseña si hubo demasiados fallos previos */
export function recoveryLockoutGuard(req, res, next) {
  const userId = req.body?.userId;
  if (!userId) return next();
  const ip = getClientIp(req);
  const key = recoveryKey(ip, userId);
  const r = checkBlocked(key);
  if (r.blocked) {
    return res.status(429).json({
      ok: false,
      message: `Demasiados intentos fallidos de recuperación. Vuelve a intentar en ${r.retryAfterSeconds} segundos.`,
      retryAfterSeconds: r.retryAfterSeconds,
    });
  }
  next();
}
