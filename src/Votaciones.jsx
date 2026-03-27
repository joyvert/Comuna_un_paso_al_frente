import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { api } from "./api";

export default function Votaciones({ sessionUser, inputClass, onMessage }) {
  const [data, setData] = useState({ stats: [], habitantes: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [calleFilter, setCalleFilter] = useState("Todas");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getVotaciones();
      setData({ stats: res.stats || [], habitantes: res.habitantes || [] });
    } catch (err) {
      onMessage?.({ type: "error", text: "Error cargando votaciones: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  const handleToggleVoto = async (h) => {
    const nuevoEstado = !h.voto;
    // Optimistic UI Update
    setData((prev) => ({
      ...prev,
      habitantes: prev.habitantes.map((x) => (x.id === h.id ? { ...x, voto: nuevoEstado } : x)),
      stats: prev.stats.map(s => {
        if (s.consejo === h.consejo) {
          return { ...s, total: s.total + (nuevoEstado ? 1 : -1) };
        }
        return s;
      })
    }));

    try {
      await api.toggleVoto(h.id, nuevoEstado);
    } catch (err) {
      // Revert if error
      onMessage?.({ type: "error", text: err.message });
      loadData(); 
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
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h2 className="mb-4 text-xl font-bold text-[#0f2847]">Estadísticas de Votación</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-blue-800 text-center leading-tight mb-1">Total Global</span>
            <span className="text-3xl font-bold text-blue-900">{totalVotosGlobal}</span>
          </div>
          {data.stats.map(s => (
            <div key={s.consejo} className="rounded-xl bg-slate-50 p-4 border border-slate-200 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-slate-600 text-center leading-tight mb-1">{s.consejo}</span>
              <span className="text-2xl font-bold text-slate-800">{s.total}</span>
            </div>
          ))}
        </div>
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#0f2847] text-white">
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
                  <td colSpan={sessionUser?.isAdmin ? 6 : 5} className="p-6 text-center text-slate-400">
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
    </div>
  );
}
