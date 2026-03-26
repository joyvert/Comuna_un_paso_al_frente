import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelHabitantesUpload({ consejo, calles, onUpload, inputClass }) {
  const fileInput = useRef();
  const [preview, setPreview] = useState([]);
  const [selectedCalle, setSelectedCalle] = useState(calles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e) {
    setError("");
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        // Expecting: Nombre, Apellido, Cédula, Teléfono, Nacimiento (YYYY-MM-DD)
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

  async function handleUpload() {
    if (!preview.length) return;
    setLoading(true);
    setError("");
    try {
      await onUpload(preview.map((h) => ({ ...h, calle: selectedCalle })));
      setPreview([]);
      fileInput.current.value = "";
    } catch (err) {
      setError(err?.message || "Error al cargar habitantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-md space-y-4">
      <div className="font-semibold text-[#0f2847]">Carga masiva de habitantes (Excel)</div>
      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInput}
        className={inputClass}
        onChange={handleFile}
        disabled={loading}
      />
      <div>
        <label className="block mb-1 text-xs font-semibold text-slate-700">Calle para todos</label>
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
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-600">Previsualización ({preview.length} registros):</div>
          <div className="max-h-32 overflow-y-auto border rounded bg-slate-50 p-2 text-xs">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2">Nombre</th>
                  <th className="px-2">Apellido</th>
                  <th className="px-2">Cédula</th>
                  <th className="px-2">Teléfono</th>
                  <th className="px-2">Nacimiento</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="px-2">{r.nombre}</td>
                    <td className="px-2">{r.apellido}</td>
                    <td className="px-2">{r.cedula}</td>
                    <td className="px-2">{r.telefono}</td>
                    <td className="px-2">{r.nacimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && <div className="text-xs text-slate-400">…y más</div>}
          </div>
        </div>
      )}
      <button
        type="button"
        className="rounded-xl bg-[#0f2847] px-4 py-2 font-medium text-white hover:bg-[#12345f] disabled:bg-slate-300"
        onClick={handleUpload}
        disabled={loading || !preview.length}
      >
        {loading ? "Cargando…" : "Cargar habitantes"}
      </button>
    </div>
  );
}
