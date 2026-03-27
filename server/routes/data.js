import { Router } from "express";
import { pool } from "../config/db.js";
import { requireAuth, requireAdmin } from "../middlewares/authJwt.js";

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
        `SELECT h.id, h.nombre, h.apellido, h.cedula, h.telefono, h.edad, h.calle, h.nacimiento, h.es_jefe_familia, h.jefe_familia_id
         FROM habitantes h
         JOIN consejos c ON c.id = h.consejo_id
         WHERE c.nombre = $1
         ORDER BY h.created_at DESC`,
        [cn],
      );
    } else {
      result = await pool.query(
        `SELECT h.id, h.nombre, h.apellido, h.cedula, h.telefono, h.edad, h.calle, h.nacimiento, h.es_jefe_familia, h.jefe_familia_id
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

// Helper function for calculating age (assuming it's defined elsewhere or needs to be added)
function calcAge(birthdate) {
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Middleware to check if user is admin or belongs to the same consejo
async function requireAdminOrSameConsejo(req, res, next) {
  const { consejoNombre } = req.body; // Assuming consejoNombre is in body for POST
  if (!consejoNombre) {
    return res.status(400).json({ ok: false, message: "consejoNombre es requerido." });
  }

  const check = assertConsejoVocero(req.auth, encodeURIComponent(consejoNombre));
  if (!check.ok) return res.status(check.status).json({ ok: false, message: check.message });

  const consejo = await pool.query("SELECT id FROM consejos WHERE nombre = $1", [consejoNombre]);
  if (!consejo.rows.length) return res.status(404).json({ ok: false, message: "Consejo no encontrado." });
  req.locals = { consejoId: consejo.rows[0].id }; // Attach consejoId to req.locals
  next();
}

router.post("/habitantes", requireAuth, requireAdminOrSameConsejo, async (req, res) => {
  try {
    const { consejoNombre, nombre, apellido, cedula, telefono, calle, nacimiento, es_jefe_familia, jefe_familia_id } = req.body;
    let { edad } = req.body;
    if (nacimiento) {
      edad = calcAge(nacimiento);
    }

    const { consejoId } = req.locals;

    const result = await pool.query(
      `INSERT INTO habitantes (consejo_id, nombre, apellido, cedula, telefono, edad, calle, nacimiento, es_jefe_familia, jefe_familia_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [consejoId, nombre, apellido, cedula, telefono, edad || 0, calle, nacimiento || null, es_jefe_familia || false, jefe_familia_id || null],
    );
    return res.status(201).json({ ok: true, habitante: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ ok: false, message: "Esta cédula ya está registrada en este Consejo." });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// Importación Masiva Censo Familiar
router.post("/habitantes/bulk", requireAuth, async (req, res) => {
  const { consejoNombre, familias } = req.body;
  if (!familias || !Array.isArray(familias)) {
    return res.status(400).json({ ok: false, message: "Formato de datos inválido." });
  }
  
  // Re-using assertConsejoVocero for admin check, but it's named assertConsejoAdminOrVocero in the snippet.
  // Assuming assertConsejoVocero is the correct function to use here.
  const authRes = assertConsejoVocero(req.auth, consejoNombre);
  if (!authRes.ok) return res.status(authRes.status).json({ ok: false, message: authRes.message });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Obtener ID del consejo
    const cRes = await client.query("SELECT id FROM consejos WHERE nombre = $1", [consejoNombre]);
    if (!cRes.rows.length) throw new Error("Consejo comunal no encontrado.");
    const consejoId = cRes.rows[0].id;
    
    let totalInsertados = 0;
    
    for (const fam of familias) {
      const { jefe, dependientes } = fam;
      let jefeId = null;
      
      // Intentar insertar Jefe (Si falla por cédula, se rescata y seguimos para poder anclar dependientes)
      try {
        const jRes = await client.query(
          `INSERT INTO habitantes (consejo_id, nombre, apellido, cedula, telefono, edad, calle, es_jefe_familia)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (cedula, consejo_id) DO UPDATE SET telefono = EXCLUDED.telefono
           RETURNING id`,
          [consejoId, jefe.nombre, jefe.apellido, jefe.cedula || ('S/C-'+Math.random()), jefe.telefono || null, 0, jefe.calle]
        );
        jefeId = jRes.rows[0].id;
        totalInsertados++;
      } catch (err) {
        // Ignoramos si por algún error bizarro explota y continuamos
      }
      
      // Insertar familiares
      if (Array.isArray(dependientes) && jefeId) {
        for (const dep of dependientes) {
          try {
            await client.query(
               `INSERT INTO habitantes (consejo_id, nombre, apellido, cedula, telefono, edad, calle, es_jefe_familia, jefe_familia_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
               ON CONFLICT (cedula, consejo_id) DO NOTHING`,
              [consejoId, dep.nombre, dep.apellido, dep.cedula || ('S/C-'+Math.random()), dep.telefono || null, 0, dep.calle, jefeId]
            );
            totalInsertados++;
          } catch(err) {
             // skip duplicate
          }
        }
      }
    }
    
    await client.query("COMMIT");
    return res.json({ ok: true, message: "Importación finalizada", total: totalInsertados });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ ok: false, message: error.message });
  } finally {
    client.release();
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

router.put("/habitantes/:id/familia", async (req, res) => {
  try {
    const { id } = req.params;
    const { dependientesIds } = req.body;

    const row = await getHabitanteConsejoCalle(id);
    if (!row) return res.status(404).json({ ok: false, message: "Habitante ancla no encontrado." });

    if (!req.auth.admin) {
      if (row.consejo_nombre !== req.auth.consejo || row.calle !== req.auth.calle) {
         return res.status(403).json({ ok: false, message: "No posees jurisdicción sobre esta calle." });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      // Asegurar que es Jefe de familia y no tiene jefe por encima de él
      await client.query("UPDATE habitantes SET es_jefe_familia = true, jefe_familia_id = NULL WHERE id = $1", [id]);
      
      // Desenlazar todo aquel que actualmente lo tenía de jefe (para resetear el estado y evitar huérfanos retirados)
      await client.query("UPDATE habitantes SET jefe_familia_id = NULL WHERE jefe_familia_id = $1", [id]);
      
      // Re-enlazar únicamente a los nuevos ids (y quitarles su estatus de jefe de familia si lo tuviesen)
      if (dependientesIds && Array.isArray(dependientesIds) && dependientesIds.length > 0) {
        await client.query(
          "UPDATE habitantes SET es_jefe_familia = false, jefe_familia_id = $1 WHERE id = ANY($2::int[])", 
          [id, dependientesIds]
        );
      }
      
      await client.query("COMMIT");
      return res.json({ ok: true, message: "Grupo Familiar configurado exitosamente." });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/habitantes/:id/familia", async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE habitantes SET jefe_familia_id = NULL WHERE jefe_familia_id = $1", [id]);
      await client.query("UPDATE habitantes SET es_jefe_familia = false WHERE id = $1", [id]);
      await client.query("COMMIT");
      return res.json({ ok: true, message: "Grupo Familiar disuelto exitosamente." });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
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

router.delete("/jornadas/:jornadaId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { jornadaId } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM pagos WHERE jornada_id = $1", [jornadaId]);
      const del = await client.query("DELETE FROM jornadas WHERE id = $1 RETURNING id", [jornadaId]);
      if (!del.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ ok: false, message: "Jornada no encontrada." });
      }
      await client.query("COMMIT");
      return res.json({ ok: true, message: "Jornada y pagos eliminados." });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// ==========================================
// MÓDULO DE VOTACIONES
// ==========================================

router.get("/votos/habitantes", async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT c.nombre as consejo, COUNT(v.id) as total_votos
      FROM consejos c
      LEFT JOIN habitantes h ON h.consejo_id = c.id
      LEFT JOIN votos v ON v.habitante_id = h.id
      GROUP BY c.id, c.nombre
      ORDER BY c.nombre ASC
    `);
    const stats = statsRes.rows.map(r => ({ consejo: r.consejo, total: Number(r.total_votos) }));

    let habitantes;
    if (req.auth.admin) {
      const result = await pool.query(`
        SELECT h.id, h.nombre, h.apellido, h.cedula, h.calle, h.es_jefe_familia, c.nombre as consejo,
               CASE WHEN v.id IS NOT NULL THEN true ELSE false END as voto
        FROM habitantes h
        JOIN consejos c ON c.id = h.consejo_id
        LEFT JOIN votos v ON v.habitante_id = h.id
        ORDER BY c.nombre ASC, h.nombre ASC
      `);
      habitantes = result.rows;
    } else {
      const result = await pool.query(`
        SELECT h.id, h.nombre, h.apellido, h.cedula, h.calle, h.es_jefe_familia, c.nombre as consejo,
               CASE WHEN v.id IS NOT NULL THEN true ELSE false END as voto
        FROM habitantes h
        JOIN consejos c ON c.id = h.consejo_id
        LEFT JOIN votos v ON v.habitante_id = h.id
        WHERE c.nombre = $1 AND h.calle = $2
        ORDER BY h.nombre ASC
      `, [req.auth.consejo, req.auth.calle]);
      habitantes = result.rows;
    }

    return res.json({ ok: true, stats, habitantes });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/votos/:habitanteId", async (req, res) => {
  try {
    const { habitanteId } = req.params;
    const { voto } = req.body;

    const row = await getHabitanteConsejoCalle(habitanteId);
    if (!row) return res.status(404).json({ ok: false, message: "Habitante no encontrado." });
    
    if (!req.auth.admin) {
      if (row.consejo_nombre !== req.auth.consejo || row.calle !== req.auth.calle) {
        return res.status(403).json({ ok: false, message: "No puedes registrar votos fuera de tu calle." });
      }
    }

    if (voto) {
      await pool.query(
        "INSERT INTO votos (habitante_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [habitanteId]
      );
    } else {
      await pool.query(
        "DELETE FROM votos WHERE habitante_id = $1",
        [habitanteId]
      );
    }
    
    return res.json({ ok: true, message: voto ? "Voto registrado" : "Voto eliminado" });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

export default router;
