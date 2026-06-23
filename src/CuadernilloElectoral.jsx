import { useState, useRef, useEffect, useMemo } from "react";
import { Printer, BookOpen, Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";

export default function CuadernilloElectoral({ activeConsejo, db }) {
  const habitantes = db[activeConsejo]?.habitantes || [];
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const votantes = useMemo(() => {
    // Filtrar de 15 a 100 años
    const validos = habitantes.filter((h) => {
      const edad = Number(h.edad);
      return !isNaN(edad) && edad >= 15 && edad <= 100;
    });

    // Ordenar por cédula (menor a mayor)
    return validos.sort((a, b) => {
      const cedA = Number(String(a.cedula).replace(/\D/g, ""));
      const cedB = Number(String(b.cedula).replace(/\D/g, ""));
      return cedA - cedB;
    });
  }, [habitantes]);

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    if (!votantes || votantes.length === 0) {
      alert("No hay votantes registrados para exportar.");
      return;
    }
    // Title rows
    const headers = [
      ["REPÚBLICA BOLIVARIANA DE VENEZUELA"],
      ["MINISTERIO DEL PODER POPULAR PARA LAS COMUNAS Y LOS MOVIMIENTOS SOCIALES"],
      [`CONSEJO COMUNAL: ${activeConsejo ? activeConsejo.toUpperCase() : ""}`],
      ["CUADERNILLO ELECTORAL"],
      [], // empty row
      ["#", "Cédula", "Nombres", "Apellidos", "Consejo Comunal", "Voto", "Firma"]
    ];

    // Data rows
    const rows = votantes.map((v, index) => [
      index + 1,
      v.cedula || "",
      v.nombre ? String(v.nombre).toUpperCase() : "",
      v.apellido ? String(v.apellido).toUpperCase() : "",
      activeConsejo || "",
      "", // Voto
      ""  // Firma
    ]);

    const aoa = [...headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 6 },  // #
      { wch: 15 }, // Cédula
      { wch: 25 }, // Nombres
      { wch: 25 }, // Apellidos
      { wch: 30 }, // Consejo Comunal
      { wch: 10 }, // Voto
      { wch: 20 }  // Firma
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cuadernillo Electoral");
    
    const fileName = `Cuadernillo_Electoral_${activeConsejo ? activeConsejo.replace(/\s+/g, "_") : "Comuna"}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportToWord = () => {
    if (!votantes || votantes.length === 0) {
      alert("No hay votantes registrados para exportar.");
      return;
    }
    const htmlRows = votantes.map((v, index) => `
      <tr>
        <td style="text-align: center; border: 1px solid #000000; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #000000; padding: 6px;">${v.cedula || ""}</td>
        <td style="text-transform: uppercase; border: 1px solid #000000; padding: 6px;">${v.nombre || ""}</td>
        <td style="text-transform: uppercase; border: 1px solid #000000; padding: 6px;">${v.apellido || ""}</td>
        <td style="border: 1px solid #000000; padding: 6px;">${activeConsejo || ""}</td>
        <td style="border: 1px solid #000000; padding: 6px; text-align: center;">
          <div style="width: 20px; height: 20px; border: 1px solid #000000; margin: 0 auto;"></div>
        </td>
        <td style="border: 1px solid #000000; padding: 6px;"></td>
      </tr>
    `).join("");

    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Cuadernillo Electoral</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 8.5in 11in; /* Letter size */
            margin: 0.4in 0.4in 0.4in 0.4in; /* Narrow margins to maximize space */
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 10.5pt;
            margin: 0;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            text-transform: uppercase;
          }
          .header p {
            margin: 2px 0;
            font-weight: bold;
            font-size: 9.5pt;
          }
          .title {
            font-size: 13pt;
            font-weight: bold;
            text-decoration: underline;
            margin-top: 15px;
            margin-bottom: 25px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            border: 1px solid #000000;
            padding: 8px;
            text-align: left;
            font-size: 10pt;
            background-color: #f2f2f2;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <p>República Bolivariana de Venezuela</p>
          <p>Ministerio del Poder Popular para las Comunas y los Movimientos Sociales</p>
          <p>Consejo Comunal: ${(activeConsejo || "").toUpperCase()}</p>
          <div class="title">CUADERNILLO ELECTORAL</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 4%;">#</th>
              <th style="width: 12%;">Cédula</th>
              <th style="width: 24%;">Nombres</th>
              <th style="width: 24%;">Apellidos</th>
              <th style="width: 18%;">Consejo Comunal</th>
              <th style="text-align: center; width: 6%;">Voto</th>
              <th style="width: 12%;">Firma</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Create a Blob from the content
    const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cuadernillo_Electoral_${activeConsejo ? activeConsejo.replace(/\s+/g, "_") : "Comuna"}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="flex flex-col flex-1 min-h-0 print:block print:m-0 print:p-8">
      <style>
        {`
          @media print {
            @page {
              size: auto;
              margin: 0mm !important;
            }
          }
        `}
      </style>
      <div className="flex justify-between items-center print:hidden mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-500" />
            Cuadernillo Electoral
          </h2>
          <p className="text-sm text-slate-500">Padrón de votantes registrados en {activeConsejo}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold border border-indigo-100 shadow-sm">
            Total Votantes (15 a 100 años): {votantes.length}
          </div>
        </div>
        {/* Dropdown Container */}
        <div className="relative inline-block text-left" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition font-medium shadow-sm cursor-pointer select-none"
          >
            <Download size={18} />
            <span>Descargar / Imprimir</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-lg border border-slate-200 py-1.5 z-50 origin-top-right focus:outline-none animate-in fade-in slide-in-from-top-1 duration-100">
              <button
                onClick={() => {
                  handlePrint();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left cursor-pointer font-medium"
              >
                <Printer size={16} className="text-slate-500" />
                <span>Imprimir / Guardar PDF</span>
              </button>
              
              <button
                onClick={() => {
                  exportToExcel();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left cursor-pointer font-medium"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Descargar en Excel (.xlsx)</span>
              </button>
              
              <button
                onClick={() => {
                  exportToWord();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left cursor-pointer font-medium"
              >
                <FileText size={16} className="text-blue-600" />
                <span>Descargar en Word (.doc)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <div className="text-center mb-4">
          <p className="font-bold text-sm uppercase">República Bolivariana de Venezuela</p>
          <p className="font-bold text-sm uppercase">Ministerio del Poder Popular para las Comunas y los Movimientos Sociales</p>
          <p className="font-bold text-sm uppercase">Consejo Comunal: {activeConsejo}</p>
          <br />
          <h1 className="text-xl font-bold underline mb-2">CUADERNILLO ELECTORAL</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none print:overflow-visible flex flex-col flex-1 min-h-0 print:block">
        <div className="overflow-auto flex-1 print:overflow-visible custom-scrollbar print:block">
          <table className="w-full text-left border-collapse print:text-[11px]">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] print:static print:shadow-none">
              {/* Spacer row for print to simulate top margin on repeated headers */}
              <tr className="hidden print:table-row">
                <th colSpan="7" className="h-10 border-0"></th>
              </tr>
              <tr className="border-b-2 border-slate-300 text-slate-700 text-sm print:text-[11px]">
                <th className="p-3 border-r border-slate-200 font-bold text-center w-12">#</th>
                <th className="p-3 border-r border-slate-200 font-bold">Cédula</th>
                <th className="p-3 border-r border-slate-200 font-bold">Nombres</th>
                <th className="p-3 border-r border-slate-200 font-bold">Apellidos</th>
                <th className="p-3 border-r border-slate-200 font-bold w-1/4">Consejo Comunal</th>
                <th className="p-3 border-r border-slate-200 font-bold text-center w-20">Voto</th>
                <th className="p-3 font-bold text-center w-32">Firma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm print:text-[11px]">
              {votantes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    No hay habitantes entre 15 y 100 años registrados.
                  </td>
                </tr>
              ) : (
                votantes.map((v, index) => (
                  <tr key={v.id} className="hover:bg-slate-50 print:break-inside-avoid">
                    <td className="p-3 border-r border-slate-200 text-center font-medium text-slate-500">{index + 1}</td>
                    <td className="p-3 border-r border-slate-200 font-medium text-slate-700">{v.cedula}</td>
                    <td className="p-3 border-r border-slate-200 uppercase text-slate-700">{v.nombre}</td>
                    <td className="p-3 border-r border-slate-200 uppercase text-slate-700">{v.apellido}</td>
                    <td className="p-3 border-r border-slate-200 text-slate-600">{activeConsejo}</td>
                    <td className="p-3 border-r border-slate-200">
                      <div className="w-6 h-6 border-2 border-slate-400 rounded-sm mx-auto"></div>
                    </td>
                    <td className="p-3"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
