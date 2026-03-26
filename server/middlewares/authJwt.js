import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { config } from "../config/index.js";

export function signAccessToken(payload) {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET no configurado.");
  }
  return jwt.sign(
    {
      sub: payload.sub,
      admin: payload.admin,
      consejo: payload.consejo,
      calle: payload.calle,
    },
    config.jwtSecret,
    { expiresIn: "7d" },
  );
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Sesión requerida. Inicia sesión de nuevo." });
  }
  try {
    const decoded = jwt.verify(h.slice(7), config.jwtSecret);
    req.auth = {
      sub: decoded.sub,
      admin: Boolean(decoded.admin),
      consejo: decoded.consejo,
      calle: decoded.calle,
    };
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Sesión inválida o expirada." });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.auth?.admin) {
    return res.status(403).json({ ok: false, message: "Solo administradores pueden usar esta acción." });
  }
  next();
}

/**
 * Registro público si: no hay usuarios aún (primer cuenta = admin), o ALLOW_PUBLIC_REGISTER=true.
 * Si ya hay usuarios y no hay flag, exige JWT de administrador.
 */
export async function registerAccess(req, res, next) {
  if (config.allowPublicRegister) return next();
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS n FROM usuarios");
    if (r.rows[0].n === 0) return next();
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
  return requireAuth(req, res, () => requireAdmin(req, res, next));
}
