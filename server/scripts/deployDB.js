import pg from 'pg';
import fs from 'fs';
import path from 'path';

const connectionString = 'postgresql://neondb_owner:npg_ZSNI1tF9VLYU@ep-dark-thunder-amnqk2wq-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function deploySchema() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Neon DB successfully!");

    const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Executing schema SQL...");
    await client.query(schemaSql);
    console.log("Schema deployed successfully!");

  } catch (err) {
    console.error("Error deploying schema:", err);
  } finally {
    await client.end();
  }
}

deploySchema();
