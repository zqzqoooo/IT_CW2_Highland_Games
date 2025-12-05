require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateRegistrationEmail } = require('./utils/emailTemplate');

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

// --- email config ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "sg-smtp.qcloudmail.com",
  port: process.env.EMAIL_PORT || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || "HighlandGames@heshanws.top",
    pass: process.env.EMAIL_PASS || "zq710609ZQ."
  }
});

transporter.verify((err) => console.log(err ? '❌ SMTP Error' : '✅ SMTP Ready'));

// --- Image Upload Configuration ---
const uploadDirDist = path.join(__dirname, '../client/dist/images');
const uploadDirPublic = path.join(__dirname, '../client/public/images');

[uploadDirDist, uploadDirPublic].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirDist),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Helper: Delete Old Image ---
const deleteOldImage = (imagePath) => {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  if (imagePath.startsWith('http')) return; // Don't delete external images

  const paths = [
    path.join(uploadDirDist, filename),
    path.join(uploadDirPublic, filename)
  ];

  paths.forEach(p => {
    if (fs.existsSync(p)) {
      fs.unlink(p, err => { if(!err) console.log(`🗑️ Deleted: ${filename}`); });
    }
  });
};

// ========================== Routes ==========================

// 1. Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file' });
  const targetPath = path.join(uploadDirPublic, req.file.filename);
  fs.copyFile(req.file.path, targetPath, () => {}); 
  res.json({ filePath: `/images/${req.file.filename}` });
});

// 2. Public GET
app.get('/api/events', async (req, res) => { try { const [r] = await db.query('SELECT * FROM events'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/events/:id', async (req, res) => { try { const [r] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]); if(r.length===0) return res.status(404).json({message:'Not found'}); res.json(r[0]); } catch(e) { res.status(500).json(e); } });
app.get('/api/slides', async (req, res) => { try { const [r] = await db.query('SELECT * FROM slides'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/tally', async (req, res) => { try { const [r] = await db.query('SELECT * FROM medal_tally'); res.json(r); } catch(e) { res.status(500).send(e); } });
app.get('/api/heritage', async (req, res) => { try { const [r] = await db.query('SELECT * FROM heritage'); res.json(r); } catch(e) { res.status(500).send(e); } });

// 3. Auth & Register
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

// 3. Registration (Updated with decoupled template)
app.post('/api/register', async (req, res) => {
  const { name, email, type, eventName, eventNames } = req.body;
  let targetEvents = [];
  
  // 兼容单选和多选
  if (eventNames && Array.isArray(eventNames) && eventNames.length > 0) {
    targetEvents = eventNames;
  } else if (eventName) {
    targetEvents = [eventName];
  } else {
    return res.status(400).json({ message: 'No events selected' });
  }

  try {
    // 查询详细信息
    const [eventsInfo] = await db.query('SELECT * FROM events WHERE name IN (?)', [targetEvents]);
    
    // 使用外部文件生成漂亮的 HTML
    const emailHtml = generateRegistrationEmail(name, eventsInfo);
    
    // 发送邮件
    transporter.sendMail({ 
      from: `"Paisley Games" <${process.env.EMAIL_USER}>`, 
      to: email, 
      subject: `Registration Confirmed - ${eventsInfo.length} Event(s)`, 
      html: emailHtml // 使用生成好的 HTML
    }, (err) => { 
      if(err) console.error('Email failed:', err); 
      else console.log('Email sent successfully');
    });

    // 写入数据库
    const inserts = targetEvents.map(evt => db.query('INSERT INTO registrations (user_name, email, type, event_name) VALUES (?, ?, ?, ?)', [name, email, type, evt]));
    await Promise.all(inserts);
    
    res.json({ message: 'Success' });
  } catch(e) { 
    console.error(e);
    res.status(500).json({ message: 'Server error', error: e.message }); 
  }
});

// 4. Admin Routes
app.get('/api/admin/registrations', async (req, res) => { try { const [r] = await db.query('SELECT * FROM registrations ORDER BY created_at DESC'); res.json(r); } catch(e) { res.status(500).json(e); } });
app.put('/api/admin/registrations/:id', async (req, res) => { try { await db.query('UPDATE registrations SET status = ? WHERE id = ?', [req.body.status, req.params.id]); res.json({ message: 'Updated' }); } catch(e) { res.status(500).json(e); } });

// --- 5. Admin CRUD (Robust Version) ---
// 核心修复：先查旧数据，合并新数据，再更新。防止 undefined 覆盖导致数据丢失或报错。

// Events
app.post('/api/admin/events', async (req, res) => {
  const { name, description, image, event_time='', event_date='', location='', lat=55.8456, lng=-4.4239 } = req.body;
  try { await db.query(`INSERT INTO events (name, description, image, event_time, event_date, location, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [name, description, image, event_time, event_date, location, lat, lng]); res.json({message:'Created'}); } catch(e) { res.status(500).json(e); }
});

app.put('/api/admin/events/:id', async (req, res) => {
  const { name, description, image, event_time, event_date, location, lat, lng } = req.body;
  try {
    // 1. 获取旧数据
    const [old] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (old.length === 0) return res.status(404).json({message: 'Not found'});
    const current = old[0];

    // 2. 如果上传了新图，删除旧图
    if (image && current.image && image !== current.image) deleteOldImage(current.image);

    // 3. 智能更新：如果有新值用新值，否则保留旧值 (避免 undefined 覆盖)
    await db.query(
      `UPDATE events SET name=?, description=?, image=?, event_time=?, event_date=?, location=?, lat=?, lng=? WHERE id=?`, 
      [
        name !== undefined ? name : current.name, 
        description !== undefined ? description : current.description,
        image !== undefined ? image : current.image,
        event_time !== undefined ? event_time : current.event_time,
        event_date !== undefined ? event_date : current.event_date,
        location !== undefined ? location : current.location,
        lat !== undefined ? lat : current.lat,
        lng !== undefined ? lng : current.lng,
        req.params.id
      ]
    );
    res.json({message:'Updated'}); 
  } catch(e) { 
    console.error("Event Update Error:", e); 
    res.status(500).json(e); 
  }
});

app.delete('/api/admin/events/:id', async (req, res) => {
  try {
    const [old] = await db.query('SELECT image FROM events WHERE id = ?', [req.params.id]);
    if (old.length > 0) deleteOldImage(old[0].image);
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({message:'Deleted'});
  } catch(e) { res.status(500).json(e); }
});

// Slides: Create, Update, Delete
app.post('/api/admin/slides', async (req, res) => {
  // 1. 补全 action 字段
  const { title, subtitle, button_text, action, image } = req.body;
  try { 
    // 2. SQL 语句增加 action 字段和对应占位符
    await db.query(
      `INSERT INTO slides (title, subtitle, button_text, action, image) VALUES (?, ?, ?, ?, ?)`, 
      [title, subtitle, button_text, action, image]
    ); 
    res.json({message:'Created'}); 
  } catch(e) { res.status(500).json(e); }
});

app.put('/api/admin/slides/:id', async (req, res) => {
  const { title, subtitle, button_text, action, image } = req.body;
  try {
    const [old] = await db.query('SELECT * FROM slides WHERE id = ?', [req.params.id]);
    
    // 3. 安全检查：防止 ID 不存在导致报错
    if (old.length === 0) return res.status(404).json({ message: 'Slide not found' });
    
    const current = old[0];
    if (image && current.image && image !== current.image) deleteOldImage(current.image);

    await db.query('UPDATE slides SET title=?, subtitle=?, button_text=?, action=?, image=? WHERE id=?', 
      [
        title !== undefined ? title : current.title,
        subtitle !== undefined ? subtitle : current.subtitle,
        button_text !== undefined ? button_text : current.button_text,
        action !== undefined ? action : current.action, // 确保这里更新 action
        image !== undefined ? image : current.image,
        req.params.id
      ]
    );
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
    const [old] = await db.query('SELECT * FROM heritage WHERE id = ?', [req.params.id]);
    const current = old[0];
    if (image && current.image && image !== current.image) deleteOldImage(current.image);

    await db.query('UPDATE heritage SET title=?, description=?, image=? WHERE id=?', 
      [
        title !== undefined ? title : current.title,
        description !== undefined ? description : current.description,
        image !== undefined ? image : current.image,
        req.params.id
      ]
    );
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