import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "comuna_db",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

