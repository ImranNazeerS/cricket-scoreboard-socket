import { Server } from "socket.io";

let io;
let cachedScores = [];

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [process.env.FRONTEND_URL],
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(
      `🟢 User connected: ${socket.id} from ${socket.handshake.headers.origin}`
    );

    if (socket.handshake.headers.origin !== process.env.FRONTEND_URL) {
      console.log(
        `❌ Unauthorized access attempt from ${socket.handshake.headers.origin}`
      );
      socket.disconnect();
      return;
    }

     io.emit("cricketScores", matches);

    socket.on("disconnect", () => {
      console.log(`🔴 User disconnected: ${socket.id}`);
    });
  });
};

export const broadcastScores = (matches) => {
  if (JSON.stringify(cachedScores) !== JSON.stringify(matches)) {
    cachedScores = matches;
    io.emit("cricketScores", matches);
    console.log("📢 Updated scores broadcasted.");
  }
};
