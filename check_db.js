import pg from "pg";
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_ZSNI1tF9VLYU@ep-dark-thunder-amnqk2wq-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL on Neon!");
    
    // List tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);
    console.log("Tables:", tables.rows.map(r => r.table_name));
    
    // Check tables
    for (const t of tables.rows) {
      console.log(`Querying ${t.table_name}...`);
      const res = await client.query(`SELECT * FROM "${t.table_name}" LIMIT 5`);
      console.log(`Rows in ${t.table_name}:`, res.rows);
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}

run();
