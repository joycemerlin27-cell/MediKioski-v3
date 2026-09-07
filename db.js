const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'medikiosk.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('registration','doctor')),
 name TEXT NOT NULL,
 department TEXT
);
CREATE TABLE IF NOT EXISTS patients (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 contact TEXT NOT NULL,
 email TEXT,
 preferred_time TEXT,
 history TEXT,
 current_issue TEXT,
 adaptive_questionnaire TEXT,
 ai_summary TEXT,
 created_at TEXT NOT NULL,
 created_date TEXT NOT NULL,
 privacy_history INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS queue (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
 queue_no TEXT NOT NULL,
 department TEXT NOT NULL,
 assigned_doctor_id INTEGER REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'Waiting' CHECK(status IN ('Waiting','Called','Completed','Cancelled')),
 created_at TEXT NOT NULL,
 queue_date TEXT NOT NULL,
 UNIQUE(queue_date, department, queue_no)
);
CREATE TABLE IF NOT EXISTS documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
 original_name TEXT NOT NULL,
 stored_name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS followups (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
 doctor_id INTEGER NOT NULL REFERENCES users(id),
 followup_at TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('In-person','Online')),
 meeting_link TEXT,
 reminder_minutes INTEGER NOT NULL DEFAULT 30,
 status TEXT NOT NULL DEFAULT 'Scheduled'
);
`);

const defaultUsers = [
 ['regdesk','reg123','registration','Registration Desk',null],
 ['bones','doc123','doctor','Dr. Arjun Sharma','Orthopedics'],
 ['brain','doc123','doctor','Dr. Neha Kulkarni','Neurology'],
 ['opd','doc123','doctor','Dr. Rahul Mehta','General OPD'],
 ['emergency','doc123','doctor','Dr. Priya Singh','Emergency'],
 ['pediatrics','doc123','doctor','Dr. Aisha Khan','Pediatrics']
];
const insert = db.prepare(`INSERT OR IGNORE INTO users(username,password_hash,role,name,department) VALUES(?,?,?,?,?)`);
for (const [u,p,r,n,d] of defaultUsers) insert.run(u,bcrypt.hashSync(p,10),r,n,d);

for (const col of ['current_issue','adaptive_questionnaire','ai_summary']) { try { db.exec(`ALTER TABLE patients ADD COLUMN ${col} TEXT`); } catch(e) {} }

module.exports = db;
