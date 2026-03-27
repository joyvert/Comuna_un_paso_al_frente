import { Pool } from "pg";
import { config } from "../config/index.js";

export const pool = new Pool(config.pg);

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    await client.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(40);");
  } finally {
    client.release();
  }
}
