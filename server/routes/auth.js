import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/salt/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query("SELECT salt FROM usuarios WHERE user_id = $1", [userId]);
    if (!result.rows.length) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    return res.json({ ok: true, salt: result.rows[0].salt });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
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

    const exists = await pool.query("SELECT id FROM usuarios WHERE user_id = $1", [userId]);
    if (exists.rows.length) {
      return res.status(409).json({ ok: false, message: "Ya existe una cuenta con ese usuario." });
    }

    await pool.query(
      `INSERT INTO usuarios
      (user_id, nombre, apellido, vocero, calle, password_hash, salt, pregunta1, pregunta2, respuesta1_hash, respuesta2_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [userId, nombre, apellido, vocero, calle, passwordHash, salt, pregunta1, pregunta2, respuesta1Hash, respuesta2Hash],
    );

    return res.json({ ok: true, message: "Cuenta creada." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { userId, passwordHash } = req.body;
    if (!userId || !passwordHash) {
      return res.status(400).json({ ok: false, message: "Credenciales inválidas." });
    }

    const result = await pool.query(
      "SELECT id, user_id, nombre, apellido FROM usuarios WHERE user_id = $1 AND password_hash = $2",
      [userId, passwordHash],
    );

    if (!result.rows.length) {
      return res.status(401).json({ ok: false, message: "Credenciales inválidas." });
    }

    return res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

export default router;

