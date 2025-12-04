require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// --- middleware config ---
app.use(cors());
app.use(bodyParser.json());

// --- database connect ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'paisley_games',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise();

// --- email config (From .env) --- 邮件配置
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error) => {
  if (error) console.log('❌ SMTP Connection Error:', error);
  else console.log('✅ SMTP Server is ready');
});

// --- Image Upload Configuration --- 图像上传配置
// 修改点 1: 路径改为 images
const uploadDirDist = path.join(__dirname, '../client/dist/images');
const uploadDirPublic = path.join(__dirname, '../client/public/images');

// 确保两个目录都存在
[uploadDirDist, uploadDirPublic].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) { 
    // 默认先存到 dist/images (生产环境读取)
    cb(null, uploadDirDist); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- Helper: Delete Old Image ---
const deleteOldImage = (relativePath) => {
  // 修改点 2: 检查路径是否包含 /images/
  if (!relativePath || !relativePath.includes('/images/')) return;
  const filename = path.basename(relativePath);
  
  // 同时删除两个目录下的文件
  const paths = [
    path.join(uploadDirDist, filename),
    path.join(uploadDirPublic, filename)
  ];
  
  paths.forEach(p => {
    if (fs.existsSync(p)) {
      fs.unlink(p, err => { if(!err) console.log(`Deleted: ${p}`); });
    }
  });
};

// ==========================================
// API Routes
// ==========================================

// 1. Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file' });
  
  // 修改点 3: 上传成功后，立即复制一份到 public/images (开发环境读取)
  const targetPath = path.join(uploadDirPublic, req.file.filename);
  fs.copyFile(req.file.path, targetPath, (err) => {
    if (err) console.error('Copy to public failed:', err);
  });

  // 返回给前端的路径改为 /images/...
  res.json({ filePath: `/images/${req.file.filename}` });
});

// 2. Public GET
app.get('/api/events', async (req, res) => { try { const [r] = await db.query('SELECT * FROM events'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/events/:id', async (req, res) => { try { const [r] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]); if (r.length===0) return res.status(404).json({message:'Not found'}); res.json(r[0]); } catch(e) { res.status(500).json(e); } });
app.get('/api/slides', async (req, res) => { try { const [r] = await db.query('SELECT * FROM slides'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/tally', async (req, res) => { try { const [r] = await db.query('SELECT * FROM medal_tally'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/heritage', async (req, res) => { try { const [r] = await db.query('SELECT * FROM heritage'); res.json(r); } catch(e) { res.status(500).send(e); } });

// 3. Registration
app.post('/api/register', async (req, res) => {
  const { name, email, type, eventName, eventNames } = req.body;
  let targetEvents = [];
  if (eventNames && eventNames.length > 0) targetEvents = eventNames;
  else if (eventName) targetEvents = [eventName];
  else return res.status(400).json({ message: 'No events' });

  try {
    const [eventsInfo] = await db.query('SELECT * FROM events WHERE name IN (?)', [targetEvents]);
    
    // 修改点 4: 邮件发件人使用环境变量
    let emailHtml = `<h3>Dear ${name},</h3><p>Registration Confirmed:</p><hr/>`;
    eventsInfo.forEach(ev => { emailHtml += `<p><strong>${ev.name}</strong><br/>Date: ${ev.event_date}<br/>Loc: ${ev.location}</p>`; });
    emailHtml += `<p>Status: PENDING.</p>`;
    
    transporter.sendMail({ 
      from: `"Paisley Games" <${process.env.EMAIL_USER}>`, 
      to: email, 
      subject: `Registration Confirmed`, 
      html: emailHtml 
    }, (err) => { if(err) console.error(err); });

    const inserts = targetEvents.map(evt => db.query('INSERT INTO registrations (user_name, email, type, event_name) VALUES (?, ?, ?, ?)', [name, email, type, evt]));
    await Promise.all(inserts);
    res.json({ message: 'Success' });
  } catch(e) { res.status(500).json(e); }
});

app.get('/api/check-status', async (req, res) => { try { const [r] = await db.query(`SELECT r.*, e.event_date, e.event_time, e.location FROM registrations r LEFT JOIN events e ON r.event_name = e.name WHERE r.email = ? ORDER BY r.created_at DESC`, [req.query.email]); res.json(r); } catch(e) { res.status(500).json(e); } });

// 4. Auth
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [admin] = await db.query('SELECT * FROM admins WHERE username = ? AND password = ?', [username, password]);
    if (admin.length > 0) return res.json({ success: true, user: { username: admin[0].username, role: 'admin' } });
    const [user] = await db.query('SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ?', [username, username, password]);
    if (user.length > 0) return res.json({ success: true, user: { username: user[0].username, email: user[0].email, role: 'user' } });
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch(e) { res.status(500).json(e); }
});
app.post('/api/signup', async (req, res) => { try { await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [req.body.username, req.body.email, req.body.password]); res.json({success:true}); } catch(e) { if(e.code==='ER_DUP_ENTRY') res.status(400).json({message:'Email exists'}); else res.status(500).json(e); } });
app.get('/api/user/my-registrations', async (req, res) => { try { const [r] = await db.query(`SELECT r.*, e.event_date, e.event_time, e.location FROM registrations r LEFT JOIN events e ON r.event_name = e.name WHERE r.email = ? ORDER BY r.created_at DESC`, [req.query.email]); res.json(r); } catch(e) { res.status(500).json(e); } });

// 5. Admin - Registrations
app.get('/api/admin/registrations', async (req, res) => { try { const [r] = await db.query('SELECT * FROM registrations ORDER BY created_at DESC'); res.json(r); } catch(e) { res.status(500).json(e); } });
app.put('/api/admin/registrations/:id', async (req, res) => { try { await db.query('UPDATE registrations SET status = ? WHERE id = ?', [req.body.status, req.params.id]); res.json({ message: 'Updated' }); } catch(e) { res.status(500).json(e); } });

// --- 6. Admin CRUD (Events / Slides / Heritage) ---

// Events
app.post('/api/admin/events', async (req, res) => {
  const { name, description, image, event_time='', event_date='', location='', lat=55.8456, lng=-4.4239 } = req.body;
  try { await db.query(`INSERT INTO events (name, description, image, event_time, event_date, location, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [name, description, image, event_time, event_date, location, lat, lng]); res.json({message:'Created'}); } catch(e) { res.status(500).json(e); }
});
app.put('/api/admin/events/:id', async (req, res) => {
  const { name, description, image, event_time, event_date, location, lat, lng } = req.body;
  try { 
    const [old] = await db.query('SELECT image FROM events WHERE id = ?', [req.params.id]);
    if (old.length > 0 && old[0].image !== image) deleteOldImage(old[0].image);
    await db.query(`UPDATE events SET name=?, description=?, image=?, event_time=?, event_date=?, location=?, lat=?, lng=? WHERE id=?`, [name, description, image, event_time, event_date, location, lat, lng, req.params.id]); 
    res.json({message:'Updated'}); 
  } catch(e) { console.error(e); res.status(500).json(e); }
});
app.delete('/api/admin/events/:id', async (req, res) => {
  try { 
    const [old] = await db.query('SELECT image FROM events WHERE id = ?', [req.params.id]);
    if (old.length > 0) deleteOldImage(old[0].image);
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]); 
    res.json({message:'Deleted'}); 
  } catch(e) { res.status(500).json(e); }
});

// Slides
app.post('/api/admin/slides', async (req, res) => {
  const { title, subtitle, button_text, image } = req.body;
  try { await db.query(`INSERT INTO slides (title, subtitle, button_text, image) VALUES (?, ?, ?, ?)`, [title, subtitle, button_text, image]); res.json({message:'Created'}); } catch(e) { res.status(500).json(e); }
});
app.put('/api/admin/slides/:id', async (req, res) => {
  const { title, subtitle, button_text, image } = req.body;
  try { 
    const [old] = await db.query('SELECT image FROM slides WHERE id = ?', [req.params.id]);
    if (old.length > 0 && old[0].image !== image) deleteOldImage(old[0].image);
    await db.query('UPDATE slides SET title=?, subtitle=?, button_text=?, image=? WHERE id=?', [title, subtitle, button_text, image, req.params.id]); 
    res.json({message:'Updated'}); 
  } catch(e) { res.status(500).json(e); }
});
app.delete('/api/admin/slides/:id', async (req, res) => {
  try { 
    const [old] = await db.query('SELECT image FROM slides WHERE id = ?', [req.params.id]);
    if (old.length > 0) deleteOldImage(old[0].image);
    await db.query('DELETE FROM slides WHERE id = ?', [req.params.id]); 
    res.json({message:'Deleted'}); 
  } catch(e) { res.status(500).json(e); }
});

// Heritage
app.post('/api/admin/heritage', async (req, res) => {
  const { title, description, image } = req.body;
  try { await db.query(`INSERT INTO heritage (title, description, image) VALUES (?, ?, ?)`, [title, description, image]); res.json({message:'Created'}); } catch(e) { res.status(500).json(e); }
});
app.put('/api/admin/heritage/:id', async (req, res) => {
  const { title, description, image } = req.body;
  try { 
    const [old] = await db.query('SELECT image FROM heritage WHERE id = ?', [req.params.id]);
    if (old.length > 0 && old[0].image !== image) deleteOldImage(old[0].image);
    await db.query('UPDATE heritage SET title=?, description=?, image=? WHERE id=?', [title, description, image, req.params.id]); 
    res.json({message:'Updated'}); 
  } catch(e) { res.status(500).json(e); }
});
app.delete('/api/admin/heritage/:id', async (req, res) => {
  try { 
    const [old] = await db.query('SELECT image FROM heritage WHERE id = ?', [req.params.id]);
    if (old.length > 0) deleteOldImage(old[0].image);
    await db.query('DELETE FROM heritage WHERE id = ?', [req.params.id]); 
    res.json({message:'Deleted'}); 
  } catch(e) { res.status(500).json(e); }
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));