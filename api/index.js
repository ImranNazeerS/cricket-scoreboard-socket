import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import axios from "axios";
import * as cheerio from "cheerio";
import cron from "node-cron";
import cors from "cors";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const CRICBUZZ_URL = "https://www.cricbuzz.com/cricket-match/live-scores";
let cachedScores = [];

// Function to fetch scores
const fetchCricketScores = async () => {
  console.log("Fetching live scores...");
  try {
    const { data } = await axios.get(CRICBUZZ_URL);
    const $ = cheerio.load(data);
    let matches = [];

    $(".cb-lv-main").each((i, elem) => {
      const title = $(elem).find("h2 a").text().trim();
      const matchTitle = $(elem).find(".cb-col-100 .cb-mtch-lst").text().trim();
      const team1 = $(elem)
        .find(".cb-hmscg-bwl-txt .cb-hmscg-tm-nm")
        .text()
        .trim();
      const team2 = $(elem)
        .find(".cb-hmscg-bat-txt .cb-hmscg-tm-nm")
        .text()
        .trim();
      const score1 = $(elem)
        .find(".cb-hmscg-bwl-txt .cb-ovr-flo[style*='width:140px']")
        .text()
        .trim();
      const score2 = $(elem)
        .find(".cb-hmscg-bat-txt .cb-ovr-flo[style*='width:140px']")
        .text()
        .trim();
      const status = $(elem)
        .find(".cb-text-live, .cb-text-complete")
        .text()
        .trim();

      if (
        title.includes("India") ||
        title.includes("INDIAN PREMIER LEAGUE 2025")
      ) {
        matches.push({ matchTitle, team1, score1, team2, score2, status });
      }
    });

    if (JSON.stringify(cachedScores) !== JSON.stringify(matches)) {
      cachedScores = matches;
      io.emit("cricketScores", matches);
      console.log("📢 Scores updated & sent to clients.");
    } else {
      console.log("No score changes detected.");
    }
  } catch (error) {
    console.error("Error fetching cricket scores:", error);
  }
};

// WebSocket connection
io.on("connection", (socket) => {
  console.log(`🟢 New user connected: ${socket.id}`);
  socket.emit("cricketScores", cachedScores); // Send latest scores on connect

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// Run cron job from **7 PM to 1 AM** 
cron.schedule("*/30 * * * * *", () => {
  const hours = new Date().getHours();
  if (hours >= 19 || hours < 1) {
    fetchCricketScores();
  }
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
