import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../config/db.js";

const router = Router();

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

router.post("/init-db", async (_req, res) => {
  try {
    const schemaPath = join(__dirname, "..", "sql", "schema.sql");
    const sql = await readFile(schemaPath, "utf8");
    await pool.query(sql);
    res.json({ ok: true, message: "Base de datos inicializada correctamente." });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/init-db", async (_req, res) => {
  try {
    const schemaPath = join(__dirname, "..", "sql", "schema.sql");
    const sql = await readFile(schemaPath, "utf8");
    await pool.query(sql);
    res.send("<h1>Éxito: Base de datos inicializada correctamente.</h1><p>Ya puedes volver al sistema.</p>");
  } catch (error) {
    res.status(500).send("<h1>Error al inicializar</h1><p>" + error.message + "</p>");
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
