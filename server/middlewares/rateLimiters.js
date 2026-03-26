import rateLimit from "express-rate-limit";

/** Límite general por IP sobre todas las rutas /api/auth (evita abuso masivo) */
export const authGlobalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiadas solicitudes. Intenta más tarde." },
});

/** Login: pocas peticiones por IP (independiente del contador de fallidos por usuario) */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_LOGIN_IP_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiados intentos de inicio de sesión desde esta IP. Espera unos minutos." },
});

/** GET salt / recovery questions — evita enumeración y scraping */
export const authSensitiveGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_SENSITIVE_GET_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiadas consultas. Espera unos minutos." },
});

/** Recuperación: POST reset y rutas sensibles */
export const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AUTH_RECOVERY_IP_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Límite de recuperación alcanzado. Intenta más tarde." },
});

/** Registro de nuevas cuentas por IP */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AUTH_REGISTER_IP_MAX || 15),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiados registros desde esta IP. Intenta más tarde." },
});
