import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import cors from "cors";
import fs from "fs";

async function startServer() {
  try {
    const app = express();
    const PORT = Number(process.env.PORT) || 3000; 

    // Caminho do banco configurável para persistência no Render (ex: /var/data/database.db)
    const dbPath = process.env.DATABASE_PATH || "database.db";
    const db = new Database(dbPath);
    console.log(`Database connected successfully at ${dbPath}`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        encoding TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        userName TEXT,
        detectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS active_stations (
        machineId TEXT PRIMARY KEY,
        lastSnapshot TEXT,
        lastDetectedUser TEXT,
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    app.use(cors());
    app.use(express.json({ limit: "50mb" }));

    // API Routes
    app.post("/api/heartbeat", (req, res) => {
      const { machineId, snapshot, lastDetectedUser } = req.body;
      try {
        const stmt = db.prepare(`
          INSERT INTO active_stations (machineId, lastSnapshot, lastDetectedUser, lastSeen)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(machineId) DO UPDATE SET
            lastSnapshot = excluded.lastSnapshot,
            lastDetectedUser = excluded.lastDetectedUser,
            lastSeen = CURRENT_TIMESTAMP
        `);
        stmt.run(machineId, snapshot, lastDetectedUser);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to update heartbeat" });
      }
    });

    app.get("/api/stations", (req, res) => {
      try {
        // Estações ativas nos últimos 20 segundos
        const stations = db.prepare(`
          SELECT * FROM active_stations 
          WHERE lastSeen > datetime('now', '-20 seconds')
          ORDER BY lastSeen DESC
        `).all();
        res.json(stations);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch stations" });
      }
    });
    app.post("/api/register", (req, res) => {
      const { name, phone, encoding } = req.body;
      try {
        const stmt = db.prepare("INSERT INTO users (name, phone, encoding) VALUES (?, ?, ?)");
        const result = stmt.run(name, phone, JSON.stringify(encoding));
        res.json({ success: true, id: result.lastInsertRowid });
      } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Failed to register user" });
      }
    });

    app.post("/api/logs", (req, res) => {
      const { userName } = req.body;
      try {
        // Encontrar o ID do usuário pelo nome (simplificado)
        const user = db.prepare("SELECT id FROM users WHERE name = ?").get(userName) as { id: number } | undefined;
        const stmt = db.prepare("INSERT INTO access_logs (userId, userName) VALUES (?, ?)");
        stmt.run(user?.id || null, userName);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to log access" });
      }
    });

    app.get("/api/logs", (req, res) => {
      try {
        const logs = db.prepare("SELECT * FROM access_logs ORDER BY detectedAt DESC LIMIT 100").all();
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch logs" });
      }
    });

    app.get("/api/users", (req, res) => {
      try {
        const users = db.prepare("SELECT id, name, phone, createdAt FROM users").all();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    app.get("/api/users/encodings", (req, res) => {
      try {
        const users = db.prepare("SELECT name, encoding FROM users").all();
        const formatted = users.map(u => ({
          name: u.name,
          encoding: JSON.parse(String(u.encoding))
        }));
        res.json(formatted);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch encodings" });
      }
    });

    app.delete("/api/users/:id", (req, res) => {
      const { id } = req.params;
      try {
        db.prepare("DELETE FROM access_logs WHERE userId = ?").run(id);
        db.prepare("DELETE FROM users WHERE id = ?").run(id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete user" });
      }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production" && !process.env.RENDER) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err: any) {
    console.error(`FATAL ERROR: ${err.message}`);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error(`UNHANDLED REJECTION: ${err.message}`);
});
