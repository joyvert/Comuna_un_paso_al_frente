import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../config/db.js";

const router = Router();

router.post("/init-db", async (_req, res) => {
  try {
    const schemaPath = resolve(process.cwd(), "server", "sql", "schema.sql");
    const sql = await readFile(schemaPath, "utf8");
    await pool.query(sql);
    res.json({ ok: true, message: "Base de datos inicializada correctamente." });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "No se pudo inicializar la base de datos.",
      error: error.message,
    });
  }
});

router.get("/wipe-familias", async (req, res) => {
  if (req.query.key !== "joyvert2026") return res.status(403).send("No Auth");
  try {
    await pool.query("UPDATE habitantes SET es_jefe_familia = false, jefe_familia_id = NULL");
    return res.json({ ok: true, message: "Familias reseteadas con éxito en BD Producción." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
