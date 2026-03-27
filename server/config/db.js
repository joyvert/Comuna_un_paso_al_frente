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
    
    // Auto-migración de datos de calles re-nombradas
    await client.query("UPDATE habitantes SET calle = 'Calle principal La Esperanza' WHERE calle = 'El Plan'");
    await client.query("UPDATE usuarios SET calle = 'Calle principal La Esperanza' WHERE calle = 'El Plan'");
  } finally {
    client.release();
  }
}
