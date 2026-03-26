import { Pool } from "pg";
import { config } from "../config/index.js";

export const pool = new Pool(config.pg);

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}
