import { useMemo } from "react";
import { Printer, BookOpen } from "lucide-react";

export default function CuadernilloElectoral({ activeConsejo, db }) {
  const habitantes = db[activeConsejo]?.habitantes || [];

  const votantes = useMemo(() => {
    // Filtrar mayores de 15 años
    const validos = habitantes.filter((h) => {
      const edad = Number(h.edad);
      return !isNaN(edad) && edad >= 15;
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

  return (
    <div className="flex flex-col flex-1 min-h-0 print:block print:m-0 print:p-8">
      <style>
        {`
          @media print {
            @page {
              size: letter;
              margin: 0;
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
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition"
        >
          <Printer size={18} />
          Imprimir Cuadernillo
        </button>
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
                    No hay habitantes mayores de 15 años registrados.
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
