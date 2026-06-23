import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { env } from "../config/env";
import { registerWaitingRoom } from "../realtime/waitingRoom";
import { setIo } from "../realtime/io";

/**
 * Bootstrap Socket.IO and register the realtime handlers.
 */
export function initSockets(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.clientOrigins, methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Phase 0 health round-trip (kept for the home-page system check).
    socket.on("ping:test", (msg) => {
      socket.emit("pong:test", { received: msg, at: Date.now() });
    });

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  // Make io available to REST routes (e.g. match notifications).
  setIo(io);

  // Phase 2 waiting-room + presence handlers.
  registerWaitingRoom(io);

  return io;
}
