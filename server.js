const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, {recursive:true});

app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use(express.static(ROOT));

const storage = multer.diskStorage({
 destination: (_,__,cb)=>cb(null,UPLOAD_DIR),
 filename: (_,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())
});
const upload = multer({storage, limits:{files:5,fileSize:5*1024*1024}, fileFilter:(_,file,cb)=>{
 const ok=['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype);
 cb(ok?null:new Error('Only JPG, PNG, WEBP or PDF files are allowed.'),ok);
}});

const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const now = () => new Date().toISOString();
const sign = u => jwt.sign({id:u.id,role:u.role,department:u.department},JWT_SECRET,{expiresIn:'8h'});
function auth(req,res,next){
 try { const h=req.headers.authorization||''; if(!h.startsWith('Bearer ')) throw 0; req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
 catch { res.status(401).json({error:'Authentication required'}); }
}
function role(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Not allowed'});}
function validContact(c){return /^\d{10}$/.test(String(c||''));}
function validEmail(e){return !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);}

app.get('/api/health',(req,res)=>res.json({ok:true,date:today()}));
app.post('/api/login',(req,res)=>{
 const {username,password}=req.body||{};
 const u=db.prepare('SELECT * FROM users WHERE username=?').get(username||'');
 if(!u || !bcrypt.compareSync(password||'',u.password_hash)) return res.status(401).json({error:'Invalid username or password'});
 res.json({token:sign(u),user:{id:u.id,username:u.username,role:u.role,name:u.name,department:u.department}});
});

app.get('/api/departments',(req,res)=>res.json(db.prepare("SELECT id,name,department FROM users WHERE role='doctor' ORDER BY department,name").all().map(x=>({id:x.id,name:x.department,doctor:x.name}))));

app.post('/api/patients', upload.array('documents',5), (req,res)=>{
 const {name,contact,email,preferredTime,history,previousHistory,department,privacyHistory,currentIssue,adaptiveQuestionnaire}=req.body||{};
 const cleanHistory=typeof previousHistory==='string' ? previousHistory.trim() : (typeof history==='string' ? history.trim() : '');
 const cleanCurrentIssue=typeof currentIssue==='string' ? currentIssue.trim() : '';
 if(!name?.trim() || !validContact(contact) || !validEmail(email) || !department) return res.status(400).json({error:'Name, valid 10-digit contact and department are required. Email is optional but must be valid when entered.'});
 const date=today(), stamp=now();
 const tx=db.transaction(()=>{
  const p=db.prepare(`INSERT INTO patients(name,contact,email,preferred_time,history,current_issue,adaptive_questionnaire,created_at,created_date,privacy_history) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(name.trim(),contact,email?.trim()||null,preferredTime||null,cleanHistory||null,cleanCurrentIssue||null,adaptiveQuestionnaire||null,stamp,date,privacyHistory==='0'?0:1);
  const doc=db.prepare("SELECT id,department FROM users WHERE role='doctor' AND department=? ORDER BY id LIMIT 1").get(department);
  const count=db.prepare('SELECT COUNT(*) c FROM queue WHERE queue_date=? AND department=?').get(date,department).c+1;
  const prefix=department.split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase() || 'OPD';
  const qno=`${prefix}-${String(count).padStart(3,'0')}`;
  const q=db.prepare(`INSERT INTO queue(patient_id,queue_no,department,assigned_doctor_id,status,created_at,queue_date) VALUES(?,?,?,?,?,?,?)`).run(p.lastInsertRowid,qno,department,doc?.id||null,'Waiting',stamp,date);
  if(req.files) for(const f of req.files) db.prepare('INSERT INTO documents(patient_id,original_name,stored_name,created_at) VALUES(?,?,?,?)').run(p.lastInsertRowid,f.originalname,f.filename,stamp);
  return {id:p.lastInsertRowid,queueId:q.lastInsertRowid,queueNo:qno};
 });
 res.status(201).json(tx());
});

app.get('/api/queue/:queueNo',(req,res)=>{
 const q=db.prepare(`SELECT q.*,p.name,p.contact,p.email,p.preferred_time FROM queue q JOIN patients p ON p.id=q.patient_id WHERE q.queue_no=? AND q.queue_date=?`).get(req.params.queueNo,today());
 if(!q) return res.status(404).json({error:'Queue number not found for today'});
 const ahead=db.prepare(`SELECT COUNT(*) c FROM queue WHERE queue_date=? AND department=? AND status IN ('Waiting','Called') AND id<?`).get(today(),q.department,q.id).c;
 res.json({queueNo:q.queue_no,name:q.name,department:q.department,status:q.status,ahead,estimatedMinutes:ahead*5});
});

app.get('/api/registration/queue',auth,role('registration'),(req,res)=>{
 res.json(db.prepare(`SELECT q.id,q.queue_no,q.status,q.department,q.created_at,p.name,p.contact,p.email FROM queue q JOIN patients p ON p.id=q.patient_id WHERE q.queue_date=? ORDER BY q.id`).all(today()));
});

app.get('/api/doctors/me/patients',auth,role('doctor'),(req,res)=>{
 res.json(db.prepare(`SELECT q.id,q.queue_no,q.status,q.department,q.created_at,p.id patient_id,p.name,p.contact,p.email,p.preferred_time,p.history,p.current_issue,p.adaptive_questionnaire FROM queue q JOIN patients p ON p.id=q.patient_id WHERE q.queue_date=? AND q.assigned_doctor_id=? AND q.status IN ('Waiting','Called') ORDER BY q.id`).all(today(),req.user.id));
});
app.get('/api/doctors/me/patient/:id',auth,role('doctor'),(req,res)=>{
 const p=db.prepare(`SELECT p.*,q.queue_no,q.department,q.status FROM patients p JOIN queue q ON q.patient_id=p.id WHERE p.id=? AND q.assigned_doctor_id=? ORDER BY q.id DESC LIMIT 1`).get(req.params.id,req.user.id);
 if(!p)return res.status(404).json({error:'Patient not assigned to you'});
 const docs=db.prepare('SELECT id,original_name,created_at FROM documents WHERE patient_id=? ORDER BY id DESC').all(p.id);
 const follow=db.prepare('SELECT f.*,u.name doctor_name FROM followups f JOIN users u ON u.id=f.doctor_id WHERE f.patient_id=? ORDER BY f.followup_at DESC').all(p.id);
 res.json({...p,documents:docs,followups:follow});
});
app.post('/api/doctors/queue/:id/call',auth,role('doctor'),(req,res)=>{
 const r=db.prepare("UPDATE queue SET status='Called' WHERE id=? AND assigned_doctor_id=? AND status='Waiting'").run(req.params.id,req.user.id);
 if(!r.changes)return res.status(400).json({error:'Patient cannot be called'}); res.json({ok:true});
});
app.post('/api/doctors/queue/:id/complete',auth,role('doctor'),(req,res)=>{
 const r=db.prepare("UPDATE queue SET status='Completed' WHERE id=? AND assigned_doctor_id=? AND status IN ('Waiting','Called')").run(req.params.id,req.user.id);
 if(!r.changes)return res.status(400).json({error:'Patient cannot be completed'}); res.json({ok:true});
});
app.get('/api/doctors/documents/:id',auth,role('doctor'),(req,res)=>{ const d=db.prepare(`SELECT d.*,p.id patient_id FROM documents d JOIN patients p ON p.id=d.patient_id JOIN queue q ON q.patient_id=p.id WHERE d.id=? AND q.assigned_doctor_id=? LIMIT 1`).get(req.params.id,req.user.id); if(!d)return res.status(404).json({error:'Document not found'}); res.sendFile(path.join(UPLOAD_DIR,d.stored_name)); });
app.post('/api/doctors/followups',auth,role('doctor'),(req,res)=>{
 const {patientId,followupAt,mode,reminderMinutes}=req.body||{};
 const p=db.prepare(`SELECT p.id FROM patients p JOIN queue q ON q.patient_id=p.id WHERE p.id=? AND q.assigned_doctor_id=? LIMIT 1`).get(patientId,req.user.id);
 if(!p || !followupAt || !['Online','In-person'].includes(mode))return res.status(400).json({error:'Invalid follow-up'});
 const link=mode==='Online'?`https://meet.google.com/medikiosk-${crypto.randomBytes(4).toString('hex')}`:null;
 const r=db.prepare('INSERT INTO followups(patient_id,doctor_id,followup_at,mode,meeting_link,reminder_minutes) VALUES(?,?,?,?,?,?)').run(patientId,req.user.id,followupAt,mode,link,Number(reminderMinutes)||30);
 res.status(201).json({id:r.lastInsertRowid,meetingLink:link});
});
app.get('/api/doctors/me/followups',auth,role('doctor'),(req,res)=>res.json(db.prepare(`SELECT f.*,p.name patient_name FROM followups f JOIN patients p ON p.id=f.patient_id WHERE f.doctor_id=? AND f.status='Scheduled' ORDER BY f.followup_at`).all(req.user.id)));

// Queue history remains in SQLite; only the active queue is reset logically by queue_date.
// Optional cleanup of very old session uploads can be added for deployment.

app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Request failed'});});


// ---------- AI SUMMARY ----------
function buildAISummaryPrompt(patient) {
  const previousHistory = String(patient.history || '').slice(0, 12000);
  const currentIssue = String(patient.current_issue || '').slice(0, 4000);
  const adaptive = String(patient.adaptive_questionnaire || '').slice(0, 12000);

  return [
    'You are a clinical documentation assistant for a hospital OPD workflow.',
    'Summarize only information explicitly provided by the patient.',
    'Do not diagnose, prescribe, or invent facts.',
    'Keep the output concise and useful for a doctor handoff.',
    'If information is missing, say it is not provided.',
    'Return ONLY valid JSON with these keys:',
    'chiefComplaint, historySummary, relevantSymptoms, durationAndPattern, severityAndImpact, relevantHistory, medicationsOrAllergies, redFlagsReported, missingImportantInformation, doctorHandoff',
    '',
    'Previous medical history:',
    previousHistory || '(not provided)',
    '',
    'Current issue:',
    currentIssue || '(not provided)',
    '',
    'Adaptive questionnaire answers:',
    adaptive || '(not provided)'
  ].join('\n');
}

function localSummary(patient) {
  return {
    chiefComplaint: patient.current_issue || 'Not provided',
    historySummary: patient.history || 'No previous medical history provided.',
    relevantSymptoms: patient.adaptive_questionnaire || 'No adaptive questionnaire details provided.',
    durationAndPattern: 'See patient-provided questionnaire details.',
    severityAndImpact: 'See patient-provided questionnaire details.',
    relevantHistory: patient.history || 'Not provided',
    medicationsOrAllergies: 'Not provided',
    redFlagsReported: 'Not independently assessed; only patient-provided information is summarized.',
    missingImportantInformation: 'AI provider not configured, so a full AI summary was not generated.',
    doctorHandoff: 'Review the patient-reported history, current issue and questionnaire before clinical assessment.'
  };
}

function callAIProvider(prompt, callback) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = process.env.AI_API_BASE_URL || 'https://api.openai.com';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) return callback(null, {
    configured: false,
    model,
    summary: null,
    message: 'AI API is not configured. Add AI_API_KEY in Render Environment Variables.'
  });

  let u;
  try { u = new URL('/v1/chat/completions', baseUrl); }
  catch (_) { return callback(new Error('Invalid AI_API_BASE_URL')); }

  const payload = JSON.stringify({
    model,
    temperature: 0.1,
    response_format: {type:'json_object'},
    messages: [
      {role:'system', content:'You are a safe clinical documentation summarizer. Do not diagnose or prescribe.'},
      {role:'user', content:prompt}
    ]
  });

  const https = require('https');
  const req = https.request({
    hostname: u.hostname,
    port: u.port || 443,
    path: u.pathname + (u.search || ''),
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, r => {
    let raw = '';
    r.on('data', c => raw += c);
    r.on('end', () => {
      let data = {};
      try { data = JSON.parse(raw); } catch (_) {}
      if (r.statusCode < 200 || r.statusCode >= 300) {
        return callback(new Error(data.error?.message || ('AI provider returned HTTP ' + r.statusCode)));
      }
      const content = data.choices?.[0]?.message?.content || '';
      let parsed;
      try { parsed = JSON.parse(content); }
      catch (_) { parsed = {doctorHandoff: content}; }
      callback(null, {configured:true, model, summary:parsed});
    });
  });
  req.on('error', err => callback(err));
  req.write(payload);
  req.end();
}

app.post('/api/doctors/patient/:id/ai-summary', auth, role('doctor'), (req,res) => {
  const patient = db.prepare(`
    SELECT p.*, q.queue_no, q.department, q.status
    FROM patients p
    JOIN queue q ON q.patient_id=p.id
    WHERE p.id=? AND q.assigned_doctor_id=?
    ORDER BY q.id DESC LIMIT 1
  `).get(req.params.id, req.user.id);

  if (!patient) return res.status(404).json({error:'Patient not assigned to you'});

  const fallback = localSummary(patient);
  callAIProvider(buildAISummaryPrompt(patient), (err, result) => {
    if (err) {
      return res.status(502).json({
        error: err.message,
        configured: true,
        summary: fallback,
        fallback: true
      });
    }

    if (!result.configured) {
      return res.json({
        configured:false,
        summary:fallback,
        fallback:true,
        message:result.message
      });
    }

    const summaryText = JSON.stringify(result.summary);
    try {
      db.prepare('UPDATE patients SET ai_summary=? WHERE id=?').run(summaryText, patient.id);
    } catch (_) {}

    res.json({
      configured:true,
      summary:result.summary,
      model:result.model,
      saved:true
    });
  });
});

app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Request failed'});});
app.listen(PORT,()=>console.log(`MediKiosk running at http://localhost:${PORT}`));
