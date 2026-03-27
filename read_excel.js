import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "CENSO FAMILIAR 2026 ACTUALIZADO.xlsx");

try {
  if (!fs.existsSync(filePath)) {
    console.error("Archivo no encontrado:", filePath);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: "buffer" });
  console.log("=== HOJAS EN EL EXCEL ===");
  console.log(workbook.SheetNames);

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Leer como matriz 2D
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  
  let currentCalle = "Desconocida";
  const result = { calles: {} };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    
    // Detectar calle en columna 2 (índice 2)
    if (typeof row[2] === 'string' && row[2].toUpperCase().includes("CALLE ")) {
      currentCalle = row[2].trim();
      if (!result.calles[currentCalle]) result.calles[currentCalle] = 0;
    } else if (row[1] && row[1] !== "NOMBRE APELLIDO" && typeof row[1] === 'string') {
      // Es un habitante
      if (!result.calles[currentCalle]) result.calles[currentCalle] = 0;
      result.calles[currentCalle]++;
    }
  }
  
  fs.writeFileSync("excel_sample_utf8.json", JSON.stringify({
    totalRows: rows.length,
    callesDetectadas: result.calles
  }, null, 2), "utf-8");
  
  console.log("Archivo excel_sample_utf8.json creado con éxito.");
} catch (error) {
  console.error("Error leyendo el excel:", error);
}
