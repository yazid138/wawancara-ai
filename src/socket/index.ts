import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import setupInterviewSocket from "./interview.socket";
import socketAuth from "@/middleware/socketAuth";

export let io: Server;

export default function initializeSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}, User: ${socket.data.user.id}`);

    setupInterviewSocket(io, socket);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
