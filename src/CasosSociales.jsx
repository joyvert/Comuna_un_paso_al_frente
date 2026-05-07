import { useState } from "react";
import { Pencil, Save, X, Printer, HeartPulse } from "lucide-react";
import { api } from "./api";

export default function CasosSociales({ activeConsejo, db, setDb, sessionUser, inputClass }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState("");

  const habitantesActuales = db[activeConsejo]?.habitantes || [];

  // Filtrar SOLAMENTE aquellos que requieren ayuda Y que coincidan con el alcance del Vocero
  const casos = habitantesActuales.filter((h) => {
    if (!h.requiere_ayuda) return false;
    if (!sessionUser?.isAdmin && sessionUser?.calle) {
      return h.calle === sessionUser.calle;
    }
    return true;
  });

  const handleEdit = (c) => {
    setEditingId(c.id);
    setEditForm({
      estado_caso: c.estado_caso || "Pendiente",
      prioridad_caso: c.prioridad_caso || "Media",
      notas_caso: c.notas_caso || ""
    });
  };

  const handleSave = async (c) => {
    try {
      setMsg("");
      const payload = {
        estado_caso: editForm.estado_caso,
        prioridad_caso: editForm.prioridad_caso,
        notas_caso: editForm.notas_caso
      };
      
      await api.updateHabitante(c.id, payload);
      
      setDb((prev) => ({
        ...prev,
        [activeConsejo]: {
          ...prev[activeConsejo],
          habitantes: prev[activeConsejo].habitantes.map(h => 
            h.id === c.id ? { ...h, ...payload } : h
          )
        }
      }));
      setEditingId(null);
      setMsg("Caso actualizado correctamente.");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Error al actualizar: " + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <HeartPulse className="text-red-500" />
            Gestión de Casos Sociales
          </h2>
          <p className="text-sm text-slate-500">Atención prioritaria y vulnerabilidad en {activeConsejo}</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition"
        >
          <Printer size={18} />
          Imprimir Reporte
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-cyan-50 text-cyan-700 rounded-xl border border-cyan-100 text-sm font-medium print:hidden">
          {msg}
        </div>
      )}

      {/* Secciones de Reporte (Solo visible al imprimir) */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-center">Reporte de Casos Sociales y Vulnerabilidad</h1>
        <p className="text-center text-slate-600 mb-4">Consejo Comunal: {activeConsejo}</p>
        <hr className="mb-4" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-semibold">Habitante</th>
                <th className="p-4 font-semibold">Cédula / Calle</th>
                <th className="p-4 font-semibold">Condición Especial</th>
                <th className="p-4 font-semibold">Prioridad</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold w-1/3">Observaciones</th>
                <th className="p-4 font-semibold print:hidden">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {casos.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    No hay casos sociales registrados en tu sector.
                  </td>
                </tr>
              ) : (
                casos.map(c => {
                  const isEditing = editingId === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{c.nombre} {c.apellido}</td>
                      <td className="p-4 text-slate-500">
                        {c.cedula}
                        <br />
                        <span className="text-xs text-slate-400">{c.calle}</span>
                      </td>
                      <td className="p-4 text-red-600 font-semibold">{c.condicion_especial}</td>
                      
                      <td className="p-4">
                        {isEditing ? (
                          <select 
                            className={inputClass}
                            value={editForm.prioridad_caso}
                            onChange={e => setEditForm({...editForm, prioridad_caso: e.target.value})}
                          >
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            (c.prioridad_caso || "Media") === "Alta" ? "bg-red-100 text-red-700" :
                            (c.prioridad_caso || "Media") === "Media" ? "bg-amber-100 text-amber-700" :
                            "bg-emerald-100 text-emerald-700"
                          }`}>
                            {c.prioridad_caso || "Media"}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {isEditing ? (
                          <select 
                            className={inputClass}
                            value={editForm.estado_caso}
                            onChange={e => setEditForm({...editForm, estado_caso: e.target.value})}
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="En Proceso">En Proceso</option>
                            <option value="Atendido">Atendido</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            (c.estado_caso || "Pendiente") === "Pendiente" ? "bg-slate-100 text-slate-600" :
                            (c.estado_caso || "Pendiente") === "En Proceso" ? "bg-blue-100 text-blue-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {c.estado_caso || "Pendiente"}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {isEditing ? (
                          <textarea
                            className={`${inputClass} min-h-[60px] text-xs`}
                            value={editForm.notas_caso}
                            onChange={e => setEditForm({...editForm, notas_caso: e.target.value})}
                            placeholder="Añade notas o historial aquí..."
                          />
                        ) : (
                          <p className="text-xs text-slate-500 whitespace-pre-wrap">
                            {c.notas_caso || <span className="italic text-slate-300">Sin observaciones</span>}
                          </p>
                        )}
                      </td>

                      <td className="p-4 print:hidden">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleSave(c)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg" title="Guardar">
                              <Save size={16} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg" title="Cancelar">
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar seguimiento">
                            <Pencil size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
