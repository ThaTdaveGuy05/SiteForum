const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    const file = fs.readFileSync(path.join(__dirname, "index.html"));
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(file);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocket.Server({ server });

let players = {};

wss.on("connection", ws => {
  const id = Math.random().toString(36).substr(2,9);
  players[id] = {x:200, y:200, color:"black", texts:[]};

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if (data.type === "move") {
      players[id].x = data.x;
      players[id].y = data.y;
      broadcastState();
    }
    if (data.type === "chat") {
      players[id].texts.unshift({text:data.text});
      if (players[id].texts.length > 3) players[id].texts.pop();
      setTimeout(()=>players[id].texts.pop(),5000);
      broadcast({type:"chatlog", text:`${data.username}: ${data.text}`});
      broadcastState();
    }
  });

  ws.on("close", ()=>{ delete players[id]; broadcastState(); });

  broadcastState();
});

function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(json); });
}

function broadcastState() {
  broadcast({type:"state", players});
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log("Server running on port", PORT));
