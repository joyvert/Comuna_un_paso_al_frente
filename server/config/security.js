/**
 * Límites de intentos fallidos (login y recuperación).
 * Sobrescribibles con variables de entorno.
 */
export const securityConfig = {
  /** Intentos fallidos de login antes de bloqueo (por IP + usuario) */
  loginMaxFailures: Number(process.env.AUTH_LOGIN_MAX_FAILURES || 5),
  /** Ventana en ms para contar intentos fallidos consecutivos */
  loginWindowMs: Number(process.env.AUTH_LOGIN_WINDOW_MS || 15 * 60 * 1000),
  /** Tiempo de bloqueo tras superar el máximo (ms) */
  loginLockoutMs: Number(process.env.AUTH_LOGIN_LOCKOUT_MS || 15 * 60 * 1000),

  /** Intentos fallidos en restablecer contraseña (respuestas incorrectas) */
  recoveryMaxFailures: Number(process.env.AUTH_RECOVERY_MAX_FAILURES || 5),
  recoveryWindowMs: Number(process.env.AUTH_RECOVERY_WINDOW_MS || 60 * 60 * 1000),
  recoveryLockoutMs: Number(process.env.AUTH_RECOVERY_LOCKOUT_MS || 60 * 60 * 1000),
};
