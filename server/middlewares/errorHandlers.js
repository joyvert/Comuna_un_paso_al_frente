export function errorHandler(err, req, res, next) {
  console.error("Error:", err);
  res.status(500).json({ ok: false, message: err.message || "Error interno del servidor" });
}

export function notFoundHandler(req, res, next) {
  res.status(404).json({ ok: false, message: "Ruta no encontrada" });
}
