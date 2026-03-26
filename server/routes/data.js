import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = Router();

router.use(requireAuth);

// Actualizar pago (habitante, cedula, detalle, monto)
router.put("/pagos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { habitante, cedula, detalle, monto } = req.body;
    // Buscar pago y verificar permisos
    const pagoRes = await pool.query(
      `SELECT p.id, c.nombre as consejo_nombre, h.calle, p.fecha
       FROM pagos p
       JOIN consejos c ON c.id = p.consejo_id
       JOIN habitantes h ON h.id = p.habitante_id
       WHERE p.id = $1`,
      [id],
    );
    const pago = pagoRes.rows[0];
    if (!pago) return res.status(404).json({ ok: false, message: "Pago no encontrado." });
    if (!req.auth.admin) {
      if (pago.consejo_nombre !== req.auth.consejo || pago.calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes editar este pago." });
      }
    }
    // Solo se permite editar los campos permitidos
    const result = await pool.query(
      `UPDATE pagos SET detalle = $1, monto = $2 WHERE id = $3 RETURNING id, detalle, monto, fecha`,
      [detalle, monto, id],
    );
    // NOTA: habitante y cedula solo se actualizan en la tabla de habitantes si se requiere, aquí solo se actualiza el pago
    return res.json({ ok: true, pago: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});
/** @param {import("../middlewares/authJwt.js").JwtPayload extends object} auth */
function assertConsejoVocero(auth, consejoNombre) {
  const n = decodeURIComponent(consejoNombre);
  if (!auth.admin && n !== auth.consejo) {
    return { ok: false, status: 403, message: "No tienes acceso a este consejo comunal." };
  }
  return { ok: true };
}

async function getHabitanteConsejoCalle(habitanteId) {
  const r = await pool.query(
    `SELECT h.id, h.calle, c.nombre AS consejo_nombre
     FROM habitantes h
     JOIN consejos c ON c.id = h.consejo_id
     WHERE h.id = $1`,
    [habitanteId],
  );
  return r.rows[0] || null;
}

router.get("/consejos", async (_req, res) => {
  try {
    const consejos = await pool.query("SELECT id, nombre FROM consejos ORDER BY nombre ASC");
    return res.json({ ok: true, consejos: consejos.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/habitantes/:consejoNombre", async (req, res) => {
  try {
    const { consejoNombre } = req.params;
    const check = assertConsejoVocero(req.auth, consejoNombre);
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    const cn = decodeURIComponent(consejoNombre);
    let result;
    if (req.auth.admin) {
      result = await pool.query(
        `SELECT h.id, h.nombre, h.apellido, h.cedula, h.telefono, h.edad, h.calle, h.nacimiento
         FROM habitantes h
         JOIN consejos c ON c.id = h.consejo_id
         WHERE c.nombre = $1
         ORDER BY h.created_at DESC`,
        [cn],
      );
    } else {
      result = await pool.query(
        `SELECT h.id, h.nombre, h.apellido, h.cedula, h.telefono, h.edad, h.calle, h.nacimiento
         FROM habitantes h
         JOIN consejos c ON c.id = h.consejo_id
         WHERE c.nombre = $1 AND h.calle = $2
         ORDER BY h.created_at DESC`,
        [cn, req.auth.calle],
      );
    }
    return res.json({ ok: true, habitantes: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/habitantes", async (req, res) => {
  try {
    const { consejoNombre, nombre, apellido, cedula, telefono, edad, calle, nacimiento } = req.body;
    const check = assertConsejoVocero(req.auth, encodeURIComponent(consejoNombre));
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    if (!req.auth.admin && calle !== req.auth.calle) {
      return res.status(403).json({ ok: false, message: "Solo puedes registrar habitantes de tu calle asignada." });
    }

    const consejo = await pool.query("SELECT id FROM consejos WHERE nombre = $1", [consejoNombre]);
    if (!consejo.rows.length) return res.status(404).json({ ok: false, message: "Consejo no encontrado." });

    const inserted = await pool.query(
      `INSERT INTO habitantes (consejo_id, nombre, apellido, cedula, telefono, edad, calle, nacimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nombre, apellido, cedula, telefono, edad, calle, nacimiento`,
      [consejo.rows[0].id, nombre, apellido, cedula, telefono || null, edad, calle, nacimiento || null],
    );

    return res.json({ ok: true, habitante: inserted.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ ok: false, message: "Ya existe un habitante con esa cédula en este consejo." });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/habitantes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, cedula, telefono, edad, calle, nacimiento } = req.body;

    const row = await getHabitanteConsejoCalle(id);
    if (!row) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });

    if (!req.auth.admin) {
      if (row.consejo_nombre !== req.auth.consejo || row.calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes modificar este habitante." });
      }
      if (calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes cambiar la calle del habitante." });
      }
    }

    const result = await pool.query(
      `UPDATE habitantes SET nombre = $1, apellido = $2, cedula = $3, telefono = $4, edad = $5, calle = $6, nacimiento = $7
       WHERE id = $8
       RETURNING id, nombre, apellido, cedula, telefono, edad, calle, nacimiento`,
      [nombre, apellido, cedula, telefono || null, edad, calle, nacimiento || null, id],
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });
    return res.json({ ok: true, habitante: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ ok: false, message: "Ya existe un habitante con esa cédula en este consejo." });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/habitantes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const row = await getHabitanteConsejoCalle(id);
    if (!row) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });

    if (!req.auth.admin) {
      if (row.consejo_nombre !== req.auth.consejo || row.calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes eliminar este habitante." });
      }
    }

    const result = await pool.query("DELETE FROM habitantes WHERE id = $1 RETURNING id", [id]);
    if (!result.rows.length) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });
    return res.json({ ok: true, message: "Habitante eliminado." });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar: tiene pagos asociados. Elimina primero los pagos.",
      });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/pagos/:consejoNombre", async (req, res) => {
  try {
    const { consejoNombre } = req.params;
    const check = assertConsejoVocero(req.auth, consejoNombre);
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    const cn = decodeURIComponent(consejoNombre);
    let result;
    if (req.auth.admin) {
      result = await pool.query(
        `SELECT p.id, p.servicio, p.detalle, p.monto, p.fecha, h.cedula,
                (h.nombre || ' ' || h.apellido) as habitante
         FROM pagos p
         JOIN consejos c ON c.id = p.consejo_id
         JOIN habitantes h ON h.id = p.habitante_id
         WHERE c.nombre = $1
         ORDER BY p.fecha DESC`,
        [cn],
      );
    } else {
      result = await pool.query(
        `SELECT p.id, p.servicio, p.detalle, p.monto, p.fecha, h.cedula,
                (h.nombre || ' ' || h.apellido) as habitante
         FROM pagos p
         JOIN consejos c ON c.id = p.consejo_id
         JOIN habitantes h ON h.id = p.habitante_id
         WHERE c.nombre = $1 AND h.calle = $2
         ORDER BY p.fecha DESC`,
        [cn, req.auth.calle],
      );
    }
    return res.json({ ok: true, pagos: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/pagos", async (req, res) => {
  try {
    const { consejoNombre, habitanteId, servicio, detalle, monto } = req.body;
    const check = assertConsejoVocero(req.auth, encodeURIComponent(consejoNombre));
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    const hRow = await getHabitanteConsejoCalle(habitanteId);
    if (!hRow) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });
    if (hRow.consejo_nombre !== consejoNombre) {
      return res.status(400).json({ ok: false, message: "El habitante no pertenece a este consejo." });
    }
    if (!req.auth.admin && hRow.calle !== req.auth.calle) {
      return res.status(403).json({ ok: false, message: "Solo puedes registrar pagos de habitantes de tu calle." });
    }

    const consejo = await pool.query("SELECT id FROM consejos WHERE nombre = $1", [consejoNombre]);
    if (!consejo.rows.length) return res.status(404).json({ ok: false, message: "Consejo no encontrado." });

    const inserted = await pool.query(
      `INSERT INTO pagos (consejo_id, habitante_id, servicio, detalle, monto)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, servicio, detalle, monto, fecha`,
      [consejo.rows[0].id, habitanteId, servicio, detalle, monto],
    );

    return res.json({ ok: true, pago: inserted.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});


// Eliminar pago
router.delete("/pagos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Buscar pago y verificar permisos
    const pagoRes = await pool.query(
      `SELECT p.id, c.nombre as consejo_nombre, h.calle
       FROM pagos p
       JOIN consejos c ON c.id = p.consejo_id
       JOIN habitantes h ON h.id = p.habitante_id
       WHERE p.id = $1`,
      [id],
    );
    const pago = pagoRes.rows[0];
    if (!pago) return res.status(404).json({ ok: false, message: "Pago no encontrado." });
    if (!req.auth.admin) {
      if (pago.consejo_nombre !== req.auth.consejo || pago.calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes eliminar este pago." });
      }
    }
    const del = await pool.query("DELETE FROM pagos WHERE id = $1 RETURNING id", [id]);
    if (!del.rows.length) return res.status(404).json({ ok: false, message: "Pago no encontrado." });
    return res.json({ ok: true, message: "Pago eliminado." });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// --- JORNADAS ---
router.get("/jornadas/:consejoNombre", async (req, res) => {
  try {
    const { consejoNombre } = req.params;
    const check = assertConsejoVocero(req.auth, consejoNombre);
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    const cn = decodeURIComponent(consejoNombre);
    const result = await pool.query(
      `SELECT j.*, 
        (SELECT COUNT(*) FROM pagos p WHERE p.jornada_id = j.id) as total_hab,
        (SELECT SUM(monto) FROM pagos p WHERE p.jornada_id = j.id) as total_recaudado
       FROM jornadas j
       JOIN consejos c ON c.id = j.consejo_id
       WHERE c.nombre = $1
       ORDER BY j.fecha_entrega DESC`,
      [cn]
    );
    return res.json({ ok: true, jornadas: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/jornadas", async (req, res) => {
  try {
    const { consejoNombre, servicio, fecha_entrega, pagos } = req.body;
    const check = assertConsejoVocero(req.auth, encodeURIComponent(consejoNombre));
    if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const consejo = await client.query("SELECT id FROM consejos WHERE nombre = $1", [consejoNombre]);
      if (!consejo.rows.length) throw new Error("Consejo no encontrado.");
      const consejoId = consejo.rows[0].id;

      const jRes = await client.query(
        `INSERT INTO jornadas (consejo_id, servicio, fecha_entrega) VALUES ($1, $2, $3) RETURNING id`,
        [consejoId, servicio, fecha_entrega]
      );
      const jornadaId = jRes.rows[0].id;

      for (const p of pagos) {
        if (Number(p.monto) > 0 || p.detalle) {
          const hRes = await client.query(
            `SELECT h.id, h.calle FROM habitantes h WHERE h.id = $1 AND h.consejo_id = $2`,
            [p.habitanteId, consejoId]
          );
          if (!hRes.rows.length) continue;
          if (!req.auth.admin && hRes.rows[0].calle !== req.auth.calle) continue;

          await client.query(
            `INSERT INTO pagos (consejo_id, habitante_id, jornada_id, servicio, detalle, monto)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [consejoId, p.habitanteId, jornadaId, servicio, p.detalle || '', p.monto]
          );
        }
      }

      await client.query('COMMIT');
      return res.json({ ok: true, message: "Jornada registrada correctamente." });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

export default router;
