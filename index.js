// server.js (Fly.io-compatible Socket.IO backend with overlay-aware shutdown)
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
let overlayConnections = 0;
let idleTimer = null;
const IDLE_TIMEOUT_MINUTES = 10;

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    activeConnections,
    overlays: overlayConnections,
    connectedUsers: connectedUsers.size,
  });
});

function startIdleShutdownTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  console.log(
    `\u23f0 Starting ${IDLE_TIMEOUT_MINUTES}-minute idle shutdown timer...`
  );

  idleTimer = setTimeout(
    () => {
      console.log(
        "\u274c No overlay clients active. Shutting down server to sleep..."
      );
      process.exit(0);
    },
    IDLE_TIMEOUT_MINUTES * 60 * 1000
  );
}

io.on("connection", (socket) => {
  activeConnections++;
  console.log(
    `\u2705 Socket connected: ${socket.id}. Total active: ${activeConnections}`
  );

  socket.on("registerUser", ({ userId, type }) => {
    socket.userId = userId;
    socket.clientType = type;

    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket);

    if (type === "overlay") {
      overlayConnections++;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
        console.log("\u2705 Overlay connected. Idle timer cancelled.");
      }
      console.log(
        `\u2728 Overlay registered for ${userId}. Total overlays: ${overlayConnections}`
      );
    }
  });

  socket.on("client-donation", (donation, userId) => {
    console.log(`\ud83d\udcb8 Donation from ${userId}:`, donation);
    const sockets = connectedUsers.get(userId);
    if (sockets) {
      for (const peer of sockets) {
        if (peer.clientType === "overlay") {
          peer.emit("overlayAlert", donation, userId);
        }
      }
    } else {
      console.warn(`\u26a0\ufe0f No overlay sockets found for user ${userId}`);
    }
  });

  socket.on("disconnect", () => {
    activeConnections--;
    const { userId, clientType } = socket;
    console.log(
      `\ud83d\udd34 Socket disconnected: ${socket.id}. Type: ${clientType}`
    );

    if (userId && connectedUsers.has(userId)) {
      const userSockets = connectedUsers.get(userId);
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }

    if (clientType === "overlay") {
      overlayConnections--;
      console.log(
        `\ud83d\udd0c Overlay disconnected. Total overlays: ${overlayConnections}`
      );
      if (overlayConnections === 0) {
        startIdleShutdownTimer();
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\ud83d\ude80 Server listening on port ${PORT}`);
});
