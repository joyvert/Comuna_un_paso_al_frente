import { Pool } from "pg";
import { config } from "../config/index.js";

export const pool = new Pool(config.pg);

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    await client.query(`
      CREATE TABLE IF NOT EXISTS votos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        habitante_id UUID REFERENCES habitantes(id) ON DELETE CASCADE UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
