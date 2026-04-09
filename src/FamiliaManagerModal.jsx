import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Users, AlertCircle } from "lucide-react";

export default function FamiliaManagerModal({ jefe, allHabitantes, onClose, onSave, onDisolve }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Inicializar con los dependientes actuales
  useEffect(() => {
    if (jefe) {
      const deps = allHabitantes
        .filter((h) => h.jefe_familia_id === jefe.id)
        .map((h) => h.id);
      setSelectedIds(deps);
    }
  }, [jefe, allHabitantes]);

  const availableDependants = useMemo(() => {
    return allHabitantes
      .filter((h) => h.id !== jefe.id)
      .filter((h) =>
        search
          ? `${h.nombre} ${h.apellido} ${h.cedula}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true
      )
      .sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [allHabitantes, jefe, search]);

  const selectedDependantsData = useMemo(() => {
    return allHabitantes.filter(h => selectedIds.includes(h.id));
  }, [allHabitantes, selectedIds]);

  const toggleSelection = (habitanteId) => {
    setSelectedIds((prev) =>
      prev.includes(habitanteId)
        ? prev.filter((id) => id !== habitanteId)
        : [...prev, habitanteId]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    await onSave(jefe.id, selectedIds);
    setLoading(false);
  };

  const handleDisolve = async () => {
    if (window.confirm("¿Estás seguro de que quieres disolver este grupo familiar y convertir a todos en habitantes independientes?")) {
      setLoading(true);
      await onDisolve(jefe.id);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#0f2847] p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Configurador de Grupo Familiar</h2>
              <p className="text-xs text-blue-200">
                Jefe de Familia: {jefe.nombre} {jefe.apellido} ({jefe.cedula})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 p-4 gap-4">
          
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 block">
              Añadir Integrantes al Núcleo
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Busca por nombre o cédula para agregar..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left text-sm text-slate-600 relative">
              <thead className="bg-slate-100 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">Sel</th>
                  <th className="p-3">Habitante</th>
                  <th className="p-3">Cédula</th>
                  <th className="p-3">Calle</th>
                  <th className="p-3">Estado Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {availableDependants.length > 0 ? (
                  availableDependants.map((h) => {
                    const isSelected = selectedIds.includes(h.id);
                    const isAlreadyDependentElsewhere = !isSelected && h.jefe_familia_id;
                    return (
                      <tr 
                        key={h.id} 
                        onClick={() => toggleSelection(h.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                      >
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            checked={isSelected}
                            readOnly
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-700">{h.nombre} {h.apellido}</td>
                        <td className="p-3">{h.cedula}</td>
                        <td className="p-3 text-xs">{h.calle}</td>
                        <td className="p-3 text-xs">
                          {isSelected && <span className="text-blue-600 font-medium">Asignando...</span>}
                          {!isSelected && h.es_jefe_familia && <span className="text-amber-600 font-medium">Es Jefe de otra familia</span>}
                          {isAlreadyDependentElsewhere && <span className="text-slate-400">Pertenece a otro núcleo</span>}
                          {!isSelected && !h.es_jefe_familia && !h.jefe_familia_id && <span className="text-emerald-600">Individual/Soltero</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 italic">
                      No se encontraron habitantes que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
             <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <Users size={16} /> 
                <span>Resumen de Integrantes Seleccionados ({selectedIds.length})</span>
             </div>
             {selectedIds.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay familiares añadidos todavía. Búscalos e inclúyelos usando la tabla superior.</p>
             ) : (
                <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto pr-2 pb-1">
                   {selectedDependantsData.map(h => (
                      <div key={h.id} className="bg-white border border-blue-200 text-slate-700 text-xs px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2 group hover:border-red-200 transition-colors">
                         <span className="font-semibold">{h.nombre} {h.apellido}</span>
                         <button 
                           onClick={() => toggleSelection(h.id)} 
                           className="text-slate-400 group-hover:text-red-500 transition-colors ml-1 p-0.5 rounded-full hover:bg-red-50"
                           title="Quitar"
                         >
                           <X size={14} />
                         </button>
                      </div>
                   ))}
                </div>
             )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex justify-between bg-white items-center">
          <button
            onClick={handleDisolve}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
          >
            Disolver Familia Actual
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 text-sm font-bold text-white bg-[#0f2847] hover:bg-[#12345f] rounded-lg transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Procesando..." : "Guardar Grupo Familiar"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
