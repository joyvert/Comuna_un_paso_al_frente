import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelHabitantesUpload({ consejo, calles, onUpload, inputClass }) {
  const fileInput = useRef();
  const fileInputCenso = useRef();
  const [preview, setPreview] = useState([]);
  const [censoFamilias, setCensoFamilias] = useState([]);
  const [selectedCalle, setSelectedCalle] = useState(calles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState("simple"); // 'simple' o 'censo'

  function resetState() {
    setPreview([]);
    setCensoFamilias([]);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
    if (fileInputCenso.current) fileInputCenso.current.value = "";
  }

  function handleFileSimple(e) {
    resetState();
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const parsed = rows
          .slice(1)
          .map((r) => ({
            nombre: r[0] || "",
            apellido: r[1] || "",
            cedula: r[2] || "",
            telefono: r[3] || "",
            nacimiento: r[4] || "",
          }))
          .filter((r) => r.nombre && r.apellido && r.cedula);
        setPreview(parsed);
      } catch (err) {
        setError("Archivo inválido o corrupto.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileCenso(e) {
    resetState();
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        
        const familias = [];
        
        for (const sheetName of workbook.SheetNames) {
          const calleName = sheetName.trim();
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          
          let currentJefe = null;
          
          for (let i = 0; i < rows.length; i++) {
             const row = rows[i] || [];
             if (row[1] && row[1] !== "NOMBRE APELLIDO" && String(row[1]).trim() !== "") {
                const isJefe = row[0] !== "" && row[0] !== null;
                const fullName = String(row[1]).trim();
                const sep = fullName.lastIndexOf(" ");
                let nombre = fullName, apellido = "";
                if (sep !== -1) {
                  nombre = fullName.slice(0, sep).trim();
                  apellido = fullName.slice(sep + 1).trim();
                } else {
                  nombre = fullName;
                }
                
                const habitante = {
                  nombre,
                  apellido,
                  cedula: String(row[2] || "").trim() || "",
                  telefono: String(row[4] || "").replace(/[^0-9-]/g, "") || "",
                  calle: calleName
                };
                
                if (isJefe) {
                   currentJefe = habitante;
                   familias.push({ jefe: habitante, dependientes: [] });
                } else if (currentJefe && familias.length > 0) {
                   familias[familias.length - 1].dependientes.push(habitante);
                } else {
                   familias.push({ jefe: habitante, dependientes: [] });
                   currentJefe = habitante;
                }
             }
          }
        }
        setCensoFamilias(familias);
      } catch (err) {
        setError("Formato de Censo Familiar 2026 no reconocido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    if (!preview.length && !censoFamilias.length) return;
    setLoading(true);
    setError("");
    try {
      if (importMode === "simple") {
        await onUpload(preview.map((h) => ({ ...h, calle: selectedCalle })));
      } else {
        await onUpload({ mode: "bulk", familias: censoFamilias });
      }
      resetState();
    } catch (err) {
      setError(err?.message || "Error al cargar habitantes.");
    } finally {
      setLoading(false);
    }
  }
  
  const totalPersonasCenso = censoFamilias.reduce((acc, f) => acc + 1 + f.dependientes.length, 0);

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm space-y-4">
      <div className="font-semibold text-slate-800">Carga Masiva de Habitantes</div>
      
      <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
        <button 
          onClick={() => { setImportMode("simple"); resetState(); }}
          className={`px-3 py-1 text-sm font-medium rounded-t-lg ${importMode === "simple" ? "bg-slate-100 text-blue-700 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Plantilla Simple
        </button>
        <button 
          onClick={() => { setImportMode("censo"); resetState(); }}
          className={`px-3 py-1 text-sm font-medium rounded-t-lg ${importMode === "censo" ? "bg-slate-100 text-purple-700 border-b-2 border-purple-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Censo Familiar 2026 (Familias)
        </button>
      </div>

      {importMode === "simple" ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInput}
            className={inputClass}
            onChange={handleFileSimple}
            disabled={loading}
          />
          <div>
            <label className="block mb-1 text-xs font-semibold text-slate-700">Asignar calle por defecto</label>
            <select
              className={inputClass}
              value={selectedCalle}
              onChange={(e) => setSelectedCalle(e.target.value)}
              disabled={loading}
            >
              {calles.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-800 border border-purple-100">
            <span className="font-semibold block mb-1">Estructura requerida:</span>
            Un archivo de Excel con una pestaña por cada Calle (el nombre de la pestaña será la calle). En cada hoja, la fila de datos requiere el Jefe de Familia marcado con un número a la izquierda, seguido por sus dependientes sin número.
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputCenso}
            className={inputClass}
            onChange={handleFileCenso}
            disabled={loading}
          />
        </div>
      )}

      {error && <div className="text-red-500 bg-red-50 p-2 rounded text-sm text-center border border-red-200 font-medium">{error}</div>}

      {/* Previews */}
      {preview.length > 0 && importMode === "simple" && (
        <div className="space-y-2 mt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Muestra de datos (Primeros 5 registros):</div>
          <div className="overflow-hidden border rounded-lg bg-slate-50 text-xs">
            <table className="min-w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-200 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Cédula</th>
                  <th className="px-3 py-2">Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-medium">{r.nombre} {r.apellido}</td>
                    <td className="px-3 py-2">{r.cedula}</td>
                    <td className="px-3 py-2">{r.telefono}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-right text-slate-400">Total a importar: {preview.length}</div>
        </div>
      )}

      {censoFamilias.length > 0 && importMode === "censo" && (
        <div className="space-y-2 mt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Muestra del Censo (Primeras 2 familias):</div>
          <div className="space-y-2">
            {censoFamilias.slice(0, 2).map((fam, idx) => (
              <div key={idx} className="border border-purple-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                  <span className="text-lg">🏠</span>
                  <div>
                    <div className="font-semibold text-slate-800">{fam.jefe.nombre} {fam.jefe.apellido}</div>
                    <div className="text-xs text-slate-500">Jefe de Familia • {fam.jefe.calle}</div>
                  </div>
                </div>
                {fam.dependientes.length > 0 ? (
                  <ul className="pl-8 list-none space-y-1">
                    {fam.dependientes.map((d, i) => (
                       <li key={i} className="text-sm text-slate-600 flex justify-between">
                         <span>↳ {d.nombre} {d.apellido}</span>
                         <span className="text-slate-400 text-xs">{d.cedula}</span>
                       </li>
                    ))}
                  </ul>
                ) : (
                  <div className="pl-8 text-xs text-slate-400 italic">Sin dependientes registrados</div>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-right text-slate-600 font-medium">Total: {censoFamilias.length} familias, {totalPersonasCenso} personas.</div>
        </div>
      )}

      <button
        type="button"
        className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition-all shadow-sm ${
          loading || (!preview.length && !censoFamilias.length) 
            ? "bg-slate-300 cursor-not-allowed text-slate-500" 
            : importMode === "censo" ? "bg-purple-600 hover:bg-purple-700" : "bg-[#0f2847] hover:bg-[#12345f]"
        }`}
        onClick={handleUpload}
        disabled={loading || (!preview.length && !censoFamilias.length)}
      >
        {loading ? "Procesando Importación..." : importMode === "censo" ? "Registrar Familias del Censo" : "Cargar Habitantes (Catálogo Simple)"}
      </button>
    </div>
  );
}
