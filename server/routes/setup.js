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

export default router;

