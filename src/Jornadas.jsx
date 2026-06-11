import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Search, Save, Calendar, CheckSquare, Square, History, Trash2 } from "lucide-react";

export default function Jornadas({ sessionUser, activeConsejo, db, setDb, inputClass }) {
  const [tab, setTab] = useState("nueva"); // "nueva" | "historial"
  const [jornadasHistory, setJornadasHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ fecha: hoy, servicio: "Gas" });
  const [search, setSearch] = useState("");
  const [calleFilter, setCalleFilter] = useState("Todas");
  const [checks, setChecks] = useState({});

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

        return {
           ...j,
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
      await api.createJornada({
        consejoNombre: activeConsejo,
        servicio: form.servicio,
        fecha_entrega: form.fecha,
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
        <div className="grid gap-4">
          {loading && jornadasHistory.length === 0 && <p className="text-slate-500">Cargando historial...</p>}
          {!loading && jornadasHistory.length === 0 && (
            <div className="py-10 text-center text-slate-500">
              <History className="mx-auto mb-3 text-slate-300" size={40} />
              Aún no hay operativos registrados.
            </div>
          )}
          {jornadasHistory.map(j => (
            <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-slate-300 transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${j.servicio === 'Gas' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                    {j.servicio}
                  </span>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    <Calendar size={14} /> Fecha de Entrega: {j.fecha_entrega.slice(0,10)}
                  </span>
                </div>
                <h4 className="font-semibold text-[#0f2847]">Jornada en {activeConsejo}</h4>
                <p className="text-sm text-slate-600 mt-1">Registrada el: {new Date(j.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-4 items-center bg-slate-50 rounded-lg p-3 w-full md:w-auto mt-4 md:mt-0">
                <div className="flex gap-4 items-center">
                  <div className="text-center">
                    <span className="block text-2xl font-bold text-[#0f2847]">{j.total_hab}</span>
                    <span className="text-xs text-slate-500">Habitantes</span>
                  </div>
                  <div className="w-[1px] h-10 bg-slate-200"></div>
                  <div className="text-center">
                    <span className="block text-xl font-bold text-emerald-600">Bs. {Number(j.total_recaudado).toLocaleString('de-DE', {minimumFractionDigits:2})}</span>
                    <span className="text-xs text-slate-500">Recaudado</span>
                  </div>
                </div>
                {sessionUser?.isAdmin && (
                  <button 
                    onClick={() => setDeleteConfirm(j)}
                    className="w-full text-center py-2 text-sm text-red-600 font-medium hover:bg-red-100 rounded-lg border border-red-200 flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 size={16} /> Eliminar Jornada
                  </button>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
