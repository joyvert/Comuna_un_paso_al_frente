import { useState, useEffect, useMemo } from "react";
import { Search, Save, History, X } from "lucide-react";
import { api } from "./api";

export default function Votaciones({ sessionUser, inputClass, onMessage, calles = [] }) {
  const [data, setData] = useState({ stats: [], habitantes: [], historial: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [calleFilter, setCalleFilter] = useState("Todas");
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitulo, setSaveTitulo] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedStats, setSelectedStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [res, histRes] = await Promise.all([
        api.getVotaciones(),
        api.getVotacionesHistorial()
      ]);
      const normalizedHabitantes = (res.habitantes || []).map((h) => {
        const call = (h.calle || "").trim();
        const matched = calles.find((c) => c.toLowerCase() === call.toLowerCase());
        return { ...h, calle: matched || call };
      });
      setData({ 
        stats: res.stats || [], 
        habitantes: normalizedHabitantes,
        historial: histRes.historial || []
      });
    } catch (err) {
      onMessage?.({ type: "error", text: "Error cargando votaciones: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  const handleToggleVoto = async (h) => {
    const nuevoEstado = !h.voto;
    setData((prev) => {
      const newHab = prev.habitantes.map((x) => (x.id === h.id ? { ...x, voto: nuevoEstado } : x));
      
      const newStats = prev.stats.map(s => {
        if (s.consejo === h.consejo) {
          const sCopy = { ...s, total: s.total + (nuevoEstado ? 1 : -1) };
          if (sCopy.calles) {
            sCopy.calles = sCopy.calles.map(c => {
               if (c.nombre === h.calle) {
                 return { ...c, total: c.total + (nuevoEstado ? 1 : -1) };
               }
               return c;
            });
          }
          return sCopy;
        }
        return s;
      });

      return { ...prev, habitantes: newHab, stats: newStats };
    });

    try {
      await api.toggleVoto(h.id, nuevoEstado);
    } catch (err) {
      onMessage?.({ type: "error", text: err.message });
      loadData(); 
    }
  };

  const handleSaveHistorial = async (e) => {
    e.preventDefault();
    if (!saveTitulo.trim()) {
      onMessage?.({ type: "error", text: "El título es obligatorio." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.saveVotacionesHistorial({
        titulo: saveTitulo,
        consejoNombre: sessionUser.vocero,
        calle: sessionUser.calle
      });
      onMessage?.({ type: "success", text: res.message });
      setShowSaveModal(false);
      setSaveTitulo("");
      await loadData();
    } catch (err) {
      onMessage?.({ type: "error", text: "Error al guardar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const callesDisponibles = useMemo(() => {
    const set = new Set(data.habitantes.map((h) => h.calle));
    return Array.from(set).sort();
  }, [data.habitantes]);

  const filtrados = useMemo(() => {
    let list = data.habitantes;
    if (calleFilter !== "Todas") {
      list = list.filter((h) => h.calle === calleFilter);
    }
    if (search.trim()) {
      const normalize = (str) =>
        (str || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const searchTerms = normalize(search).split(/\s+/).filter(Boolean);

      list = list.filter((h) => {
        const fullText = normalize(`${h.nombre} ${h.apellido} ${h.cedula}`);
        return searchTerms.every((term) => fullText.includes(term));
      });
    }
    return list;
  }, [data.habitantes, calleFilter, search]);

  const totalVotosGlobal = data.stats.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="flex-1 w-full">
          <h2 className="mb-4 text-xl font-bold text-[#0f2847]">Estadísticas de Votación</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-blue-800 text-center leading-tight mb-1">Total Global</span>
              <span className="text-3xl font-bold text-blue-900">{totalVotosGlobal}</span>
            </div>
            {data.stats.map(s => (
              <div 
                key={s.consejo} 
                onClick={() => sessionUser?.isAdmin && setSelectedStats(s)}
                className={`rounded-xl bg-slate-50 p-4 border border-slate-200 flex flex-col items-center justify-center ${sessionUser?.isAdmin ? 'cursor-pointer hover:bg-slate-100 hover:border-blue-300 transition-colors shadow-sm' : ''}`}
                title={sessionUser?.isAdmin ? "Clic para ver desglose por calle" : ""}
              >
                <span className="text-sm font-medium text-slate-600 text-center leading-tight mb-1">{s.consejo}</span>
                <span className="text-2xl font-bold text-slate-800">{s.total}</span>
              </div>
            ))}
          </div>
        </div>
        
        {!sessionUser?.isAdmin && sessionUser?.calle && (
           <div className="shrink-0 flex flex-col gap-2 bg-[#0f2847]/5 p-4 rounded-xl border border-[#0f2847]/10 w-full md:w-auto">
             <span className="text-sm font-semibold text-[#0f2847] flex items-center gap-2">
               <History size={16}/> Cierre de Votación
             </span>
             <p className="text-xs text-slate-500 max-w-xs mb-1">Guarda el número de votantes actuales de tu calle y limpia la lista para un nuevo registro.</p>
             <button
               type="button"
               onClick={() => setShowSaveModal(true)}
               className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f2847] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#15345c]"
             >
               <Save size={16} /> Guardar Historial
             </button>
           </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm">
          <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Buscar habitante (nombre/cédula)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Ej. Juan Pérez o 12345678"
              className={`${inputClass} pl-10`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {sessionUser?.isAdmin && callesDisponibles.length > 0 && (
          <div className="w-full max-w-[200px]">
            <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Filtrar por Calle</label>
            <select
              className={inputClass}
              value={calleFilter}
              onChange={(e) => setCalleFilter(e.target.value)}
            >
              <option value="Todas">Todas las calles</option>
              {callesDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <span className="text-sm text-slate-500 ml-auto mb-2 font-medium">
          Habitantes listados: {filtrados.length}
        </span>
      </div>

      {loading ? (
        <p className="text-slate-500 py-10 text-center">Cargando datos de votación...</p>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-xl border border-slate-200 bg-white relative shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#0f2847] text-white sticky top-0 z-10 shadow-md">
              <tr>
                <th className="p-3 w-20 text-center">Voto</th>
                <th className="p-3">Habitante (Nombre Completo)</th>
                <th className="p-3">Cédula</th>
                <th className="p-3">Calle de Residencia</th>
                {sessionUser?.isAdmin && <th className="p-3 border-l border-white/20">Consejo Comunal</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={sessionUser?.isAdmin ? 5 : 4} className="p-6 text-center text-slate-400">
                    No se encontraron resultados para la búsqueda actual.
                  </td>
                </tr>
              ) : (
                filtrados.map((h) => (
                  <tr key={h.id} className={`transition-colors ${h.voto ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-slate-50/80"}`}>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleVoto(h)}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          h.voto
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30 shadow-md"
                            : "bg-white border-slate-300 text-transparent hover:border-emerald-400 hover:bg-emerald-50"
                        }`}
                      >
                        <svg className="w-4 h-4 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </td>
                    <td className={`p-3 font-medium ${h.voto ? "text-emerald-900" : "text-slate-800"}`}>
                      {h.nombre} {h.apellido}
                    </td>
                    <td className="p-3 text-slate-500">{h.cedula}</td>
                    <td className="p-3 text-slate-500">{h.calle}</td>
                    {sessionUser?.isAdmin && (
                      <td className="p-3 border-l border-slate-100 text-xs text-slate-500 bg-slate-50/50 uppercase tracking-widest font-medium">
                        {h.consejo}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla Historial */}
      {data.historial.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 mt-8">
          <h2 className="mb-4 text-xl font-bold text-[#0f2847] flex items-center gap-2">
             <History size={20} /> Historial de Cierres de Votación
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Fecha del Registro</th>
                    <th className="px-4 py-3">Evento / Título</th>
                    <th className="px-4 py-3">Consejo Comunal</th>
                    <th className="px-4 py-3">Calle</th>
                    <th className="px-4 py-3 text-right">Cantidad de Votos</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {data.historial.map((h, i) => (
                    <tr key={h.id || i} className="hover:bg-slate-50">
                       <td className="px-4 py-3 whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</td>
                       <td className="px-4 py-3 font-medium text-slate-900">{h.titulo}</td>
                       <td className="px-4 py-3">{h.consejo}</td>
                       <td className="px-4 py-3">{h.calle}</td>
                       <td className="px-4 py-3 text-right font-bold text-[#0f2847]">{h.cantidad_votos}</td>
                    </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Desglose Stats */}
      {selectedStats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
           <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl relative">
              <button 
                className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-100 text-slate-500"
                onClick={() => setSelectedStats(null)}
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-bold text-[#0f2847] mb-1">Desglose de Votos</h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">Consejo: {selectedStats.consejo}</p>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                 {(!selectedStats.calles || selectedStats.calles.length === 0) ? (
                   <p className="text-center text-sm text-slate-400 py-4">No hay votos registrados en las calles.</p>
                 ) : (
                   selectedStats.calles.map(c => (
                     <div key={c.nombre} className="flex justify-between items-center bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <span className="font-medium text-slate-700">{c.nombre}</span>
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-sm">{c.total} votos</span>
                     </div>
                   ))
                 )}
              </div>
              <div className="mt-6 pt-4 border-t flex justify-between items-center">
                 <span className="font-bold text-slate-500">Total</span>
                 <span className="text-xl font-bold text-[#0f2847]">{selectedStats.total}</span>
              </div>
           </div>
        </div>
      )}

      {/* Modal Guardar Historial */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
           <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl relative">
              <h3 className="text-xl font-bold text-[#0f2847] mb-2 flex items-center gap-2">
                <Save size={20} /> Guardar Votación
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Se registrará un reporte con <strong>todos los votos tildados actualmente</strong> en tu calle. 
                Luego, <strong>todos los checks se borrarán automáticamente</strong> para la siguiente elección.
              </p>
              <form onSubmit={handleSaveHistorial}>
                 <div className="mb-4">
                   <label className="block text-xs font-bold text-slate-700 mb-1">Título de la Votación / Evento</label>
                   <input 
                     className={inputClass}
                     placeholder="Ej: Elecciones 2026, Consulta Popular..."
                     value={saveTitulo}
                     onChange={e => setSaveTitulo(e.target.value)}
                     autoFocus
                   />
                 </div>
                 <div className="flex gap-3 justify-end mt-6">
                    <button 
                      type="button" 
                      onClick={() => setShowSaveModal(false)}
                      className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={saving || !saveTitulo.trim()}
                      className="px-4 py-2 font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Confirmar y Reiniciar"}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
