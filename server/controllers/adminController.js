import { pool } from "../config/db.js";

export const AdminController = {
  async listVoceros(_req, res) {
    try {
      const result = await pool.query(
        `SELECT user_id, nombre, apellido, telefono, vocero, calle, is_admin, pregunta1, pregunta2, created_at
         FROM usuarios
         ORDER BY created_at DESC`,
      );
      return res.json({ ok: true, voceros: result.rows });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  async createVocero(req, res) {
    try {
      const {
        userId,
        nombre,
        apellido,
        telefono,
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

      const exists = await pool.query("SELECT id FROM usuarios WHERE user_id = $1", [userId]);
      if (exists.rows.length) {
        return res.status(409).json({ ok: false, message: "Ya existe una cuenta con ese usuario." });
      }

      await pool.query(
        `INSERT INTO usuarios
        (user_id, nombre, apellido, telefono, vocero, calle, is_admin, password_hash, salt, pregunta1, pregunta2, respuesta1_hash, respuesta2_hash)
        VALUES ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12)`,
        [userId, nombre, apellido, telefono || null, vocero, calle, passwordHash, salt, pregunta1, pregunta2, respuesta1Hash, respuesta2Hash],
      );

      return res.json({ ok: true, message: "Cuenta de vocero creada." });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  async updateVocero(req, res) {
    try {
      const { userId } = req.params;
      const { nombre, apellido, telefono, vocero, calle } = req.body;
      if (!nombre || !apellido || !vocero || !calle) {
        return res.status(400).json({ ok: false, message: "Nombre, apellido, consejo y calle son obligatorios." });
      }

      const target = await pool.query("SELECT is_admin FROM usuarios WHERE user_id = $1", [userId]);
      if (!target.rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
      if (target.rows[0].is_admin && req.auth.sub !== userId) {
        return res.status(403).json({ ok: false, message: "No puedes modificar datos de otro administrador." });
      }

      await pool.query(
        `UPDATE usuarios SET nombre = $1, apellido = $2, telefono = $3, vocero = $4, calle = $5 WHERE user_id = $6`,
        [nombre, apellido, telefono || null, vocero, calle, userId],
      );

      return res.json({ ok: true, message: "Vocero actualizado." });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },

  async resetVoceroPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newSalt, newPasswordHash } = req.body;
      if (!newSalt || !newPasswordHash) {
        return res.status(400).json({ ok: false, message: "Faltan nueva sal y hash de contraseña." });
      }

      const target = await pool.query("SELECT is_admin FROM usuarios WHERE user_id = $1", [userId]);
      if (!target.rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
      if (target.rows[0].is_admin && req.auth.sub !== userId) {
        return res.status(403).json({ ok: false, message: "Solo el propio administrador puede cambiar su contraseña aquí." });
      }

      await pool.query(`UPDATE usuarios SET password_hash = $1, salt = $2 WHERE user_id = $3`, [
        newPasswordHash,
        newSalt,
        userId,
      ]);

      return res.json({ ok: true, message: "Contraseña restablecida." });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  },
};
