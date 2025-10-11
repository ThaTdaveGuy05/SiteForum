const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./forum.db');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hardcoded admins
const AdminNames = ['admin', 'root', 'principal'];

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0
  )`);
});

// Utility
function setOfflineAll() {
  db.run(`UPDATE users SET is_online = 0`);
}
setOfflineAll();

// --- Routes ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Login / Register
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!row) {
      // New user
      const hash = await bcrypt.hash(password, 10);
      const isAdmin = AdminNames.includes(username.toLowerCase()) ? 1 : 0;
      db.run('INSERT INTO users (username, password_hash, is_admin, is_online) VALUES (?, ?, ?, 1)', [username, hash, isAdmin], function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (e, newRow) => {
          res.json(newRow);
        });
      });
    } else {
      // Existing user
      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid password' });
      if (row.is_banned) return res.status(403).json({ banned: true });
      db.run('UPDATE users SET is_online = 1 WHERE id = ?', [row.id]);
      res.json(row);
    }
  });
});

app.post('/logout', (req, res) => {
  db.run('UPDATE users SET is_online = 0');
  res.json({ ok: true });
});

// --- Admin panel endpoints ---
app.get('/admin/data', (req, res) => {
  db.all('SELECT * FROM users', [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    const admins = users.filter(u => u.is_admin);
    res.json({ users, admins });
  });
});

app.post('/admin/banToggle', (req, res) => {
  const { user_id, action } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  const isBan = action === 'ban' ? 1 : 0;
  db.run('UPDATE users SET is_banned = ? WHERE id = ? AND is_admin = 0', [isBan, user_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('UPDATE users SET is_online = 0 WHERE id = ?', [user_id]);
    res.json({ updated: this.changes });
  });
});

app.post('/admin/addAdmin', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: 'Missing target' });
  db.run('UPDATE users SET is_admin = 1 WHERE username = ? OR id = ?', [target, target], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

app.post('/admin/removeAdmin', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: 'Missing target' });
  db.run('UPDATE users SET is_admin = 0 WHERE username = ? OR id = ?', [target, target], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// --- start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Forum running on http://localhost:${PORT}`));
