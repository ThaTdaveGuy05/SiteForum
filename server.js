const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const db = new sqlite3.Database("./database.db");

app.use(cors());
app.use(bodyParser.json());

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT,
  content TEXT,
  date TEXT
)`);

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Get all posts
app.get("/posts", (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// Create new post
app.post("/posts", (req, res) => {
  const { author, content } = req.body;
  if (!author || !content) return res.status(400).send("Missing fields");
  const date = new Date().toLocaleString();
  db.run(
    "INSERT INTO posts (author, content, date) VALUES (?, ?, ?)",
    [author, content, date],
    function (err) {
      if (err) return res.status(500).send(err);
      res.json({ id: this.lastID, author, content, date });
    }
  );
});

// Run server
app.listen(3000, () => console.log("✅ Forum running on http://localhost:3000"));
