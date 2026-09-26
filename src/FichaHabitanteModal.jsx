import React from "react";
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  HeartPulse, 
  Users, 
  ShieldCheck, 
  Printer, 
  Vote, 
  Home, 
  IdCard, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function FichaHabitanteModal({ habitante, allHabitantes, activeConsejo, onClose, onEdit }) {
  if (!habitante) return null;

  // Determinar núcleo familiar
  const esJefe = Boolean(habitante.es_jefe_familia);
  const tieneJefe = Boolean(habitante.jefe_familia_id);

  let jefeDeFamilia = null;
  let miembrosFamilia = [];

  if (esJefe) {
    jefeDeFamilia = habitante;
    miembrosFamilia = (allHabitantes || []).filter(h => h.jefe_familia_id === habitante.id);
  } else if (tieneJefe) {
    jefeDeFamilia = (allHabitantes || []).find(h => h.id === habitante.jefe_familia_id);
    miembrosFamilia = (allHabitantes || []).filter(
      h => h.jefe_familia_id === habitante.jefe_familia_id && h.id !== habitante.id
    );
  }

  const edadNum = Number(habitante.edad);
  const esVotante = !isNaN(edadNum) && edadNum >= 15 && edadNum <= 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-5 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:fixed">
      <div className="w-full max-w-2xl rounded-2xl md:rounded-3xl bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100 print:max-h-none print:shadow-none print:border-none print:w-full">
        
        {/* Encabezado con degradado moderno */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-6 text-white relative flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner flex-shrink-0">
                <User size={28} className="text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold font-heading text-white leading-tight">
                    {habitante.nombre} {habitante.apellido}
                  </h2>
                  <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    habitante.sexo === "Femenino" ? "bg-pink-500/20 text-pink-300 border border-pink-500/30" : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  }`}>
                    {habitante.sexo || "Masculino"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 mt-1 font-medium">
                  <IdCard size={14} className="text-cyan-400" />
                  Cédula: <strong className="text-white">{habitante.cedula || "No registrada"}</strong>
                </p>
              </div>
            </div>

            {/* Botones de acción del header */}
            <div className="flex items-center gap-1.5 print:hidden">
              <button 
                onClick={handlePrint}
                type="button"
                title="Imprimir Ficha"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer"
              >
                <Printer size={18} />
              </button>
              <button 
                onClick={onClose}
                type="button"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Badges de Estado */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            {esJefe && (
              <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded-full font-semibold border border-amber-400/30">
                <Home size={12} /> Jefe de Familia
              </span>
            )}
            {tieneJefe && (
              <span className="inline-flex items-center gap-1 bg-indigo-400/20 text-indigo-300 px-2.5 py-1 rounded-full font-semibold border border-indigo-400/30">
                <Users size={12} /> Carga Familiar
              </span>
            )}
            {esVotante ? (
              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-semibold border border-emerald-500/30">
                <Vote size={12} /> Padrón Electoral Activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-slate-500/20 text-slate-300 px-2.5 py-1 rounded-full font-semibold border border-slate-500/30">
                Menor de Edad (No Votante)
              </span>
            )}
            {habitante.requiere_ayuda && (
              <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-full font-semibold border border-rose-500/30 animate-pulse">
                <HeartPulse size={12} /> Caso Social Prioritario
              </span>
            )}
          </div>
        </div>

        {/* Cuerpo del expediente */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50/50">
          
          {/* Tarjeta de Información General */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <IdCard size={15} className="text-indigo-500" />
              Datos Personales y Residencia
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase block">Edad</span>
                <span className="font-bold text-slate-800 text-sm sm:text-base">
                  {habitante.edad ? `${habitante.edad} años` : "Sin edad registrada"}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase block">Nacimiento</span>
                <span className="font-bold text-slate-800 text-sm sm:text-base truncate block">
                  {habitante.nacimiento ? new Date(habitante.nacimiento).toLocaleDateString() : "No registrada"}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase block">Teléfono</span>
                {habitante.telefono ? (
                  <a 
                    href={`tel:${habitante.telefono}`} 
                    className="font-bold text-cyan-600 hover:text-cyan-700 text-sm sm:text-base flex items-center gap-1 mt-0.5"
                  >
                    <Phone size={14} /> {habitante.telefono}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-400 italic">Sin número</span>
                )}
              </div>
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-2">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase block">Calle / Escalera</span>
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                  <MapPin size={15} className="text-rose-500 flex-shrink-0" />
                  {habitante.calle || "Calle no asignada"}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase block">Consejo Comunal</span>
                <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block mt-0.5">
                  {activeConsejo || habitante.consejo || "Principal"}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Núcleo Familiar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users size={15} className="text-amber-500" />
              Núcleo Familiar Vinculado
            </h3>

            {esJefe ? (
              <div>
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home size={16} className="text-amber-600" />
                    <span className="text-xs sm:text-sm font-bold text-amber-900">
                      Esta persona es el Jefe de Familia
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">
                    {miembrosFamilia.length} {miembrosFamilia.length === 1 ? "carga" : "cargas"}
                  </span>
                </div>

                {miembrosFamilia.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {miembrosFamilia.map(m => (
                      <div key={m.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs sm:text-sm">
                        <div>
                          <p className="font-bold text-slate-800">{m.nombre} {m.apellido}</p>
                          <p className="text-[11px] text-slate-400">C.I: {m.cedula || "S/C"} • {m.edad ? `${m.edad} años` : "Edad no reg."}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                          {m.sexo || "Familiar"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No tiene cargas familiares vinculadas aún.</p>
                )}
              </div>
            ) : tieneJefe && jefeDeFamilia ? (
              <div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl mb-3">
                  <p className="text-[11px] font-semibold text-indigo-600 uppercase">Jefe de Familia Responsable</p>
                  <p className="text-xs sm:text-sm font-bold text-indigo-950 mt-0.5">
                    {jefeDeFamilia.nombre} {jefeDeFamilia.apellido} (C.I: {jefeDeFamilia.cedula || "S/C"})
                  </p>
                </div>
                {miembrosFamilia.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">Otros familiares en el mismo hogar:</p>
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {miembrosFamilia.map(m => (
                        <div key={m.id} className="p-2.5 bg-slate-50/50 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{m.nombre} {m.apellido}</span>
                          <span className="text-slate-400">{m.edad ? `${m.edad} años` : "S/E"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs text-slate-500 font-medium">Habitante individual sin núcleo familiar configurado.</p>
              </div>
            )}
          </div>

          {/* Caso Social / Atención Especial */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HeartPulse size={15} className="text-rose-500" />
              Estado de Salud y Atención Social
            </h3>
            {habitante.requiere_ayuda ? (
              <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Caso Social Registrado
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    habitante.prioridad_caso === "Alta" ? "bg-rose-200 text-rose-900 font-extrabold" :
                    habitante.prioridad_caso === "Media" ? "bg-amber-200 text-amber-900 font-bold" :
                    "bg-emerald-200 text-emerald-900 font-bold"
                  }`}>
                    Prioridad {habitante.prioridad_caso || "Media"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-rose-950 font-medium">
                  <strong>Condición:</strong> {habitante.condicion_especial || "Condición médica"} 
                  {habitante.condicion_especial_otro ? ` (${habitante.condicion_especial_otro})` : ""}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>No registra requerimiento de atención prioritaria.</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer con acciones */}
        <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Expediente oficial de la Comuna Un Paso Al Frente
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(habitante);
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer"
              >
                Editar Datos
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
