import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Search, Save, Calendar, CheckSquare, Square, History, Trash2 } from "lucide-react";

export default function Jornadas({ sessionUser, activeConsejo, db, setDb, inputClass }) {
  const [tab, setTab] = useState("nueva"); // "nueva" | "historial"
  const [jornadasHistory, setJornadasHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

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
      res = res.filter(h => h.calle === calleFilter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      res = res.filter(
        (h) => h.nombre.toLowerCase().includes(term) || h.cedula.toLowerCase().includes(term)
      );
    }
    return res;
  }, [habitantes, search, calleFilter]);

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
      setJornadasHistory(res.jornadas || []);
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
          Nueva Entrga (Masiva)
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
          <div className="grid gap-4 md:grid-cols-2 rounded-xl bg-slate-100 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Servicio</label>
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de Entrega</label>
              <input
                type="date"
                className={inputClass}
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
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
              <div className="w-full max-w-[200px]">
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

            <span className="text-sm text-slate-500 ml-auto mb-2">
              Total habitantes mostrados: {filtrados.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-[#0f2847] text-white">
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

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 mt-4">
            <div className="text-emerald-900 font-semibold flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide opacity-80">Monto Total:</span>
              <span className="text-xl">{formatATM(Math.round(totalMonto * 100).toString()) || "0,00"} Bs</span>
            </div>
            <button
              onClick={handleGuardarJornada}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                    onClick={async () => {
                      if (window.confirm("¿Seguro que deseas eliminar esta jornada y todos sus pagos?")) {
                        try {
                          await api.deleteJornada(j.id);
                          setServerMsg("success", "Jornada eliminada.");
                          fetchHistory();
                        } catch (e) {
                          setServerMsg("error", e.message || "Error al eliminar");
                        }
                      }
                    }}
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
    </div>
  );
}
