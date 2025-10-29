// server.js — CommonJS version (works perfectly on Render)

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// serve files from public folder
app.use(express.static(path.join(__dirname, "public")));

let players = {};

// handle connections
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);
  players[socket.id] = { x: 100, y: 100 };

  // send current player list
  socket.emit("init", players);
  socket.broadcast.emit("newPlayer", { id: socket.id, x: 100, y: 100 });

  // handle movement
  socket.on("move", (pos) => {
    if (players[socket.id]) {
      players[socket.id] = pos;
      io.emit("updatePositions", players);
    }
  });

  // handle chat
  socket.on("chat", (msg) => {
    io.emit("chat", { id: socket.id, msg });
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit("removePlayer", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
