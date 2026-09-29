import React, { useState } from "react";
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  AlertTriangle, 
  FileJson, 
  CheckCircle2, 
  RefreshCw,
  HardDriveDownload,
  Calendar,
  Layers
} from "lucide-react";
import { api } from "./api";

export default function RespaldoBaseDatos({ onMessage, onRefreshData }) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);

  // Descarga del respaldo en formato JSON
  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await api.exportDatabaseBackup();
      if (!res.ok || !res.backup) {
        throw new Error(res.message || "Error al exportar base de datos");
      }

      const jsonStr = JSON.stringify(res.backup, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      const filename = `respaldo_comuna_${datePart}_${timePart}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onMessage?.({
        type: "success",
        text: `Respaldo guardado exitosamente: ${filename}`
      });
    } catch (err) {
      onMessage?.({
        type: "error",
        text: err.message || "Fallo al generar archivo de respaldo."
      });
    } finally {
      setDownloading(false);
    }
  };

  // Selección y lectura previa del archivo JSON
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      onMessage?.({
        type: "error",
        text: "Por favor selecciona un archivo con extensión .json válido."
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        if (!parsed.data || typeof parsed.data !== "object") {
          throw new Error("El archivo no tiene la estructura de respaldo de la Comuna.");
        }
        setBackupFile(parsed);
        
        // Conteo para resumen
        const counts = {};
        Object.keys(parsed.data).forEach(col => {
          counts[col] = Array.isArray(parsed.data[col]) ? parsed.data[col].length : 0;
        });
        setPreviewData({
          metadata: parsed.metadata || {},
          counts,
          fileName: file.name
        });
      } catch (err) {
        setBackupFile(null);
        setPreviewData(null);
        onMessage?.({
          type: "error",
          text: "Archivo JSON inválido o dañado: " + err.message
        });
      }
    };
    reader.readAsText(file);
  };

  // Confirmar y aplicar la restauración
  const handleRestore = async () => {
    if (!backupFile) return;
    setUploading(true);
    setConfirmModal(false);

    try {
      const res = await api.restoreDatabaseBackup(backupFile);
      if (!res.ok) {
        throw new Error(res.message || "Error al restaurar respaldo");
      }
      onMessage?.({
        type: "success",
        text: res.message || `Base de datos restaurada correctamente.`
      });
      setBackupFile(null);
      setPreviewData(null);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      onMessage?.({
        type: "error",
        text: "Error durante la restauración: " + err.message
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header del módulo */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/30">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-bold font-heading">
              Centro de Respaldo y Restauración
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Genera copias de seguridad de toda la información de la Comuna o restaura datos desde un archivo JSON.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de 2 Tarjetas: Descargar y Restaurar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* TARJETA 1: Exportar / Descargar Respaldo */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-3.5 border border-cyan-100">
              <Download size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-heading">
              Exportar Copia de Seguridad
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Descarga un archivo <strong className="text-slate-700">JSON</strong> seguro que contiene todos los habitantes de los 5 consejos comunales, voceros, jornadas de servicios, pagos y auditoría.
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Incluye censos familiares y casos prioritarios</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Compatible para restauraciones en cualquier momento</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Genera registro en el libro de auditoría</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={downloading}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            {downloading ? (
              <>
                <RefreshCw size={16} className="animate-spin text-cyan-400" />
                <span>Generando copia completa...</span>
              </>
            ) : (
              <>
                <HardDriveDownload size={16} className="text-cyan-400" />
                <span>Descargar Respaldo JSON</span>
              </>
            )}
          </button>
        </div>

        {/* TARJETA 2: Restaurar / Subir Respaldo */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3.5 border border-indigo-100">
              <Upload size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-heading">
              Restaurar Base de Datos
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Carga un archivo de respaldo previo para sincronizar o recuperar registros de habitantes, grupos familiares y jornadas.
            </p>

            {/* Input para seleccionar archivo */}
            <div className="mt-4">
              <label className="block p-4 border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-xl cursor-pointer transition text-center">
                <FileJson size={28} className="mx-auto text-indigo-400 mb-1" />
                <span className="text-xs font-bold text-slate-700 block">
                  {previewData?.fileName || "Haz clic para seleccionar archivo .JSON"}
                </span>
                <span className="text-[11px] text-slate-400">
                  Solo archivos generados por este sistema
                </span>
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Previsualización del archivo si fue cargado */}
            {previewData && (
              <div className="mt-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between text-indigo-950 font-bold">
                  <span>Resumen del Respaldo:</span>
                  <span className="text-[10px] text-indigo-600 font-normal">
                    {previewData.metadata.fecha_exportacion ? new Date(previewData.metadata.fecha_exportacion).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                  <span>👥 Habitantes: <strong>{previewData.counts.habitantes || 0}</strong></span>
                  <span>🛡️ Voceros: <strong>{previewData.counts.usuarios || 0}</strong></span>
                  <span>📦 Servicios: <strong>{previewData.counts.jornadas || 0}</strong></span>
                  <span>💵 Pagos: <strong>{previewData.counts.pagos || 0}</strong></span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConfirmModal(true)}
            disabled={!backupFile || uploading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Restaurando registros...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Restaurar Datos Ahora</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Modal de Advertencia y Confirmación antes de Restaurar */}
      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in text-center">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertTriangle size={30} />
            </div>

            <h3 className="text-lg font-bold text-slate-800 font-heading mb-1.5">
              ¿Confirmar Restauración de Base de Datos?
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Los datos contenidos en el archivo serán combinados y actualizados en la base de datos de Firebase. Los registros con el mismo identificador serán actualizados con los datos del respaldo.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(false)}
                className="flex-1 py-2.5 px-4 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestore}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
              >
                Sí, Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
