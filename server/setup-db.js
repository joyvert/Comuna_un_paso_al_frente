import dotenv from "dotenv";
import pg from "pg";
import fs from "fs";

// Load environment variables
dotenv.config();

const { Pool } = pg;
console.log("PGPASSWORD value:", process.env.PGPASSWORD);
console.log("PGPASSWORD type:", typeof process.env.PGPASSWORD);
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "comuna_db",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

async function applySchema() {
  const schemaPath = "server/sql/schema.sql";
  if (!fs.existsSync(schemaPath)) {
    console.error("Schema file not found:", schemaPath);
    return;
  }
  const schema = fs.readFileSync(schemaPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Error applying schema:", err);
  } finally {
    client.release();
  }
}

async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("Database connection successful.");
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    client.release();
  }
}

// Run test and apply schema
(async () => {
  await testConnection();
  await applySchema();
})();
