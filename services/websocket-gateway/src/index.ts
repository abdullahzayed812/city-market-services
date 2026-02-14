import express from "express";
import http from "http";
import { Server } from "socket.io";
import { rabbitMQBus } from "@city-market/shared/node";
import { setupSocketServer } from "./socket";
import { setupEventConsumer } from "./events";
import { config } from "dotenv";

config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for now, restrict in production
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3009;

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

async function start() {
  try {
    await rabbitMQBus.connect();

    setupSocketServer(io);
    await setupEventConsumer(io);

    server.listen(PORT, () => {
      console.log(`WebSocket Gateway listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start WebSocket Gateway:", error);
    process.exit(1);
  }
}

start();
