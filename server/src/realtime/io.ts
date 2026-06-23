import type { Server as SocketServer } from "socket.io";

// Holds the Socket.IO server so non-socket code (e.g. REST routes) can emit.
let ioRef: SocketServer | null = null;

export function setIo(io: SocketServer) {
  ioRef = io;
}

export function getIo(): SocketServer | null {
  return ioRef;
}
