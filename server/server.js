import cors from "cors";
import express from "express";
import { testConnection } from "./config/db.js";
import { config } from "./config/index.js";
import authRoutes from "./routes/authRoutes.js";
import dataRoutes from "./routes/data.js";
import setupRoutes from "./routes/setup.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandlers.js";

const app = express();

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*'
}));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, message: "API y PostgreSQL operativos." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Error de conexión con PostgreSQL.", error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/setup", setupRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.apiPort, async () => {
  try {
    await testConnection();
    console.log(`API lista en http://localhost:${config.apiPort}`);
  } catch (error) {
    console.error("API iniciada, pero PostgreSQL no responde:", error.message);
  }
});

