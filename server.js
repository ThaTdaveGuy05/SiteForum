const express=require('express');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const sqlite3=require('sqlite3').verbose();
const path=require('path');
const app=express();const db=new sqlite3.Database('./forumv2.db');
const AdminNames=['admin','root','principal'];

app.use(cors());app.use(express.json());app.use(express.urlencoded({extended:true}));
db.serialize(()=>{
db.run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,password_hash TEXT,is_admin INTEGER DEFAULT 0,is_banned INTEGER DEFAULT 0,is_online INTEGER DEFAULT 0,created_at TEXT)`);

db.run(`CREATE TABLE IF NOT EXISTS threads(id INTEGER PRIMARY KEY AUTOINCREMENT,author TEXT,title TEXT,body TEXT,date TEXT,likes INTEGER DEFAULT 0,dislikes INTEGER DEFAULT 0)`);

db.run(`CREATE TABLE IF NOT EXISTS likes(id INTEGER PRIMARY KEY AUTOINCREMENT,thread_id INTEGER,username TEXT,value INTEGER)`);

db.run(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT,message TEXT,date TEXT,seen INTEGER DEFAULT 0)`);
});

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

// login/register
app.post('/login',(req,res)=>{
const{username,password}=req.body;if(!username||!password)return res.json({error:'Missing fields'});
db.get('SELECT * FROM users WHERE username=?',[username],async(err,row)=>{
if(err)return res.json({error:err.message});
const now=new Date().toISOString();
if(!row){
const hash=await bcrypt.hash(password,10);
const isAdmin=AdminNames.includes(username.toLowerCase())?1:0;
db.run('INSERT INTO users(username,password_hash,is_admin,is_online,created_at) VALUES(?,?,?,?,?)',[username,hash,isAdmin,1,now],function(e){
if(e)return res.json({error:e.message});
db.get('SELECT * FROM users WHERE id=?',[this.lastID],(e2,n)=>res.json(n));
});
}else{
const ok=await bcrypt.compare(password,row.password_hash);
if(!ok)return res.json({error:'Invalid password'});
if(row.is_banned)return res.json({banned:true});
db.run('UPDATE users SET is_online=1 WHERE id=?',[row.id]);
res.json(row);
}});
});

app.post('/logout',(req,res)=>{db.run('UPDATE users SET is_online=0');res.json({ok:true});});

// threads
app.post('/threads',(req,res)=>{
const{author,title,body}=req.body;const d=new Date().toISOString();
db.run('INSERT INTO threads(author,title,body,date) VALUES(?,?,?,?)',[author,title,body,d],function(err){
if(err)return res.json({error:err.message});
res.json({ok:true});
});
});

app.get('/threads',(req,res)=>{
db.all('SELECT * FROM threads ORDER BY likes DESC,date DESC',(err,rows)=>res.json(rows));
});

app.post('/like',(req,res)=>{
const{thread_id,username,value}=req.body;
db.get('SELECT * FROM likes WHERE thread_id=? AND username=?',[thread_id,username],(err,row)=>{
if(row){
if(row.value===value){db.run('DELETE FROM likes WHERE id=?',[row.id]);}
else{db.run('UPDATE likes SET value=? WHERE id=?',[value,row.id]);}
}else{
db.run('INSERT INTO likes(thread_id,username,value) VALUES(?,?,?)',[thread_id,username,value]);
}
});
db.all('SELECT value FROM likes WHERE thread_id=?',[thread_id],(err,rows)=>{
const likes=rows.filter(r=>r.value===1).length;
const dislikes=rows.filter(r=>r.value===-1).length;
db.run('UPDATE threads SET likes=?,dislikes=? WHERE id=?',[likes,dislikes,thread_id]);
});
res.json({ok:true});
});

// user profile data
app.get('/users/:username/info',(req,res)=>{
db.get('SELECT id,username,created_at FROM users WHERE username=?',[req.params.username],(e,row)=>res.json(row||{}));
});
app.get('/users/:username/threads',(req,res)=>{
db.all('SELECT title,date FROM threads WHERE author=? ORDER BY id DESC',[req.params.username],(e,rows)=>res.json(rows||[]));
});
app.get('/users/:username/notifications',(req,res)=>{
db.all('SELECT * FROM notifications WHERE username=? ORDER BY id DESC',[req.params.username],(e,rows)=>res.json(rows||[]));
});
app.get('/users/:username/status',(req,res)=>{
db.get('SELECT is_banned FROM users WHERE username=?',[req.params.username],(e,row)=>res.json({banned:row?.is_banned}));
});

// searches
app.get('/userSearch',(req,res)=>{
const q=`%${req.query.q||''}%`;
db.all('SELECT id,username,is_online FROM users WHERE username LIKE ? OR id LIKE ?',[q,q],(e,rows)=>res.json(rows||[]));
});
app.get('/forumSearch',(req,res)=>{
const q=`%${req.query.q||''}%`;
db.all('SELECT id,title,author FROM threads WHERE title LIKE ? OR body LIKE ?',[q,q],(e,rows)=>res.json(rows||[]));
});

// admin
app.get('/admin/data',(req,res)=>{
db.all('SELECT * FROM users',(e,users)=>{
const admins=users.filter(u=>u.is_admin);
res.json({users,admins});
});
});
app.post('/admin/banToggle',(req,res)=>{
const{user_id,action}=req.body;const b=action==='ban'?1:0;
db.run('UPDATE users SET is_banned=?,is_online=0 WHERE id=? AND is_admin=0',[b,user_id],function(e){
res.json({updated:this.changes});
});
});
app.post('/admin/addAdmin',(req,res)=>{
const{target}=req.body;db.run('UPDATE users SET is_admin=1 WHERE username=? OR id=?',[target,target],function(e){res.json({ok:true});});
});
app.post('/admin/removeAdmin',(req,res)=>{
const{target}=req.body;db.run('UPDATE users SET is_admin=0 WHERE username=? OR id=?',[target,target],function(e){res.json({ok:true});});
});

const PORT=3000;app.listen(PORT,()=>console.log(`✅ Running http://localhost:${PORT}`));
