import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
});

const connectedUsers = new Map();
let activeConnections = 0;
let idleTimer = null;

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

function startIdleShutdownTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  console.log("🕐 Starting 5-minute idle timer...");

  idleTimer = setTimeout(
    () => {
      console.log("🛑 No clients for 5 minutes. Exiting app to sleep...");
      process.exit(0);
    },
    5 * 60 * 1000
  );
}

// WebSocket connection
io.on("connection", (socket) => {
  activeConnections++;

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
    console.log("🟢 Idle timer cancelled - active clients exist.");
  }

  console.log(`🟢 New user connected: ${socket.id}`);

  socket.on("registerUser", ({ userId, type }) => {
    console.log(`📨 registerUser: ${userId} (${type})`);
    socket.userId = userId;
    socket.clientType = type;

    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket);
  });

  socket.on("client-donation", (donation, userId) => {
    console.log("donation", donation);
    console.log("from user:", userId);

    const sockets = connectedUsers.get(userId);
    if (sockets) {
      for (const peer of sockets) {
        if (peer.clientType === "overlay") {
          peer.emit("overlayAlert", donation, userId);
        }
      }
    } else {
      console.warn(`⚠️ No sockets found for user ${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Disconnected: ${socket.id}`);
    const userId = socket.userId;
    console.log(`⚠️ Client disconnected. Total: ${activeConnections}`);
    activeConnections--;
    if (activeConnections === 0) {
      startIdleShutdownTimer();
    }
    if (userId && connectedUsers.has(userId)) {
      const userSockets = connectedUsers.get(userId);
      userSockets.forEach((s) => {
        if (s === socket) userSockets.delete(s);
      });

      if (userSockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
