import { pool } from "../config/db.js";
import { config } from "../config/index.js";
import { securityConfig } from "../config/security.js";
import { getClientIp } from "../middlewares/clientIp.js";
import { signAccessToken } from "../middlewares/authJwt.js";
import { clearAttempts, loginKey, recordFailure, recoveryKey } from "../security/attemptStore.js";

export const AuthController = {
  /** Indica si el registro está abierto sin ser admin (primer usuario o ALLOW_PUBLIC_REGISTER). */
  async registrationOpen(_req, res) {
    try {
      const r = await pool.query("SELECT COUNT(*)::int AS n FROM usuarios");
      const n = r.rows[0].n;
      const open = n === 0 || config.allowPublicRegister;
      return res.json({ ok: true, open, firstUserPending: n === 0 });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  async getSalt(req, res) {
    try {
      const { userId } = req.params;
      const result = await pool.query("SELECT salt FROM usuarios WHERE user_id = $1", [userId]);
      if (!result.rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
      return res.json({ ok: true, salt: result.rows[0].salt });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  async register(req, res) {
    const {
      userId,
      nombre,
      apellido,
      vocero,
      calle,
      passwordHash,
      salt,
      pregunta1,
      pregunta2,
      respuesta1Hash,
      respuesta2Hash,
    } = req.body;

    if (!userId || !passwordHash || !salt || !nombre || !apellido || !vocero || !calle) {
      return res.status(400).json({ ok: false, message: "Faltan campos obligatorios." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(9283741654)");

      const exists = await client.query("SELECT id FROM usuarios WHERE user_id = $1", [userId]);
      if (exists.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ ok: false, message: "Ya existe una cuenta con ese usuario." });
      }

      const cnt = await client.query("SELECT COUNT(*)::int AS n FROM usuarios");
      const isFirstUser = cnt.rows[0].n === 0;

      await client.query(
        `INSERT INTO usuarios
        (user_id, nombre, apellido, vocero, calle, is_admin, password_hash, salt, pregunta1, pregunta2, respuesta1_hash, respuesta2_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          userId,
          nombre,
          apellido,
          vocero,
          calle,
          isFirstUser,
          passwordHash,
          salt,
          pregunta1,
          pregunta2,
          respuesta1Hash,
          respuesta2Hash,
        ],
      );

      await client.query("COMMIT");
      return res.json({
        ok: true,
        message: isFirstUser
          ? "Cuenta creada. Eres el administrador del sistema: inicia sesión y crea las cuentas de los voceros desde el panel."
          : "Cuenta creada.",
        isFirstUser,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* noop */
      }
      return res.status(500).json({ ok: false, message: error.message });
    } finally {
      client.release();
    }
  },

  async login(req, res) {
    try {
      const { userId, passwordHash } = req.body;
      if (!userId || !passwordHash) {
        return res.status(400).json({ ok: false, message: "Credenciales inválidas." });
      }

      const ip = getClientIp(req);
      const key = loginKey(ip, userId);

      const result = await pool.query(
        "SELECT id, user_id, nombre, apellido, vocero, calle, COALESCE(is_admin, false) AS is_admin FROM usuarios WHERE user_id = $1 AND password_hash = $2",
        [userId, passwordHash],
      );

      if (!result.rows.length) {
        const r = recordFailure(key, {
          maxFailures: securityConfig.loginMaxFailures,
          windowMs: securityConfig.loginWindowMs,
          lockoutMs: securityConfig.loginLockoutMs,
        });
        if (r.blocked) {
          return res.status(429).json({
            ok: false,
            message: `Demasiados intentos fallidos. Vuelve a intentar en ${r.retryAfterSeconds} segundos.`,
            retryAfterSeconds: r.retryAfterSeconds,
          });
        }
        return res.status(401).json({ ok: false, message: "Credenciales inválidas." });
      }

      clearAttempts(key);

      if (!config.jwtSecret) {
        return res.status(500).json({ ok: false, message: "JWT_SECRET no configurado en el servidor." });
      }

      const row = result.rows[0];
      const isAdmin = Boolean(row.is_admin);
      const accessToken = signAccessToken({
        sub: row.user_id,
        admin: isAdmin,
        consejo: row.vocero,
        calle: row.calle,
      });

      const { is_admin: _ia, ...userPublic } = row;
      return res.json({
        ok: true,
        user: { ...userPublic, is_admin: isAdmin },
        accessToken,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  /** Devuelve solo las preguntas y el salt (necesario para hashear respuestas en el cliente). */
  async recoveryQuestions(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ ok: false, message: "Usuario requerido." });
      }
      const result = await pool.query(
        "SELECT pregunta1, pregunta2, salt FROM usuarios WHERE user_id = $1",
        [userId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
      }
      const row = result.rows[0];
      return res.json({
        ok: true,
        pregunta1: row.pregunta1,
        pregunta2: row.pregunta2,
        salt: row.salt,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  /** Restablece contraseña tras validar hashes de respuestas de seguridad (misma lógica que en registro). */
  async resetPassword(req, res) {
    try {
      const { userId, respuesta1Hash, respuesta2Hash, newSalt, newPasswordHash } = req.body;
      if (!userId || !respuesta1Hash || !respuesta2Hash || !newSalt || !newPasswordHash) {
        return res.status(400).json({ ok: false, message: "Faltan datos para restablecer la contraseña." });
      }

      const result = await pool.query(
        "SELECT respuesta1_hash, respuesta2_hash FROM usuarios WHERE user_id = $1",
        [userId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
      }
      const row = result.rows[0];
      const ip = getClientIp(req);
      const key = recoveryKey(ip, userId);

      if (row.respuesta1_hash !== respuesta1Hash || row.respuesta2_hash !== respuesta2Hash) {
        const r = recordFailure(key, {
          maxFailures: securityConfig.recoveryMaxFailures,
          windowMs: securityConfig.recoveryWindowMs,
          lockoutMs: securityConfig.recoveryLockoutMs,
        });
        if (r.blocked) {
          return res.status(429).json({
            ok: false,
            message: `Demasiados intentos fallidos de recuperación. Vuelve a intentar en ${r.retryAfterSeconds} segundos.`,
            retryAfterSeconds: r.retryAfterSeconds,
          });
        }
        return res.status(401).json({ ok: false, message: "Las respuestas de seguridad no coinciden." });
      }

      await pool.query(
        "UPDATE usuarios SET password_hash = $1, salt = $2 WHERE user_id = $3",
        [newPasswordHash, newSalt, userId],
      );

      clearAttempts(key);
      return res.json({ ok: true, message: "Contraseña actualizada correctamente." });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },
};
