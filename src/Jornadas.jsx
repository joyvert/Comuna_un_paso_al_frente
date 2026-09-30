import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Search, Save, Calendar, CheckSquare, Square, History, Trash2, Eye, Users, FileText, Printer, X, MapPin, User, Layers, Filter, CheckCircle2 } from "lucide-react";

export default function Jornadas({ sessionUser, activeConsejo, db, setDb, inputClass }) {
  const [tab, setTab] = useState("nueva"); // "nueva" | "historial"
  const [jornadasHistory, setJornadasHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedJornadaDetalle, setSelectedJornadaDetalle] = useState(null);

  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ fecha: hoy, servicio: "Gas" });
  const [search, setSearch] = useState("");
  const [calleFilter, setCalleFilter] = useState("Todas");
  const [historialCalleFilter, setHistorialCalleFilter] = useState("Todas");
  const [historialServicioFilter, setHistorialServicioFilter] = useState("Todos");
  const [checks, setChecks] = useState({});

  useEffect(() => {
    // Si el usuario es vocero (no admin) y tiene calle asignada, preseleccionar su calle
    if (!sessionUser?.isAdmin && sessionUser?.calle && sessionUser.calle !== "General") {
      setCalleFilter(sessionUser.calle);
      setHistorialCalleFilter(sessionUser.calle);
    }
  }, [sessionUser]);

  const formatATM = (valStr) => {
    if (valStr === undefined || valStr === null) return "";
    const digits = String(valStr).replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10);
    if (isNaN(num)) return "";
    const strNum = num.toString().padStart(3, "0");
    const integerPart = strNum.slice(0, -2);
    const decimalPart = strNum.slice(-2);
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedInteger},${decimalPart}`;
  };

  const habitantes = useMemo(() => {
    return db[activeConsejo]?.habitantes || [];
  }, [db, activeConsejo]);

  const callesDisponibles = useMemo(() => {
    const set = new Set(habitantes.map(h => h.calle).filter(Boolean));
    return Array.from(set).sort();
  }, [habitantes]);

  const totalMonto = useMemo(() => {
    return habitantes.reduce((sum, h) => {
      const c = checks[h.id];
      if (c && c.checked && c.monto) {
        const digits = String(c.monto).replace(/\D/g, "");
        const num = parseInt(digits, 10);
        if (!isNaN(num)) return sum + (num / 100);
      }
      return sum;
    }, 0);
  }, [habitantes, checks]);

  const filtrados = useMemo(() => {
    let res = habitantes;
    if (calleFilter !== "Todas") {
      res = res.filter((h) => h.calle === calleFilter);
    }
    if (search.trim()) {
      const normalize = (str) =>
        (str || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const searchTerms = normalize(search).split(/\s+/).filter(Boolean);

      res = res.filter((h) => {
        const fullText = normalize(`${h.nombre} ${h.apellido || ""} ${h.cedula}`);
        return searchTerms.every((term) => fullText.includes(term));
      });
    }
    return res;
  }, [habitantes, calleFilter, search]);

  useEffect(() => {
    // Refresh checks if inhabitants change
    setChecks((prev) => {
      const next = { ...prev };
      habitantes.forEach(h => {
        if (!next[h.id]) {
          next[h.id] = { checked: false, monto: "", detalle: "", presion: "", rosca: "", combos: 1 };
        }
      });
      return next;
    });
  }, [habitantes]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getJornadas(activeConsejo);
      const computedJornadas = (res.jornadas || []).map(j => {
        let dateObj = new Date();
        if (j.createdAt?.seconds) {
           dateObj = new Date(j.createdAt.seconds * 1000);
        } else if (j.createdAt) {
           dateObj = new Date(j.createdAt);
        }
        
        const total_hab = Array.isArray(j.pagos) ? j.pagos.length : 0;
        const total_recaudado = Array.isArray(j.pagos) ? j.pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0) : 0;

        // Si la jornada no tenía calle explícita (guardada antes), inferirla de los pagos
        let inferredCalle = j.calle;
        if (!inferredCalle || inferredCalle === "General") {
          const distinctCalles = Array.from(new Set((j.pagos || []).map(p => p.calle).filter(Boolean)));
          if (distinctCalles.length === 1) {
            inferredCalle = distinctCalles[0];
          } else if (distinctCalles.length > 1) {
            inferredCalle = "Múltiples Calles";
          } else {
            inferredCalle = "General";
          }
        }

        return {
           ...j,
           calle: inferredCalle,
           creado_por_nombre: j.creado_por_nombre || "Vocero",
           creado_por_rol: j.creado_por_rol || "Vocero",
           created_at: dateObj.toISOString(),
           total_hab,
           total_recaudado
        };
      });
      setJornadasHistory(computedJornadas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "historial") {
      fetchHistory();
    }
  }, [tab, activeConsejo]);

  const filteredHistory = useMemo(() => {
    return jornadasHistory.filter(j => {
      // Si el usuario no es admin y es vocero, restringir a su calle
      if (!sessionUser?.isAdmin && sessionUser?.calle && sessionUser.calle !== "General") {
        if (j.calle && j.calle !== "General" && j.calle !== sessionUser.calle && j.calle !== "Múltiples Calles") {
          return false;
        }
      } else if (historialCalleFilter !== "Todas") {
        if (j.calle !== historialCalleFilter) return false;
      }

      if (historialServicioFilter !== "Todos") {
        if (j.servicio !== historialServicioFilter) return false;
      }
      return true;
    });
  }, [jornadasHistory, historialCalleFilter, historialServicioFilter, sessionUser]);

  const setServerMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const handleToggleCheck = (hId) => {
    setChecks(p => ({
      ...p,
      [hId]: { ...p[hId], checked: !p[hId]?.checked }
    }));
  };

  const confirmDeleteJornada = async () => {
    const j = deleteConfirm;
    if (!j) return;
    setDeleteConfirm(null);
    try {
      await api.deleteJornada(j.id);
      setServerMsg("success", "Jornada eliminada con éxito.");
      fetchHistory();
    } catch (e) {
      setServerMsg("error", e.message || "Error al eliminar");
    }
  };

  const handleChangeField = (hId, field, value) => {
    setChecks(p => ({
      ...p,
      [hId]: { ...p[hId], [field]: value }
    }));
  };

  const handleGuardarJornada = async () => {
    const pagosToSave = habitantes
      .filter(h => checks[h.id]?.checked)
      .map(h => {
        const c = checks[h.id];
        const det = form.servicio === "Gas"
          ? `Rosca x${Number(c.rosca) || 0}, Presión x${Number(c.presion) || 0}`
          : `Combos x${Number(c.combos) || 1}`;

        return {
          habitanteId: h.id,
          nombre: h.nombre,
          apellido: h.apellido,
          cedula: h.cedula,
          calle: h.calle,
          monto: Number(String(c.monto || "0").replace(/\D/g, "")) / 100,
          detalle: det
        };
      });

    if (pagosToSave.length === 0) {
      setServerMsg("error", "No has marcado a ningún habitante.");
      return;
    }

    try {
      setLoading(true);
      // Obtener la calle representativa (si el vocero tiene calle asignada o la calle de los habitantes guardados)
      const callesInPagos = Array.from(new Set(pagosToSave.map(p => p.calle).filter(Boolean)));
      const calleJornada = sessionUser?.calle && sessionUser.calle !== "General"
        ? sessionUser.calle
        : (callesInPagos.length === 1 ? callesInPagos[0] : (calleFilter !== "Todas" ? calleFilter : (callesInPagos[0] || "General")));

      const nombreOperador = [sessionUser?.nombre, sessionUser?.apellido].filter(Boolean).join(" ") || sessionUser?.userId || "Vocero";

      await api.createJornada({
        consejoNombre: activeConsejo,
        calle: calleJornada,
        servicio: form.servicio,
        fecha_entrega: form.fecha,
        creado_por_nombre: nombreOperador,
        creado_por_id: sessionUser?.userId || "sistema",
        creado_por_rol: sessionUser?.isAdmin ? "Administrador" : "Vocero",
        pagos: pagosToSave
      });
      setServerMsg("success", "Jornada registrada correctamente.");
      // Limpiar checks
      const next = {};
      habitantes.forEach(h => {
        next[h.id] = { checked: false, monto: "", detalle: "", presion: "", rosca: "", combos: 1 };
      });
      setChecks(next);
      setTab("historial");
      await fetchHistory();
      // Recargar pagos del consejo para que se vean en el historial global
      const pag = await api.getPagos(activeConsejo);
      setDb(prev => ({
        ...prev,
        [activeConsejo]: {
          ...prev[activeConsejo],
          pagos: (pag.pagos || []).map((p) => ({
             ...p,
             monto: Number(p.monto),
             fecha: new Date(p.fecha).toLocaleString(),
          })),
        }
      }));
    } catch (err) {
      setServerMsg("error", err?.message || "Error al guardar jornada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab("nueva")}
          className={`px-4 py-2 font-medium ${tab === "nueva" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Nueva Entrega (Masiva)
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`px-4 py-2 font-medium ${tab === "historial" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Historial de Jornadas
        </button>
      </div>

      {msg.text && (
        <div className={`rounded-xl px-4 py-2 text-sm ${msg.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {msg.text}
        </div>
      )}

      {tab === "nueva" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:gap-4 rounded-xl bg-slate-100 p-3.5 md:p-4">
            <div>
              <label className="mb-1 block text-xs md:text-sm font-medium text-slate-700">Servicio</label>
              <select
                className={inputClass}
                value={form.servicio}
                onChange={e => setForm(p => ({ ...p, servicio: e.target.value }))}
              >
                <option>Gas</option>
                <option>Proteínas</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs md:text-sm font-medium text-slate-700">Fecha de Entrega</label>
              <input
                type="date"
                className={inputClass}
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
            <div className="w-full max-w-sm">
              <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Buscar por nombre o cédula</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Ej. Juan o 12345678"
                  className={`${inputClass} pl-10`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            {sessionUser?.isAdmin && callesDisponibles.length > 0 && (
              <div className="w-full md:max-w-[200px]">
                <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Filtrar por Calle</label>
                <select 
                  className={inputClass}
                  value={calleFilter}
                  onChange={e => setCalleFilter(e.target.value)}
                >
                  <option value="Todas">Todas las calles</option>
                  {callesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <span className="text-xs sm:text-sm text-slate-500 md:ml-auto mb-1 md:mb-2 font-medium">
              Total habitantes mostrados: {filtrados.length}
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 rounded-xl relative shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-[#0f2847] text-white sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-12 text-center">✓</th>
                  <th className="p-3">Habitante</th>
                  <th className="p-3">Cédula / Calle</th>
                  <th className="p-3">
                    {form.servicio === "Gas" ? "Cilindros" : "Proteínas"}
                  </th>
                  <th className="p-3 w-32">Monto</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center">No se encontraron habitantes.</td>
                  </tr>
                ) : filtrados.map((h) => {
                  const c = checks[h.id] || {};
                  return (
                    <tr key={h.id} className={`border-b border-slate-100 hover:bg-slate-50 ${c.checked ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-3 text-center cursor-pointer" onClick={() => handleToggleCheck(h.id)}>
                        {c.checked ? <CheckSquare className="text-blue-600 mx-auto" size={20} /> : <Square className="text-slate-300 mx-auto" size={20} />}
                      </td>
                      <td className="p-3 font-medium select-none cursor-pointer" onClick={() => handleToggleCheck(h.id)}>
                        {h.nombre} {h.apellido}
                      </td>
                      <td className="p-3 text-slate-500 select-none cursor-pointer" onClick={() => handleToggleCheck(h.id)}>
                        {h.cedula} <br/> <span className="text-xs">{h.calle}</span>
                      </td>
                      <td className="p-3">
                        {form.servicio === "Gas" ? (
                          <div className="flex gap-2">
                            <label className="flex items-center gap-1 text-xs">
                              Presión:
                              <input 
                                type="number" 
                                className="w-12 rounded border border-slate-300 px-1 py-1 text-xs outline-none focus:border-blue-600 disabled:opacity-50 disabled:bg-slate-100" 
                                value={c.presion}
                                onChange={(e) => handleChangeField(h.id, 'presion', e.target.value)}
                                disabled={!c.checked}
                                min="0"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              Rosca:
                              <input 
                                type="number" 
                                className="w-12 rounded border border-slate-300 px-1 py-1 text-xs outline-none focus:border-blue-600 disabled:opacity-50 disabled:bg-slate-100" 
                                value={c.rosca}
                                onChange={(e) => handleChangeField(h.id, 'rosca', e.target.value)}
                                disabled={!c.checked}
                                min="0"
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1 text-xs">
                            Combos:
                            <input 
                              type="number" 
                              className="w-16 rounded border border-slate-300 px-1 py-1 text-xs outline-none focus:border-blue-600 disabled:opacity-50 disabled:bg-slate-100" 
                              value={c.combos}
                              onChange={(e) => handleChangeField(h.id, 'combos', e.target.value)}
                              disabled={!c.checked}
                              min="1"
                            />
                          </label>
                        )}
                      </td>
                      <td className="p-3 relative">
                        <div className="relative inline-block w-24 md:w-full">
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="0,00" 
                            className="w-full rounded border border-slate-300 px-2 py-1 pr-6 text-sm outline-none focus:border-blue-600 disabled:opacity-50 disabled:bg-slate-100 text-right font-medium" 
                            value={c.monto !== undefined ? c.monto : ""}
                            onChange={(e) => {
                              const formatted = formatATM(e.target.value);
                              handleChangeField(h.id, 'monto', formatted);
                            }}
                            disabled={!c.checked}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#143c6e] pointer-events-none">
                            Bs
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filtrados.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
                No se encontraron habitantes.
              </div>
            ) : (
              filtrados.map((h) => {
                const c = checks[h.id] || {};
                return (
                  <div 
                    key={h.id} 
                    className={`bg-white rounded-xl border p-4 shadow-sm transition-all duration-200 flex flex-col gap-3.5 ${
                      c.checked ? 'border-cyan-500 bg-cyan-50/5' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 cursor-pointer" onClick={() => handleToggleCheck(h.id)}>
                      <div className="pt-0.5 shrink-0 select-none">
                        {c.checked ? (
                          <CheckSquare className="text-cyan-600" size={22} />
                        ) : (
                          <Square className="text-slate-300" size={22} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 select-none">
                        <div className="font-semibold text-slate-800 text-sm">
                          {h.nombre} {h.apellido}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          V-{h.cedula} • <span className="font-medium text-slate-600">{h.calle}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`grid gap-3 ${c.checked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <div className="w-full h-[1px] bg-slate-100" />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          {form.servicio === "Gas" ? (
                            <div className="flex gap-2">
                              <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                                Presión:
                                <input 
                                  type="number" 
                                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-cyan-600 bg-white" 
                                  value={c.presion || ""}
                                  onChange={(e) => handleChangeField(h.id, 'presion', e.target.value)}
                                  disabled={!c.checked}
                                  min="0"
                                  placeholder="0"
                                />
                              </label>
                              <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                                Rosca:
                                <input 
                                  type="number" 
                                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-cyan-600 bg-white" 
                                  value={c.rosca || ""}
                                  onChange={(e) => handleChangeField(h.id, 'rosca', e.target.value)}
                                  disabled={!c.checked}
                                  min="0"
                                  placeholder="0"
                                />
                              </label>
                            </div>
                          ) : (
                            <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                              Combos:
                              <input 
                                type="number" 
                                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-cyan-600 bg-white" 
                                value={c.combos !== undefined ? c.combos : 1}
                                onChange={(e) => handleChangeField(h.id, 'combos', e.target.value)}
                                disabled={!c.checked}
                                min="1"
                              />
                            </label>
                          )}
                        </div>
                        
                        <div>
                          <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                            Monto (Bs):
                            <div className="relative w-full">
                              <input 
                                type="text" 
                                inputMode="numeric"
                                placeholder="0,00" 
                                className="w-full rounded border border-slate-300 pl-2 pr-6 py-1.5 text-xs outline-none focus:border-cyan-600 bg-white font-semibold text-right" 
                                value={c.monto !== undefined ? c.monto : ""}
                                onChange={(e) => {
                                  const formatted = formatATM(e.target.value);
                                  handleChangeField(h.id, 'monto', formatted);
                                }}
                                disabled={!c.checked}
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                Bs
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Total and Save Bar */}
          <div className="sticky bottom-0 md:relative z-20 flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/95 backdrop-blur shadow-lg md:shadow-none p-4 mt-4">
            <div className="text-emerald-900 font-semibold flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide opacity-80">Monto Total:</span>
              <span className="text-xl">{formatATM(Math.round(totalMonto * 100).toString()) || "0,00"} Bs</span>
            </div>
            <button
              onClick={handleGuardarJornada}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save size={18} />
              {loading ? "Guardando..." : "Guardar Jornada"}
            </button>
          </div>
        </div>
      )}

      {tab === "historial" && (
        <div className="space-y-4">
          {/* Filtros del Historial (Calles y Servicio) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 self-start sm:self-auto">
              <Filter size={15} className="text-slate-400" />
              <span>Filtrar Historial:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Filtro de Servicio */}
              <select
                value={historialServicioFilter}
                onChange={e => setHistorialServicioFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none shadow-xs cursor-pointer flex-1 sm:flex-none"
              >
                <option value="Todos">Todos los Servicios</option>
                <option value="Gas">Gas</option>
                <option value="Proteínas">Proteínas</option>
              </select>

              {/* Filtro de Calle (para Administradores) */}
              {sessionUser?.isAdmin ? (
                <select
                  value={historialCalleFilter}
                  onChange={e => setHistorialCalleFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none shadow-xs cursor-pointer flex-1 sm:flex-none"
                >
                  <option value="Todas">Todas las Calles</option>
                  {callesDisponibles.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                sessionUser?.calle && sessionUser.calle !== "General" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200/70 px-2.5 py-1.5 rounded-lg">
                    <MapPin size={13} className="text-cyan-600" /> Calle: {sessionUser.calle}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Listado de Tarjetas de Jornadas */}
          <div className="grid gap-3.5">
            {loading && jornadasHistory.length === 0 && <p className="text-slate-500 text-sm">Cargando historial...</p>}
            {!loading && filteredHistory.length === 0 && (
              <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
                <History className="mx-auto mb-3 text-slate-300" size={40} />
                <p className="font-semibold text-slate-600 text-sm">No se encontraron operativos registrados.</p>
                <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros seleccionados o registra una nueva entrega.</p>
              </div>
            )}
            {filteredHistory.map(j => (
              <div key={j.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${j.servicio === 'Gas' ? 'bg-orange-100 text-orange-700 border border-orange-200/60' : 'bg-red-100 text-red-700 border border-red-200/60'}`}>
                      {j.servicio}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200/60">
                      <MapPin size={12} className="text-cyan-600" />
                      {j.calle || "General"}
                    </span>
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar size={13} /> Entrega: {j.fecha_entrega?.slice(0, 10)}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 font-heading text-sm sm:text-base flex items-center gap-2">
                    Jornada en {activeConsejo}
                  </h4>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                      <User size={12} className="text-slate-400" />
                      Cargado por: <strong className="text-slate-700">{j.creado_por_nombre || "Vocero"}</strong>
                      {j.creado_por_rol && <span className="text-[10px] text-slate-400">({j.creado_por_rol})</span>}
                    </span>
                    <span>•</span>
                    <span>Registrada: {new Date(j.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 items-center bg-slate-50/90 rounded-xl p-3 w-full md:w-auto mt-2 md:mt-0 border border-slate-100">
                  <div className="flex gap-4 items-center justify-around w-full">
                    <div className="text-center px-2">
                      <span className="block text-xl sm:text-2xl font-black text-slate-800 font-heading">{j.total_hab}</span>
                      <span className="text-[11px] font-medium text-slate-400">Habitantes</span>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-200"></div>
                    <div className="text-center px-2">
                      <span className="block text-base sm:text-lg font-black text-emerald-600 font-heading">
                        Bs. {Number(j.total_recaudado).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">Recaudado</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <button 
                      type="button"
                      onClick={() => setSelectedJornadaDetalle(j)}
                      className="flex-1 text-center py-2 px-3 text-xs sm:text-sm text-cyan-800 bg-cyan-50 hover:bg-cyan-100 font-bold rounded-lg border border-cyan-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      title="Ver lista de habitantes atendidos"
                    >
                      <Eye size={15} className="text-cyan-600" /> Ver Beneficiarios
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDeleteConfirm(j)}
                      className="py-2 px-3 text-xs sm:text-sm text-red-600 hover:text-red-700 bg-red-50/60 hover:bg-red-50 font-medium rounded-lg border border-red-200/80 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                      title="Eliminar Jornada"
                    >
                      <Trash2 size={15} />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Jornada?</h3>
            <p className="text-slate-500 mb-8">
              Estás a punto de eliminar esta jornada de <span className="font-semibold text-slate-700">{deleteConfirm.servicio}</span> y todos sus pagos. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteJornada}
                className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Detalle de Beneficiarios */}
      {selectedJornadaDetalle && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl text-cyan-400 border border-white/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-heading">
                    Relación de Entrega: {selectedJornadaDetalle.servicio}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-300">
                    Fecha: {selectedJornadaDetalle.fecha_entrega?.slice(0, 10)} • {activeConsejo}
                    {selectedJornadaDetalle.calle && (
                      <span className="text-cyan-300 font-semibold"> • Calle: {selectedJornadaDetalle.calle}</span>
                    )}
                    {selectedJornadaDetalle.creado_por_nombre && (
                      <span className="text-slate-400"> • Responsable: {selectedJornadaDetalle.creado_por_nombre}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJornadaDetalle(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen rápido */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-around text-center shrink-0">
              <div>
                <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase block">Total Beneficiarios</span>
                <span className="text-sm sm:text-base font-bold text-slate-800">
                  {Array.isArray(selectedJornadaDetalle.pagos) ? selectedJornadaDetalle.pagos.length : 0} personas
                </span>
              </div>
              <div className="w-[1px] h-8 bg-slate-200" />
              <div>
                <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase block">Monto Total Recaudado</span>
                <span className="text-sm sm:text-base font-bold text-emerald-600">
                  Bs. {Number(selectedJornadaDetalle.total_recaudado || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Lista de Beneficiarios */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
              {!Array.isArray(selectedJornadaDetalle.pagos) || selectedJornadaDetalle.pagos.length === 0 ? (
                <p className="text-center text-xs text-slate-400 italic py-6">
                  No hay registros de beneficiarios en esta jornada.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {selectedJornadaDetalle.pagos.map((p, idx) => {
                    const hab = habitantes.find(h => h.id === p.habitanteId) || {};
                    const nombreCompleto = p.nombre ? `${p.nombre} ${p.apellido || ""}` : (hab.nombre ? `${hab.nombre} ${hab.apellido || ""}` : `Habitante #${idx + 1}`);
                    const cedulaHab = p.cedula || hab.cedula || "S/C";
                    const calleHab = p.calle || hab.calle || "";

                    return (
                      <div key={idx} className="p-3 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                            {idx + 1}. {nombreCompleto}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            C.I: <span className="font-mono font-semibold text-slate-700">{cedulaHab}</span>
                            {calleHab && <span> • Calle: {calleHab}</span>}
                          </p>
                          {p.detalle && (
                            <span className="inline-block mt-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded">
                              {p.detalle}
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-emerald-700 block">
                            Bs. {Number(p.monto || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            Pagado
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedJornadaDetalle(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
