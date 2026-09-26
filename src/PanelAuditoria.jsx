import React, { useState, useEffect, useCallback } from "react";
import { 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  Search, 
  Clock, 
  Activity, 
  AlertCircle
} from "lucide-react";
import { api } from "./api";

export default function PanelAuditoria({ onMessage }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduloFiltro, setModuloFiltro] = useState("TODOS");
  const [confirmPurge, setConfirmPurge] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAuditoria(150);
      setLogs(res.logs || []);
    } catch (err) {
      onMessage?.({ type: "error", text: err.message || "Error al cargar registros de auditoría." });
    } finally {
      setLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handlePurge = async () => {
    setConfirmPurge(false);
    try {
      await api.limpiarAuditoria();
      onMessage?.({ type: "success", text: "Historial de auditoría purgado correctamente." });
      await loadLogs();
    } catch (err) {
      onMessage?.({ type: "error", text: err.message || "Error al purgar historial." });
    }
  };

  const modulosDisponibles = ["TODOS", ...new Set(logs.map(l => l.modulo).filter(Boolean))];

  const logsFiltrados = logs.filter(l => {
    const matchModulo = moduloFiltro === "TODOS" || l.modulo === moduloFiltro;
    const q = search.toLowerCase();
    const matchSearch = !search || 
      (l.accion || "").toLowerCase().includes(q) ||
      (l.detalle || "").toLowerCase().includes(q) ||
      (l.usuario_nombre || "").toLowerCase().includes(q) ||
      (l.usuario_id || "").toLowerCase().includes(q);
    return matchModulo && matchSearch;
  });

  const getBadgeColor = (accion) => {
    if (accion.includes("ELIMINAR") || accion.includes("PURGAR") || accion.includes("REVOCAR")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (accion.includes("PROMOVER") || accion.includes("ADMIN")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (accion.includes("CREAR") || accion.includes("REGISTRAR") || accion.includes("CARGA")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    return "bg-cyan-50 text-cyan-700 border-cyan-200";
  };

  return (
    <div className="space-y-6">
      {/* Header del módulo */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg">
              <ShieldAlert size={18} />
            </span>
            <h3 className="text-lg font-bold font-heading">Control y Auditoría de Seguridad</h3>
          </div>
          <p className="text-xs text-slate-300">
            Registro cronológico inmutable de acciones realizadas en el sistema (cambios de roles, altas, bajas y modificaciones).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            title="Recargar registros"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Vaciar historial antiguo"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Purgar</span>
          </button>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por usuario, acción o detalle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
          />
        </div>

        <div>
          <select
            value={moduloFiltro}
            onChange={(e) => setModuloFiltro(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition font-medium text-slate-700 cursor-pointer"
          >
            {modulosDisponibles.map(m => (
              <option key={m} value={m}>Módulo: {m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Registros */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin text-cyan-600" />
          <span>Cargando registro de auditoría...</span>
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Activity size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold">No se encontraron eventos registrados.</p>
          <p className="text-xs mt-1">Los movimientos de los usuarios aparecerán aquí en tiempo real.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Vista Escritorio */}
          <div className="hidden md:block overflow-hidden border border-slate-200 rounded-2xl shadow-xs">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logsFiltrados.map((log) => {
                  const fecha = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {fecha.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{log.usuario_nombre}</span>
                          <span className="text-[10px] text-slate-400">@{log.usuario_id} • {log.usuario_rol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${getBadgeColor(log.accion || "")}`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                        {log.modulo}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {log.detalle}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil (Tarjetas) */}
          <div className="block md:hidden space-y-2.5">
            {logsFiltrados.map((log) => {
              const fecha = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
              return (
                <div key={log.id} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] border ${getBadgeColor(log.accion || "")}`}>
                      {log.accion}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      {fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {log.detalle}
                  </p>

                  <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-50 text-slate-500">
                    <span className="font-medium text-slate-700">Por: <strong>{log.usuario_nombre}</strong></span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-600">{log.modulo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal confirmación de purga */}
      {confirmPurge && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h4 className="text-base font-bold text-slate-800">¿Vaciar registro de auditoría?</h4>
            <p className="text-xs text-slate-500">
              Esta acción eliminará los eventos históricos almacenados. Se creará un nuevo evento registrando esta purga.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePurge}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 shadow-sm"
              >
                Sí, vaciar historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
