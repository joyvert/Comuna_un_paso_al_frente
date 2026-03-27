import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "..", "CENSO FAMILIAR 2026 ACTUALIZADO.xlsx");

try {
  if (!fs.existsSync(filePath)) {
    console.error("Archivo no encontrado:", filePath);
    process.exit(1);
  }

  const workbook = xlsx.readFile(filePath);
  console.log("=== HOJAS EN EL EXCEL ===");
  console.log(workbook.SheetNames);

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const data = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
  
  console.log("\n=== TOTAL DE FILAS (Hoja 1) ===");
  console.log(data.length);
  
  if (data.length > 0) {
    console.log("\n=== COLUMNAS DETECTADAS ===");
    console.log(Object.keys(data[0]));
    
    console.log("\n=== MUESTRA (Primeras 3 filas) ===");
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  }
} catch (error) {
  console.error("Error leyendo el excel:", error);
}
