import http from "http";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectMongo } from "./db/mongo";
import { initSockets } from "./sockets";
import { eventsRouter } from "./routes/events";
import { joinRouter } from "./routes/join";
import { selectionsRouter } from "./routes/selections";

async function main() {
  const app = express();
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: "2mb" }));

  // Health check — used by the frontend to confirm the API is reachable.
  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "speeddating-server",
      phase: 1,
      time: new Date().toISOString(),
    });
  });

  // Phase 1 routes
  app.use("/api/events", eventsRouter);
  app.use("/api/join", joinRouter);
  app.use("/api/selections", selectionsRouter);

  // Error handler — guarantees a response so requests never hang.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      console.error("[api] error:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "server_error" });
    }
  );

  const httpServer = http.createServer(app);
  initSockets(httpServer);

  await connectMongo();

  httpServer.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
