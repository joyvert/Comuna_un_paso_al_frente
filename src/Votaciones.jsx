import { useState, useEffect, useMemo } from "react";
import { Search, Save, History, X, Trash2, Play, Lock } from "lucide-react";
import { api } from "./api";

export default function Votaciones({ sessionUser, inputClass, onMessage, calles = [] }) {
  const [data, setData] = useState({ stats: [], habitantes: [], historial: [] });
  const [tab, setTab] = useState("votacion"); // "votacion" | "historial"
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [calleFilter, setCalleFilter] = useState("Todas");
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStats, setSelectedStats] = useState(null);

  const [globalElectionTitle, setGlobalElectionTitle] = useState(null);
  const [activeElectionTitle, setActiveElectionTitle] = useState(() => localStorage.getItem("comuna_active_election") || "");
  const [showStartModal, setShowStartModal] = useState(false);
  const [startTitulo, setStartTitulo] = useState("");
  const [adminSettingTitle, setAdminSettingTitle] = useState(false);
  const [showCloseGlobalElectionModal, setShowCloseGlobalElectionModal] = useState(false);

  useEffect(() => {
    loadData();
    
    // Polling silencioso cada 12 segundos para actualizar las estadísticas en tiempo real
    const timer = setInterval(async () => {
      try {
        const [res, config] = await Promise.all([
          api.getVotaciones(),
          api.getElectionConfig()
        ]);
        setGlobalElectionTitle(config.active_election_title);
        setData(prev => {
          // Solo actualizamos estadísticas para no interrumpir si el usuario está interactuando con la tabla
          return { ...prev, stats: res.stats || [] };
        });
      } catch (e) {
        // Fallos silenciosos en el polling
      }
    }, 12000);
    
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [res, histRes, configRes] = await Promise.all([
        api.getVotaciones(),
        api.getVotacionesHistorial(),
        api.getElectionConfig()
      ]);
      setGlobalElectionTitle(configRes.active_election_title);
      const normalizedHabitantes = (res.habitantes || []).map((h) => {
        const call = (h.calle || "").trim();
        const lower = call.toLowerCase();
        let matched = "";
        if (lower.includes("esperaza") || lower.includes("esperanza")) matched = "Calle principal La Esperanza";
        else if (lower.includes("fe integral")) matched = "Calle la fe integral";
        else if (lower.includes("portugueses")) matched = "Los Portugueses";
        else if (lower.includes("peñas") || lower.includes("penas")) matched = "Los Peñas";
        else if (lower.includes("acequia")) matched = "La Acequia";
        return { ...h, calle: matched || call };
      });
      const computedHistorial = (histRes.historial || []).map(h => {
        let dateObj = new Date();
        if (h.createdAt?.seconds) {
           dateObj = new Date(h.createdAt.seconds * 1000);
        } else if (h.createdAt) {
           dateObj = new Date(h.createdAt);
        }
        return {
           ...h,
           created_at: dateObj.toISOString(),
        };
      });

      setData({ 
        stats: res.stats || [], 
        habitantes: normalizedHabitantes,
        historial: computedHistorial
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

  const handleStartElection = async (e) => {
    e.preventDefault();
    if (sessionUser?.isAdmin) {
      const tituloTrim = startTitulo.trim();
      if (!tituloTrim) {
        onMessage?.({ type: "error", text: "El título es obligatorio para aperturar la votación." });
        return;
      }
      setAdminSettingTitle(true);
      try {
        await api.setElectionConfig(tituloTrim);
        setGlobalElectionTitle(tituloTrim);
        setActiveElectionTitle(tituloTrim);
        localStorage.setItem("comuna_active_election", tituloTrim);
        setShowStartModal(false);
        onMessage?.({ type: "success", text: "Jornada global aperturada con éxito." });
      } catch (err) {
        onMessage?.({ type: "error", text: "Error: " + err.message });
      } finally {
        setAdminSettingTitle(false);
      }
    } else {
      // Vocero accepting the global election
      if (!globalElectionTitle) return;
      setActiveElectionTitle(globalElectionTitle);
      localStorage.setItem("comuna_active_election", globalElectionTitle);
      setShowStartModal(false);
    }
  };

  const handleCloseGlobalElection = () => {
    setShowCloseGlobalElectionModal(true);
  };

  const confirmCloseGlobalElection = async () => {
    setShowCloseGlobalElectionModal(false);
    try {
      await api.closeGlobalElection(activeElectionTitle || globalElectionTitle);
      setGlobalElectionTitle(null);
      setActiveElectionTitle("");
      localStorage.removeItem("comuna_active_election");
      onMessage?.({ type: "success", text: "Jornada electoral global ha sido cerrada y los votos se han reiniciado." });
      await loadData();
    } catch (err) {
      onMessage?.({ type: "error", text: "Error: " + err.message });
    }
  };

  const handleSaveHistorial = async (e) => {
    e.preventDefault();
    if (!activeElectionTitle) return;
    
    setSaving(true);
    try {
      const res = await api.saveVotacionesHistorial({
        titulo: activeElectionTitle,
        consejoNombre: sessionUser.vocero,
        calle: sessionUser.calle
      });
      onMessage?.({ type: "success", text: res.message });
      setShowSaveModal(false);
      
      // Cerradura local
      setActiveElectionTitle("");
      localStorage.removeItem("comuna_active_election");
      
      await loadData();
    } catch (err) {
      onMessage?.({ type: "error", text: "Error al guardar: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistorial = async (id) => {
    if (!window.confirm("¿Segurísimo que quieres eliminar este historial de votación?")) return;
    try {
      setLoading(true);
      const res = await api.deleteVotacionesHistorial(id);
      onMessage?.({ type: "success", text: res.message });
      await loadData();
    } catch (err) {
      onMessage?.({ type: "error", text: "Error al eliminar: " + err.message });
      setLoading(false);
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
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab("votacion")}
          className={`px-4 py-2 font-medium transition-colors ${tab === "votacion" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500 hover:text-slate-800"}`}
        >
          Panel de Votación
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`px-4 py-2 font-medium transition-colors ${tab === "historial" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500 hover:text-slate-800"}`}
        >
          Historial de Elecciones
        </button>
      </div>

      {tab === "votacion" && (
        <div className="space-y-6">
          {sessionUser?.isAdmin && (
            <div className={`p-4 rounded-xl shadow-sm border flex items-center justify-between ${globalElectionTitle ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <h3 className={`font-bold ${globalElectionTitle ? 'text-emerald-800' : 'text-slate-700'}`}>
                  Panel de Control Global Electoral
                </h3>
                <p className="text-sm mt-1 text-slate-600">
                  {globalElectionTitle 
                    ? <span>Estado: <strong className="text-emerald-700">Elección Activa</strong> ({globalElectionTitle})</span>
                    : <span>Estado: <strong>Cerrado</strong>. Los voceros no pueden iniciar mesas.</span>
                  }
                </p>
              </div>
              <div>
                {globalElectionTitle ? (
                  <button 
                    onClick={handleCloseGlobalElection}
                    className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold px-4 py-2 rounded-lg transition"
                  >
                    Cerrar Jornada Global
                  </button>
                ) : (
                  <button 
                    onClick={() => { setStartTitulo(""); setShowStartModal(true); }}
                    className="bg-[#0f2847] text-white hover:bg-[#15345c] font-bold px-4 py-2 rounded-lg transition"
                  >
                    Aperturar Jornada Global
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="flex-1 w-full">
          <h2 className="mb-4 text-xl font-bold text-[#0f2847]">Estadísticas de Votación</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {sessionUser?.isAdmin && (
              <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 flex flex-col items-center justify-center">
                <span className="text-sm font-medium text-blue-800 text-center leading-tight mb-1">Total Global</span>
                <span className="text-3xl font-bold text-blue-900">{totalVotosGlobal}</span>
              </div>
            )}
            
            {data.stats
              .filter(s => sessionUser?.isAdmin || s.consejo === sessionUser?.vocero)
              .map(s => (
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
        
        {!sessionUser?.isAdmin && sessionUser?.calle && activeElectionTitle && (
           <div className="shrink-0 flex flex-col gap-2 bg-[#0f2847]/5 p-4 rounded-xl border border-[#0f2847]/10 w-full md:w-auto">
             <span className="text-sm font-semibold text-[#0f2847] flex items-center gap-2">
               <History size={16}/> Cierre de Votación
             </span>
             <p className="text-xs text-slate-500 max-w-xs mb-1">Guarda el número de votantes actuales de tu calle y limpia la lista.</p>
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

        <span className="text-sm text-slate-500 ml-auto mb-2 font-medium flex gap-4 items-center">
          {activeElectionTitle && (
             <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-md border border-blue-100 flex items-center gap-2 font-bold shadow-sm">
               <Lock size={14} className="text-blue-600" /> Jornada: {activeElectionTitle}
             </span>
          )}
          <span>Habitantes listados: {filtrados.length}</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Han votado: {filtrados.filter(h => h.voto).length}</span>
        </span>
      </div>

      {loading ? (
        <p className="text-slate-500 py-10 text-center">Cargando datos de votación...</p>
      ) : (
        <div className="relative">
          <div className={`overflow-x-auto overflow-y-auto max-h-[600px] rounded-xl border border-slate-200 bg-white relative shadow-sm transition-all duration-300 ${!activeElectionTitle ? "opacity-30 pointer-events-none select-none blur-[1px]" : ""}`}>
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
          
          {/* Overlay de Apertura */}
          {(!activeElectionTitle || activeElectionTitle !== globalElectionTitle) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-auto bg-white/40 backdrop-blur-[2px] rounded-xl">
               {!globalElectionTitle ? (
                 <div className="text-center p-8 bg-white/90 rounded-3xl shadow-xl border border-slate-200 max-w-sm">
                   <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                     <Lock size={28} className="text-slate-400" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">Jornada Cerrada</h3>
                   <p className="text-sm text-slate-500">
                     El administrador del sistema aún no ha aperturado formalmente la jornada electoral. Sus funciones de mesa permanecen bloqueadas.
                   </p>
                 </div>
               ) : (
                 <div className="text-center p-8 bg-white/90 rounded-3xl shadow-2xl border border-[#0f2847]/20 max-w-sm transform animate-in slide-in-from-bottom-4 duration-500">
                   <div className="bg-[#0f2847]/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                     <Play size={28} className="text-[#0f2847] ml-1" />
                   </div>
                   <h3 className="text-2xl font-bold text-[#0f2847] mb-2">Jornada Asignada</h3>
                   <p className="text-base text-slate-700 font-semibold mb-6 px-4 py-2 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 uppercase tracking-widest">
                     {globalElectionTitle}
                   </p>
                   {sessionUser?.isAdmin ? (
                     <p className="text-sm text-slate-500 mb-4">Utiliza el panel de arriba para cerrar la jornada global.</p>
                   ) : (
                     <button 
                        onClick={handleStartElection}
                        className="w-full bg-[#0f2847] hover:bg-[#15345c] text-white px-6 py-3.5 rounded-xl font-bold text-base flex justify-center items-center gap-2 transition-transform hover:scale-105 shadow-md"
                     >
                        <Lock size={18} className="text-blue-200" /> Desbloquear Mi Tabla
                     </button>
                   )}
                 </div>
               )}
            </div>
          )}
        </div>
      )}
      </div>
      )}

      {/* Tabla Historial */}
      {tab === "historial" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="mb-4 text-xl font-bold text-[#0f2847] flex items-center gap-2">
             <History size={20} /> Historial de Elecciones
          </h2>
          {data.historial.length === 0 ? (
            <p className="text-center text-slate-500 py-10 bg-slate-50 rounded-xl border border-slate-100">No hay registros guardados de elecciones pasadas.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm text-slate-600">
                 <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Fecha del Registro</th>
                      <th className="px-4 py-3">Evento / Título</th>
                      <th className="px-4 py-3">Consejo Comunal</th>
                      <th className="px-4 py-3">Calle</th>
                      <th className="px-4 py-3 text-right">Cantidad de Votos</th>
                      <th className="px-4 py-3 w-16 text-center">Acciones</th>
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
                         <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              title="Eliminar registro"
                              onClick={() => handleDeleteHistorial(h.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                         </td>
                      </tr>
                   ))}
                 </tbody>
              </table>
            </div>
          )}
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

      {/* Modal Iniciar Votaciones (Solo Admin) */}
      {showStartModal && sessionUser?.isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
           <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="bg-[#0f2847]/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Play size={28} className="text-[#0f2847] ml-1" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f2847] mb-2 text-center">
                Aperturar Global
              </h3>
              <p className="text-sm text-slate-600 mb-6 text-center">
                Asigna el título maestro. Esto obligará a todos los voceros a usar este nombre y desbloqueará el sistema para que reciban votantes.
              </p>
              <form onSubmit={handleStartElection}>
                 <div className="mb-6">
                   <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Título de la Elección</label>
                   <input 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0f2847] focus:outline-none transition-all"
                     placeholder="Ej: Elecciones Presidenciales 2026..."
                     value={startTitulo}
                     onChange={e => setStartTitulo(e.target.value)}
                     autoFocus
                   />
                 </div>
                 <div className="flex flex-col gap-3">
                    <button 
                      type="submit" 
                      disabled={!startTitulo.trim() || adminSettingTitle}
                      className="w-full py-3 font-bold text-white bg-[#0f2847] hover:bg-[#15345c] rounded-xl transition shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {adminSettingTitle ? "Aperturando..." : "Activar para toda la Comuna"}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowStartModal(false)}
                      className="w-full py-3 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Modal Guardar Historial */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
           <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-bold text-[#0f2847] mb-2 flex items-center justify-center gap-2 text-center">
                Cerrar Votación
              </h3>
              <p className="text-sm text-slate-600 mb-6 text-center">
                Se registrará un reporte histórico con el título <strong>"{activeElectionTitle}"</strong> contabilizando <strong className="text-[#0f2847] text-base">{filtrados.filter(h => h.voto).length} votos</strong>. 
                <br/><br/>
                Luego, la tabla se borrará automáticamente cerrando la jornada.
              </p>
              <form onSubmit={handleSaveHistorial}>
                 <div className="flex flex-col gap-3">
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="w-full py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? "Registrando..." : "Confirmar y Finalizar"}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowSaveModal(false)}
                      className="w-full py-3 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition"
                    >
                      Regresar a la Tabla
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Closing Global Election */}
      {showCloseGlobalElectionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¿Cerrar Elección Global?</h3>
            <p className="text-slate-500 mb-8">
              ¿Segurísimo que deseas cerrar la elección a nivel global? Esto impedirá que se abran nuevas mesas.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCloseGlobalElectionModal(false)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCloseGlobalElection}
                className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition shadow-sm"
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
