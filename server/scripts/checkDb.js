import pg from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_ZSNI1tF9VLYU@ep-dark-thunder-amnqk2wq-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkDb() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT user_id, nombre, apellido FROM usuarios');
    console.log("Usuarios en la base de datos:");
    console.table(res.rows);
  } finally {
    await client.end();
  }
}
checkDb();
