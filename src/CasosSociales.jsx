import { useState } from "react";
import { 
  Pencil, 
  Save, 
  X, 
  Printer, 
  HeartPulse, 
  History, 
  MessageCircle, 
  Phone, 
  Package, 
  MapPin, 
  IdCard, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock 
} from "lucide-react";
import { api } from "./api";
import { formatWhatsAppUrl } from "./whatsappHelper";

export const TIPOS_AYUDA = [
  "Medicamentos",
  "Ayuda Técnica (Silla de Ruedas / Bastón / Andadera)",
  "Alimentación / Nutrición Especial",
  "Pañales Desechables / Insumos",
  "Atención Médica / Quirúrgica",
  "Vivienda / Enseres",
  "Otro"
];

export default function CasosSociales({ activeConsejo, db, setDb, sessionUser, inputClass }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("activos"); // "activos" | "historial"

  const habitantesActuales = db[activeConsejo]?.habitantes || [];

  // Filtrar SOLAMENTE aquellos que requieren ayuda Y que coincidan con el alcance del Vocero
  const casos = habitantesActuales.filter((h) => {
    if (!h.requiere_ayuda) return false;
    if (!sessionUser?.isAdmin && sessionUser?.calle) {
      return h.calle === sessionUser.calle;
    }
    return true;
  });

  const casosActivos = casos.filter(c => (c.estado_caso || "Pendiente") !== "Atendido");
  const casosAtendidos = casos.filter(c => (c.estado_caso || "Pendiente") === "Atendido");

  const handleEdit = (c) => {
    setEditingId(c.id);
    setEditForm({
      estado_caso: c.estado_caso || "Pendiente",
      prioridad_caso: c.prioridad_caso || "Media",
      tipo_ayuda: c.tipo_ayuda || "Medicamentos",
      tipo_ayuda_detalle: c.tipo_ayuda_detalle || "",
      notas_caso: c.notas_caso || ""
    });
  };

  const handleSave = async (c) => {
    try {
      setMsg("");
      const payload = {
        estado_caso: editForm.estado_caso,
        prioridad_caso: editForm.prioridad_caso,
        tipo_ayuda: editForm.tipo_ayuda,
        tipo_ayuda_detalle: editForm.tipo_ayuda_detalle || "",
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
      setMsg("Caso social actualizado correctamente.");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Error al actualizar: " + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 md:space-y-6 print:m-0 print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
        <div>
          <h2 className="text-sm sm:text-base md:text-xl font-bold text-slate-800 flex items-center gap-2 font-heading">
            <HeartPulse className="text-red-500" size={18} />
            Gestión de Casos Sociales
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500">Atención prioritaria y vulnerabilidad en {activeConsejo}</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-800 text-white rounded-lg sm:rounded-xl hover:bg-slate-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
        >
          <Printer size={15} />
          Imprimir Reporte
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-cyan-50 text-cyan-700 rounded-xl border border-cyan-100 text-xs sm:text-sm font-medium print:hidden">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 print:hidden mt-2 sm:mt-4">
        <button
          onClick={() => setTab("activos")}
          className={`pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            tab === "activos"
              ? "border-cyan-500 text-cyan-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <HeartPulse size={15} />
          Casos Activos ({casosActivos.length})
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`pb-2.5 sm:pb-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            tab === "historial"
              ? "border-cyan-500 text-cyan-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History size={15} />
          Historial Atendidos ({casosAtendidos.length})
        </button>
      </div>

      {/* Secciones de Reporte (Solo visible al imprimir) */}
      <div className="hidden print:block mb-8">
        <div className="text-center mb-6">
          <p className="font-bold text-sm uppercase">República Bolivariana de Venezuela</p>
          <p className="font-bold text-sm uppercase">Ministerio del Poder Popular para las Comunas y los Movimientos Sociales</p>
          <p className="font-bold text-sm uppercase">Consejo Comunal: {activeConsejo}</p>
          <br />
          <h1 className="text-xl font-bold underline mb-2">REPORTE OFICIAL DE CASOS SOCIALES Y VULNERABILIDAD</h1>
          <p className="text-xs text-slate-500">Fecha de emisión: {new Date().toLocaleDateString()}</p>
        </div>
        <hr className="border-black mb-6" />

        <div className="space-y-6">
          {casosActivos.length === 0 ? (
            <p className="text-center italic">No hay casos sociales activos registrados.</p>
          ) : (
            casosActivos.map((c, index) => (
              <div key={c.id} className="border border-slate-300 p-4 rounded-lg break-inside-avoid">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{index + 1}. {c.nombre} {c.apellido}</h3>
                  <span className="font-bold uppercase text-xs border border-black px-2 py-1">Prioridad: {c.prioridad_caso || "Media"}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <p><strong>Cédula:</strong> {c.cedula}</p>
                  <p><strong>Edad:</strong> {c.edad} años</p>
                  <p><strong>Teléfono:</strong> {c.telefono || "No registrado"}</p>
                  <p><strong>Dirección:</strong> {c.calle}</p>
                </div>
                <div className="bg-slate-50 p-3 border border-slate-200">
                  <p className="mb-1"><strong>Condición Médica / Especial:</strong> <span className="uppercase font-semibold">{c.condicion_especial}</span></p>
                  <p className="mb-1"><strong>Ayuda Requerida:</strong> <span className="font-bold text-slate-800">{c.tipo_ayuda || "No especificada"} {c.tipo_ayuda_detalle ? `(${c.tipo_ayuda_detalle})` : ""}</span></p>
                  <p className="mb-1"><strong>Estado de Atención:</strong> {c.estado_caso || "Pendiente"}</p>
                  <p><strong>Observaciones / Diagnóstico:</strong> {c.notas_caso || "Sin observaciones adicionales."}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* VISTA TAB: CASOS ACTIVOS */}
      {tab === "activos" && (
        <div className="space-y-3.5 print:hidden">
          {/* 1. Vista Escritorio (Tabla) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                    <th className="p-3.5">Habitante</th>
                    <th className="p-3.5">Cédula / Calle</th>
                    <th className="p-3.5">Condición Especial</th>
                    <th className="p-3.5">Ayuda Requerida</th>
                    <th className="p-3.5">Prioridad</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 w-1/4">Observaciones</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {casosActivos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                        No hay casos sociales activos registrados en tu sector.
                      </td>
                    </tr>
                  ) : (
                    casosActivos.map(c => {
                      const isEditing = editingId === c.id;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-medium text-slate-800">
                            <div className="font-bold">{c.nombre} {c.apellido}</div>
                            {c.telefono && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <a href={`tel:${c.telefono}`} className="text-xs text-slate-500 hover:text-cyan-700 flex items-center gap-1">
                                  <Phone size={11} /> {c.telefono}
                                </a>
                                {formatWhatsAppUrl(c.telefono) && (
                                  <a
                                    href={formatWhatsAppUrl(c.telefono, `Hola ${c.nombre}, nos comunicamos desde el Consejo Comunal ${activeConsejo} sobre su caso social.`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white px-1.5 py-0.5 rounded text-[10px] font-bold transition"
                                    title="Contactar vía WhatsApp"
                                  >
                                    <MessageCircle size={10} /> WA
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-500">
                            <span className="font-mono text-xs text-slate-700 font-semibold">{c.cedula || "S/C"}</span>
                            <br />
                            <span className="text-[11px] text-slate-400">{c.calle}</span>
                          </td>
                          <td className="p-3.5 text-rose-600 font-semibold">
                            {c.condicion_especial}
                            {c.condicion_especial === "Otro" && c.condicion_especial_otro ? ` (${c.condicion_especial_otro})` : ""}
                          </td>

                          {/* Tipo de Ayuda Requerida */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <div className="space-y-1 min-w-[140px]">
                                <select 
                                  className={`${inputClass} text-xs py-1 px-2`}
                                  value={editForm.tipo_ayuda}
                                  onChange={e => setEditForm({...editForm, tipo_ayuda: e.target.value})}
                                >
                                  {TIPOS_AYUDA.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Detalle o nombre..."
                                  className={`${inputClass} text-[11px] py-1 px-2`}
                                  value={editForm.tipo_ayuda_detalle}
                                  onChange={e => setEditForm({...editForm, tipo_ayuda_detalle: e.target.value})}
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold px-2 py-0.5 rounded-lg text-xs">
                                  <Package size={11} /> {c.tipo_ayuda || "Medicamentos"}
                                </span>
                                {c.tipo_ayuda_detalle && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 italic">{c.tipo_ayuda_detalle}</p>
                                )}
                              </div>
                            )}
                          </td>
                          
                          {/* Prioridad */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <select 
                                className={`${inputClass} text-xs py-1 px-2`}
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

                          {/* Estado */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <select 
                                className={`${inputClass} text-xs py-1 px-2`}
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
                                "bg-emerald-100 text-emerald-700"
                              }`}>
                                {c.estado_caso || "Pendiente"}
                              </span>
                            )}
                          </td>

                          {/* Observaciones */}
                          <td className="p-3.5">
                            {isEditing ? (
                              <textarea
                                className={`${inputClass} min-h-[55px] text-xs`}
                                value={editForm.notas_caso}
                                onChange={e => setEditForm({...editForm, notas_caso: e.target.value})}
                                placeholder="Añade notas o historial..."
                              />
                            ) : (
                              <p className="text-xs text-slate-500 whitespace-pre-wrap">
                                {c.notas_caso || <span className="italic text-slate-300">Sin observaciones</span>}
                              </p>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="p-3.5 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleSave(c)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer" title="Guardar">
                                  <Save size={16} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer" title="Cancelar">
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Editar seguimiento">
                                <Pencil size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Vista Móvil (Tarjetas Adaptadas) */}
          <div className="block md:hidden space-y-3">
            {casosActivos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400 italic">
                No hay casos sociales activos registrados en tu sector.
              </div>
            ) : (
              casosActivos.map(c => {
                const isEditing = editingId === c.id;
                return (
                  <div 
                    key={c.id} 
                    className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm space-y-2.5 border-l-4 border-l-rose-500"
                  >
                    {/* Header de Tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                          {c.nombre} {c.apellido}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">C.I: {c.cedula || "S/C"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          (c.prioridad_caso || "Media") === "Alta" ? "bg-red-100 text-red-700" :
                          (c.prioridad_caso || "Media") === "Media" ? "bg-amber-100 text-amber-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>
                          {c.prioridad_caso || "Media"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          (c.estado_caso || "Pendiente") === "Pendiente" ? "bg-slate-100 text-slate-600" :
                          (c.estado_caso || "Pendiente") === "En Proceso" ? "bg-blue-100 text-blue-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>
                          {c.estado_caso || "Pendiente"}
                        </span>
                      </div>
                    </div>

                    {/* Grilla de Datos */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 font-semibold block">Condición</span>
                        <span className="text-rose-600 font-bold block truncate">{c.condicion_especial}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">Calle</span>
                        <span className="text-slate-700 font-bold block truncate">{c.calle || "N/A"}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-100">
                        <span className="text-slate-400 font-semibold block">Ayuda Requerida</span>
                        <span className="text-indigo-700 font-bold inline-flex items-center gap-1">
                          <Package size={10} /> {c.tipo_ayuda || "Medicamentos"} {c.tipo_ayuda_detalle ? `(${c.tipo_ayuda_detalle})` : ""}
                        </span>
                      </div>
                      {c.telefono && (
                        <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Phone size={10} /> {c.telefono}
                          </span>
                          {formatWhatsAppUrl(c.telefono) && (
                            <a
                              href={formatWhatsAppUrl(c.telefono, `Hola ${c.nombre}, nos comunicamos desde el Consejo Comunal ${activeConsejo} sobre su caso social.`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded px-1.5 py-0.5 font-bold inline-flex items-center gap-0.5 text-[9px]"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle size={9} /> WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Observaciones si existen y no está editando */}
                    {!isEditing && c.notas_caso && (
                      <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                        {c.notas_caso}
                      </p>
                    )}

                    {/* Formulario de Edición Móvil */}
                    {isEditing ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Prioridad</label>
                            <select 
                              className={`${inputClass} text-xs py-1 px-1.5`}
                              value={editForm.prioridad_caso}
                              onChange={e => setEditForm({...editForm, prioridad_caso: e.target.value})}
                            >
                              <option value="Alta">Alta</option>
                              <option value="Media">Media</option>
                              <option value="Baja">Baja</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Estado</label>
                            <select 
                              className={`${inputClass} text-xs py-1 px-1.5`}
                              value={editForm.estado_caso}
                              onChange={e => setEditForm({...editForm, estado_caso: e.target.value})}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="En Proceso">En Proceso</option>
                              <option value="Atendido">Atendido</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Ayuda Requerida</label>
                          <select 
                            className={`${inputClass} text-xs py-1 px-1.5`}
                            value={editForm.tipo_ayuda}
                            onChange={e => setEditForm({...editForm, tipo_ayuda: e.target.value})}
                          >
                            {TIPOS_AYUDA.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Detalle de la ayuda requerida..."
                            className={`${inputClass} text-[10px] py-1 px-2 mt-1`}
                            value={editForm.tipo_ayuda_detalle}
                            onChange={e => setEditForm({...editForm, tipo_ayuda_detalle: e.target.value})}
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-semibold text-slate-400 block mb-0.5">Observaciones</label>
                          <textarea
                            className={`${inputClass} text-xs min-h-[50px]`}
                            value={editForm.notas_caso}
                            onChange={e => setEditForm({...editForm, notas_caso: e.target.value})}
                            placeholder="Añade notas..."
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSave(c)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Save size={13} /> Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEdit(c)}
                        className="w-full py-1.5 bg-slate-50 hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Pencil size={12} /> Actualizar Seguimiento
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VISTA TAB: HISTORIAL ATENDIDOS */}
      {tab === "historial" && (
        <div className="space-y-3 print:hidden">
          <div className="p-3 sm:p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">Historial de Casos Atendidos y Resueltos</span>
            </div>
            <span className="bg-emerald-200 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {casosAtendidos.length} resueltos
            </span>
          </div>

          {/* Tabla de Historial (Escritorio) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                    <th className="p-3.5">Habitante</th>
                    <th className="p-3.5">Cédula / Calle</th>
                    <th className="p-3.5">Condición</th>
                    <th className="p-3.5">Ayuda Otorgada</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 w-1/4">Observaciones</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {casosAtendidos.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400 italic">
                        No hay casos sociales en el historial.
                      </td>
                    </tr>
                  ) : (
                    casosAtendidos.map(c => {
                      const isEditing = editingId === c.id;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-medium text-slate-700">{c.nombre} {c.apellido}</td>
                          <td className="p-3.5 text-slate-500">{c.cedula || "S/C"}<br/><span className="text-[11px] text-slate-400">{c.calle}</span></td>
                          <td className="p-3.5 text-slate-600 font-semibold">{c.condicion_especial}</td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                              {c.tipo_ayuda || "Medicamentos"} {c.tipo_ayuda_detalle ? `(${c.tipo_ayuda_detalle})` : ""}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {isEditing ? (
                              <select 
                                className={`${inputClass} text-xs py-1 px-2`}
                                value={editForm.estado_caso}
                                onChange={e => setEditForm({...editForm, estado_caso: e.target.value})}
                              >
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Proceso">En Proceso</option>
                                <option value="Atendido">Atendido</option>
                              </select>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                Atendido
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {isEditing ? (
                              <textarea
                                className={`${inputClass} min-h-[55px] text-xs`}
                                value={editForm.notas_caso}
                                onChange={e => setEditForm({...editForm, notas_caso: e.target.value})}
                                placeholder="Añade notas..."
                              />
                            ) : (
                              <p className="text-xs text-slate-500 whitespace-pre-wrap">{c.notas_caso || "Sin observaciones"}</p>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleSave(c)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer"><Save size={16} /></button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"><X size={16} /></button>
                              </div>
                            ) : (
                              <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><Pencil size={16} /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tarjetas Móvil Historial */}
          <div className="block md:hidden space-y-2.5">
            {casosAtendidos.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400 italic">
                No hay casos sociales en el historial.
              </div>
            ) : (
              casosAtendidos.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm space-y-2 border-l-4 border-l-emerald-500">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{c.nombre} {c.apellido}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">C.I: {c.cedula || "S/C"} • {c.calle}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ Atendido
                    </span>
                  </div>
                  <div className="text-[10px] bg-slate-50 p-2 rounded-lg space-y-1">
                    <p><strong>Condición:</strong> {c.condicion_especial}</p>
                    <p><strong>Ayuda:</strong> {c.tipo_ayuda || "Medicamentos"} {c.tipo_ayuda_detalle ? `(${c.tipo_ayuda_detalle})` : ""}</p>
                    {c.notas_caso && <p className="italic text-slate-500 pt-1 border-t border-slate-200/60">"{c.notas_caso}"</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
