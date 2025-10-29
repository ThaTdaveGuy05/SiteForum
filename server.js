// Simple multiplayer chat + movement server using Socket.IO

import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public")); // Serve your HTML from "public" folder

let players = {};

io.on("connection", (socket) => {
  console.log("New player:", socket.id);
  players[socket.id] = { x: 100, y: 100, name: "Player" };

  socket.emit("init", players);
  socket.broadcast.emit("newPlayer", { id: socket.id, data: players[socket.id] });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      io.emit("update", { id: socket.id, x: data.x, y: data.y });
    }
  });

  socket.on("chat", (msg) => {
    io.emit("chat", { id: socket.id, text: msg });
  });

  socket.on("disconnect", () => {
    console.log("Player left:", socket.id);
    delete players[socket.id];
    io.emit("removePlayer", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
