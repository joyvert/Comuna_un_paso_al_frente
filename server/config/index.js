import dotenv from "dotenv";
dotenv.config();

export const config = {
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-jwt-secret-cambiar-en-produccion"),
  pg: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || "comuna_db",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "",
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      },
  apiPort: Number(process.env.API_PORT || 4000),
  /** Si es "true", POST /auth/register queda público (solo para arranque inicial). */
  allowPublicRegister: process.env.ALLOW_PUBLIC_REGISTER === "true",
};
